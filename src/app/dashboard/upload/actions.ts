"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveYouTubeVideo } from "@/lib/youtube";
import { DIFFICULTY_LEVELS, TOPICS } from "@/lib/taxonomy";

export type UploadState = {
  errors: {
    form?: string;
    url?: string;
    title?: string;
    description?: string;
    difficulty?: string;
    topic?: string;
    release?: string;
  };
  values: {
    url: string;
    title: string;
    description: string;
    difficulty: string;
    topic: string;
  };
};

const LEVELS = DIFFICULTY_LEVELS.map((l) => String(l.level));

export async function createVideo(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const values = {
    url: String(formData.get("url") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    difficulty: String(formData.get("difficulty") ?? ""),
    topic: String(formData.get("topic") ?? ""),
  };
  const release = formData.get("release") === "on";

  const errors: UploadState["errors"] = {};

  if (!values.url) errors.url = "Paste the YouTube link.";

  if (!values.title) {
    errors.title = "Enter a title.";
  } else if (values.title.length > 200) {
    errors.title = "That is too long. Keep it under 200 characters.";
  }

  if (values.description.length > 5000) {
    errors.description = "That is too long. Keep it under 5000 characters.";
  }

  if (!LEVELS.includes(values.difficulty)) {
    errors.difficulty = "Choose a level.";
  }

  if (!(TOPICS as readonly string[]).includes(values.topic)) {
    errors.topic = "Choose a topic.";
  }

  /*
   * Section 9.5. The checkbox is a record that the paper releases exist, so it
   * is required rather than advisory, and the database refuses a published row
   * without it as well (videos_published_requires_release).
   */
  if (!release) {
    errors.release = "Confirm the release before publishing.";
  }

  if (Object.keys(errors).length > 0) return { errors, values };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { errors: { form: "You need to be signed in to publish." }, values };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("can_post, suspended_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return { errors: { form: "We could not find your profile." }, values };
  }
  if (profile.suspended_at) {
    return {
      errors: { form: "Your account is suspended, so you cannot publish." },
      values,
    };
  }
  if (!profile.can_post) {
    return {
      errors: { form: "Publishing is not enabled for your account." },
      values,
    };
  }

  /*
   * Resolved again here, server side, rather than trusting what the form
   * collected on paste.
   *
   * The client knows the id, the thumbnail and the duration by this point, and
   * all three arrive in a request anyone can forge. Re-resolving is also the
   * only way to be sure the video is still public and still embeddable at the
   * moment of publishing rather than at the moment of pasting. The title is the
   * one field we take from the form, because section 5 says the contributor may
   * edit it.
   */
  const resolved = await resolveYouTubeVideo(values.url);
  if (!resolved.ok) {
    return { errors: { url: resolved.message }, values };
  }

  const { error } = await supabase.from("videos").insert({
    title: values.title,
    description: values.description || null,
    youtube_id: resolved.video.youtubeId,
    thumbnail_url: resolved.video.thumbnailUrl,
    duration_s: resolved.video.durationS,
    difficulty: Number(values.difficulty),
    topic: values.topic,
    owner_id: user.id,
    status: "published",
    release_ok: true,
    published_at: new Date().toISOString(),
  });

  if (error) {
    return {
      errors: { form: `We could not publish that: ${error.message}` },
      values,
    };
  }

  revalidatePath("/library");
  redirect("/library");
}
