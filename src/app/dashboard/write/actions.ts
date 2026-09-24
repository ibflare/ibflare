"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkComment } from "@/lib/moderation";
import { DIFFICULTY_LEVELS, TOPICS } from "@/lib/taxonomy";

export type ArticleState = {
  errors: {
    form?: string;
    title?: string;
    description?: string;
    body?: string;
    difficulty?: string;
    topic?: string;
  };
  values: {
    title: string;
    description: string;
    body: string;
    difficulty: string;
    topic: string;
  };
};

const LEVELS = DIFFICULTY_LEVELS.map((l) => String(l.level));

/** Matches articles_body_length. Kept here so the form can say so first. */
const BODY_MIN = 200;
const BODY_MAX = 40000;

export async function createArticle(
  _prev: ArticleState,
  formData: FormData,
): Promise<ArticleState> {
  const values = {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    body: String(formData.get("body") ?? "").trim(),
    difficulty: String(formData.get("difficulty") ?? ""),
    topic: String(formData.get("topic") ?? ""),
  };

  const errors: ArticleState["errors"] = {};

  if (!values.title) {
    errors.title = "Enter a title.";
  } else if (values.title.length > 200) {
    errors.title = "That is too long. Keep it under 200 characters.";
  }

  if (values.description.length > 500) {
    errors.description = "That is too long. Keep it under 500 characters.";
  }

  if (values.body.length < BODY_MIN) {
    errors.body = `Write a bit more. Articles start at ${BODY_MIN} characters.`;
  } else if (values.body.length > BODY_MAX) {
    errors.body = `That is too long. Keep it under ${BODY_MAX} characters.`;
  }

  if (!LEVELS.includes(values.difficulty)) errors.difficulty = "Choose a level.";
  if (!(TOPICS as readonly string[]).includes(values.topic)) {
    errors.topic = "Choose a topic.";
  }

  /*
   * The filter runs here so the writer gets a sentence rather than an RLS
   * error, exactly as postComment does. The insert policy checks all three
   * fields as well, and that is the half that actually enforces it: see
   * 20260923000000. Checked before anything is written, and the message names
   * the field so a long piece does not have to be re-read end to end.
   */
  for (const [field, text] of [
    ["title", values.title],
    ["description", values.description],
    ["body", values.body],
  ] as const) {
    if (!text) continue;
    const verdict = checkComment(text);
    if (!verdict.ok) {
      errors[field] = verdict.message;
    }
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

  const { data: created, error } = await supabase
    .from("articles")
    .insert({
      title: values.title,
      description: values.description || null,
      body: values.body,
      difficulty: Number(values.difficulty),
      topic: values.topic,
      owner_id: user.id,
      status: "published",
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !created) {
    return {
      errors: {
        form: `We could not publish that: ${error?.message ?? "unknown error"}`,
      },
      values,
    };
  }

  revalidatePath("/library");
  revalidatePath("/dashboard");

  // Straight to the piece itself. Unlike a video, there is nothing to tag
  // afterwards, and the first thing a writer wants is to read it as published.
  redirect(`/a/${created.id}`);
}

export async function deleteArticle(formData: FormData): Promise<void> {
  const id = String(formData.get("article_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();
  await supabase.rpc("soft_delete_article", {
    p_article: id,
    p_reason: reason || null,
  });

  revalidatePath("/library");
  revalidatePath("/dashboard");
}
