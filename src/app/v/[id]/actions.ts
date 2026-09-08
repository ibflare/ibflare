"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkComment } from "@/lib/moderation";
import type { ActionState, CommentState } from "@/lib/action-state";

/**
 * Posting, editing, deleting and reporting a comment.
 *
 * The moderation filter runs here, in the application, because that is where
 * the wordlist lives. Everything that must hold regardless, the capability,
 * the suspension, the kill switch and the rate limit, is in the insert policy
 * from 20260908000000. Section 4 is explicit that the filter is the smallest
 * part of the system, so this split is the design rather than a shortcut.
 */

const RATE_LIMIT = 5;

/**
 * Why the pre-checks exist.
 *
 * The insert policy enforces all of this, but a policy that refuses tells you
 * only "new row violates row-level security policy", which is true and useless
 * to a fifteen-year-old who has been told to try again in a minute. Reading
 * the same conditions first is what turns each refusal into a sentence. The
 * policy is still what enforces them; this only decides what to say.
 */
async function whyNot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const [{ data: profile }, { data: settings }, { data: recent }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("onboarded, suspended_at")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("site_settings").select("comments_enabled").eq("id", 1).maybeSingle(),
      supabase.rpc("recent_comment_count"),
    ]);

  if (!profile) return "We could not find your profile.";
  if (!profile.onboarded) return "Finish setting up your account first.";
  if (profile.suspended_at) {
    return "Your account is suspended, so you cannot comment.";
  }
  if (settings && settings.comments_enabled === false) {
    return "Comments are turned off right now.";
  }
  if (typeof recent === "number" && recent >= RATE_LIMIT) {
    return "You are posting a bit fast. Wait a minute and try again.";
  }

  return null;
}

/** A fresh token per result, so the textarea remounts with the right text. */
function commentState(
  error: string | null,
  body: string,
): CommentState {
  return { error, ok: error === null, body: error === null ? "" : body, token: crypto.randomUUID() };
}

export async function postComment(
  _prev: CommentState,
  formData: FormData,
): Promise<CommentState> {
  const videoId = String(formData.get("video_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!videoId) return commentState("We could not tell which video that was.", body);
  if (!body) return commentState("Write something first.", body);
  if (body.length > 1000) {
    return commentState("That is too long. Keep it under 1000 characters.", body);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return commentState("Sign in to comment.", body);

  const blocked = await whyNot(supabase, user.id);
  if (blocked) return commentState(blocked, body);

  /*
   * The filter, before anything is written. A refused comment is not stored:
   * section 4 says nothing is kept for tier one, and for tier two the only
   * record is the audit_log row written below.
   */
  const verdict = checkComment(body);

  if (!verdict.ok) {
    if (verdict.tier === "slur") {
      /*
       * Section 4's second tier. Written even though the comment was refused,
       * because "this account tried three times this week" is the thing an
       * officer needs and there is no comment row to point at.
       *
       * Deliberately not awaited-and-checked: if the log write fails the
       * refusal still stands, and telling the author that the logging failed
       * would be both confusing and an invitation.
       */
      await supabase.rpc("flag_blocked_comment", {
        p_video: videoId,
        p_body: body,
        p_tier: "slur",
      });
    }

    return commentState(verdict.message, body);
  }

  const { error } = await supabase.from("comments").insert({
    video_id: videoId,
    author_id: user.id,
    body,
  });

  if (error) {
    /*
     * whyNot has already covered every condition the policy checks, so a
     * refusal here means the state changed between the two, most likely the
     * rate limit filling up. Naming the likely cause beats echoing the
     * Postgres text.
     */
    const rls = error.message.includes("row-level security");
    return commentState(
      rls
        ? "That did not go through. Wait a moment and try again."
        : `That did not go through: ${error.message}`,
      body,
    );
  }

  revalidatePath(`/v/${videoId}`);
  return commentState(null, body);
}

export async function editComment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const commentId = String(formData.get("comment_id") ?? "");
  const videoId = String(formData.get("video_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!commentId) return { error: "We could not tell which comment that was.", ok: false };
  if (!body) return { error: "Write something first.", ok: false };
  if (body.length > 1000) {
    return { error: "That is too long. Keep it under 1000 characters.", ok: false };
  }

  const verdict = checkComment(body);
  if (!verdict.ok) return { error: verdict.message, ok: false };

  const supabase = await createClient();
  const { error } = await supabase
    .from("comments")
    .update({ body })
    .eq("id", commentId);

  if (error) {
    return { error: `That did not save: ${error.message}`, ok: false };
  }

  /*
   * A zero-row update is what the five-minute policy produces, and PostgREST
   * reports it as success. Read it back rather than claiming it saved.
   */
  const { data: check } = await supabase
    .from("comments")
    .select("body")
    .eq("id", commentId)
    .maybeSingle();

  if (check && check.body !== body) {
    return {
      error: "The five minutes to edit a comment have passed.",
      ok: false,
    };
  }

  revalidatePath(`/v/${videoId}`);
  return { error: null, ok: true };
}

export async function deleteComment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const commentId = String(formData.get("comment_id") ?? "");
  const videoId = String(formData.get("video_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!commentId) return { error: "We could not tell which comment that was.", ok: false };

  const supabase = await createClient();
  const { error } = await supabase.rpc("soft_delete_comment", {
    p_comment: commentId,
    p_reason: reason || null,
  });

  if (error) return { error: error.message, ok: false };

  revalidatePath(`/v/${videoId}`);
  revalidatePath("/dashboard/admin/reports");
  return { error: null, ok: true };
}

export async function reportComment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const commentId = String(formData.get("comment_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!commentId) return { error: "We could not tell which comment that was.", ok: false };

  const supabase = await createClient();
  const { error } = await supabase.rpc("report_comment", {
    p_comment: commentId,
    p_reason: reason || null,
  });

  if (error) return { error: error.message, ok: false };

  revalidatePath("/dashboard/admin/reports");
  return { error: null, ok: true };
}
