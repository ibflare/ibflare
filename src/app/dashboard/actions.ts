"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * The contributor's own actions: answering a tag, tagging someone, untagging,
 * and taking a video down.
 *
 * Every one of these is a single RPC. The capability, the ownership, the
 * suspension state and the audit row all live in the definer functions from
 * 20260906000000, so there is nothing to check twice here and nothing that can
 * drift out of step with the database.
 */

export type ActionState = { error: string | null; ok: boolean };

export const EMPTY_ACTION: ActionState = { error: null, ok: false };

async function rpc(
  name: string,
  args: Record<string, unknown>,
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You need to be signed in to do that.", ok: false };

  const { error } = await supabase.rpc(name, args);

  /*
   * The message comes straight from the function. Those messages are written
   * to be read by a student ("That invitation is not open any more"), which is
   * the whole reason the checks live there rather than being duplicated here
   * in two different wordings.
   */
  if (error) return { error: error.message, ok: false };

  return { error: null, ok: true };
}

export async function respondToInvite(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const videoId = String(formData.get("video_id") ?? "");
  const accept = formData.get("accept") === "true";

  if (!videoId) return { error: "We could not tell which video that was.", ok: false };

  const result = await rpc("respond_to_invite", {
    p_video: videoId,
    p_accept: accept,
  });

  if (result.ok) {
    revalidatePath("/dashboard");
    // An accepted tag changes a public byline, so the video page and the
    // library both have stale copies of it.
    revalidatePath("/library");
    revalidatePath(`/v/${videoId}`);
  }

  return result;
}

export async function inviteCollaborator(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const videoId = String(formData.get("video_id") ?? "");
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "");

  if (!videoId) return { error: "We could not tell which video that was.", ok: false };
  if (!username) return { error: "Enter a username.", ok: false };

  const result = await rpc("invite_collaborator", {
    p_video: videoId,
    p_username: username,
  });

  if (result.ok) revalidatePath("/dashboard");
  return result;
}

export async function removeCollaborator(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const videoId = String(formData.get("video_id") ?? "");
  const profileId = String(formData.get("profile_id") ?? "");

  if (!videoId || !profileId) {
    return { error: "We could not tell which tag that was.", ok: false };
  }

  const result = await rpc("remove_collaborator", {
    p_video: videoId,
    p_profile: profileId,
  });

  if (result.ok) {
    revalidatePath("/dashboard");
    revalidatePath("/library");
    revalidatePath(`/v/${videoId}`);
  }

  return result;
}

export async function deleteOwnVideo(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const videoId = String(formData.get("video_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!videoId) return { error: "We could not tell which video that was.", ok: false };

  const result = await rpc("soft_delete_video", {
    p_video: videoId,
    p_reason: reason || null,
  });

  if (result.ok) {
    revalidatePath("/dashboard");
    revalidatePath("/library");
    revalidatePath(`/v/${videoId}`);
  }

  return result;
}
