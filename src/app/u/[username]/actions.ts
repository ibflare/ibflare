"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";

/**
 * Profile picture upload and removal.
 *
 * Gated on can_post, in the database as well as here: the storage policies in
 * 20260903010000 check the capability and the suspension state themselves, so
 * a direct call to the storage API with the anon key is refused the same way.
 * This action is the convenient path, not the only guard.
 */

export type AvatarState = { error: string | null };

const MAX_BYTES = 2 * 1024 * 1024;
const SIDE = 400;
const OBJECT = "avatar.webp";
const BUCKET = "avatars";

/**
 * The real format, from the leading bytes.
 *
 * A filename proves nothing: `.png` on a zip, or on a 40MB TIFF, costs nothing
 * to send. This runs before the buffer is handed to a decoder, so an obviously
 * wrong file is rejected without decoding it at all. sharp's own read is the
 * authoritative check and happens straight after.
 */
function sniff(buf: Buffer): "jpeg" | "png" | "webp" | null {
  if (buf.length < 12) return null;

  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";

  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.subarray(0, 8).equals(PNG)) return "png";

  // RIFF....WEBP
  if (
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }

  return null;
}

/** The caller, plus the checks both actions share. */
async function contributor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "You need to be signed in to do that." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, can_post, suspended_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return { ok: false as const, error: "We could not find your profile." };
  }

  if (profile.suspended_at) {
    return {
      ok: false as const,
      error: "Your account is suspended, so you cannot change your picture.",
    };
  }

  if (!profile.can_post) {
    // Not reachable from the UI, which renders no control without can_post.
    // Reachable by calling this action directly, so it is answered here too.
    return {
      ok: false as const,
      error: "Changing your picture is limited to contributors.",
    };
  }

  return { ok: true as const, supabase, user, username: profile.username as string };
}

export async function uploadAvatar(
  _prev: AvatarState,
  formData: FormData,
): Promise<AvatarState> {
  const who = await contributor();
  if (!who.ok) return { error: who.error };
  const { supabase, user, username } = who;

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image to upload." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "That image is over 2MB. Pick a smaller one." };
  }

  const input = Buffer.from(await file.arrayBuffer());

  if (!sniff(input)) {
    return { error: "That file is not a JPG, PNG, or WebP image." };
  }

  let output: Buffer;
  try {
    /*
     * limitInputPixels caps the decoded size, not the file size. A 2MB PNG can
     * describe an image of hundreds of megapixels, and decoding it is how a
     * small upload turns into an out-of-memory kill. 50MP is far above any real
     * photo and far below the damage threshold.
     */
    const image = sharp(input, { limitInputPixels: 50_000_000 });

    const meta = await image.metadata();
    if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format)) {
      return { error: "That file is not a JPG, PNG, or WebP image." };
    }

    /*
     * rotate() before resize applies the EXIF orientation flag, so a photo
     * taken sideways on a phone is not stored sideways. It has to come first:
     * afterwards the dimensions have already been swapped.
     *
     * sharp drops metadata on output unless asked to keep it, which is what we
     * want here and not only for file size: a phone photo carries EXIF GPS
     * coordinates, and this site collects city at most, deliberately. Do not
     * add withMetadata().
     */
    output = await image
      .rotate()
      .resize(SIDE, SIDE, { fit: "cover", position: "centre" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return { error: "We could not read that image. Try a different file." };
  }

  /*
   * One object per user, at a fixed name, so an upload replaces the previous
   * picture instead of adding to a pile. upsert makes the replacement an
   * update, which is why the storage policies cover update as well as insert.
   */
  const path = `${user.id}/${OBJECT}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, output, {
      contentType: "image/webp",
      upsert: true,
      // Safe to cache hard because the URL below is versioned.
      cacheControl: "31536000",
    });

  if (uploadError) {
    return { error: `We could not save that image: ${uploadError.message}` };
  }

  /*
   * The public URL is the same string every time, so a replaced picture would
   * keep serving from cache. The version parameter is what makes the new one
   * appear. profiles_avatar_url_allowed matches on the prefix, so the query
   * string does not upset the constraint.
   */
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const versioned = `${pub.publicUrl}?v=${Date.now()}`;

  const { error: writeError } = await supabase
    .from("profiles")
    .update({ avatar_url: versioned })
    .eq("id", user.id);

  if (writeError) {
    return { error: `We could not save that image: ${writeError.message}` };
  }

  revalidatePath(`/u/${username}`);
  return { error: null };
}

/*
 * Takes neither the previous state nor the form data, and does not need to:
 * useActionState calls it with both, and a function may declare fewer
 * parameters than its caller passes. Declaring them unused only to satisfy the
 * shape is what no-unused-vars is for.
 */
export async function removeAvatar(): Promise<AvatarState> {
  const who = await contributor();
  if (!who.ok) return { error: who.error };
  const { supabase, user, username } = who;

  /*
   * Remove falls back to initials and does not restore the Google picture.
   * That is the point of it: someone removing their photo is asking for no
   * photo, and reverting to the one Google holds would be a different thing.
   */
  const { error: writeError } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);

  if (writeError) {
    return { error: `We could not remove that image: ${writeError.message}` };
  }

  // After the column, so a failed delete cannot leave a row pointing at an
  // object that is gone. A leftover object is harmless: the next upload
  // overwrites it, and nothing links to it.
  await supabase.storage.from(BUCKET).remove([`${user.id}/${OBJECT}`]);

  revalidatePath(`/u/${username}`);
  return { error: null };
}
