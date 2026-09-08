"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/action-state";

/**
 * Moderator and sponsor actions. Every one is a definer function call.
 *
 * None of these check a capability here. `soft_delete_video`, `restore_video`,
 * `suspend_user`, `unsuspend_user`, `set_user_permissions` and
 * `set_site_settings` all check their own, and all write their own audit_log
 * row. Checking again in this file would give two places for the rule to live
 * and one of them would eventually be wrong.
 */

async function rpc(
  name: string,
  args: Record<string, unknown>,
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You need to be signed in to do that.", ok: false };

  /*
   * try/catch around the call as well as checking `error`.
   *
   * postgrest-js returns a raised exception in `error` rather than throwing,
   * so the second half is normally what runs. The try is there because
   * anything that does throw out of a server action becomes an unhandled 500
   * with an opaque digest, and the messages these functions raise are written
   * for a student to read. A message on the page beats a digest in a log every
   * time, whichever way the failure arrives.
   */
  try {
    const { error } = await supabase.rpc(name, args);
    if (error) return { error: error.message, ok: false };
    return { error: null, ok: true };
  } catch (thrown) {
    return {
      error: thrown instanceof Error ? thrown.message : "That did not work.",
      ok: false,
    };
  }
}

function refreshAdmin() {
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/admin/log");
}

export async function moderatorDeleteVideo(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const videoId = String(formData.get("video_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!videoId) return { error: "We could not tell which video that was.", ok: false };
  if (!reason) return { error: "Say why, so the log means something later.", ok: false };

  const result = await rpc("soft_delete_video", {
    p_video: videoId,
    p_reason: reason,
  });

  if (result.ok) {
    refreshAdmin();
    revalidatePath("/library");
    revalidatePath(`/v/${videoId}`);
  }
  return result;
}

export async function restoreVideo(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const videoId = String(formData.get("video_id") ?? "");
  if (!videoId) return { error: "We could not tell which video that was.", ok: false };

  const result = await rpc("restore_video", { p_video: videoId });

  if (result.ok) {
    refreshAdmin();
    revalidatePath("/library");
    revalidatePath(`/v/${videoId}`);
  }
  return result;
}

export async function suspendUser(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const targetId = String(formData.get("target_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!targetId) return { error: "We could not tell which account that was.", ok: false };
  if (!reason) return { error: "Suspending someone requires a reason.", ok: false };

  const result = await rpc("suspend_user", {
    p_target: targetId,
    p_reason: reason,
  });

  if (result.ok) {
    revalidatePath("/dashboard/admin/people");
    revalidatePath("/dashboard/admin/log");
  }
  return result;
}

export async function unsuspendUser(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const targetId = String(formData.get("target_id") ?? "");
  if (!targetId) return { error: "We could not tell which account that was.", ok: false };

  const result = await rpc("unsuspend_user", { p_target: targetId });

  if (result.ok) {
    revalidatePath("/dashboard/admin/people");
    revalidatePath("/dashboard/admin/log");
  }
  return result;
}

export async function savePermissions(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const targetId = String(formData.get("target_id") ?? "");
  const role = String(formData.get("role") ?? "");
  const title = String(formData.get("title") ?? "").trim();

  if (!targetId) return { error: "We could not tell which account that was.", ok: false };
  if (!["viewer", "member", "officer", "sponsor"].includes(role)) {
    return { error: "Choose a role.", ok: false };
  }

  const result = await rpc("set_user_permissions", {
    target_id: targetId,
    new_role: role,
    new_title: title || null,
    new_can_post: formData.get("can_post") === "on",
    new_can_moderate: formData.get("can_moderate") === "on",
    new_can_manage_users: formData.get("can_manage_users") === "on",
  });

  if (result.ok) {
    revalidatePath("/dashboard/admin/people");
    revalidatePath("/dashboard/admin/log");
  }
  return result;
}

export async function saveSiteSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await rpc("set_site_settings", {
    p_comments_enabled: formData.get("comments_enabled") === "on",
    p_signups_enabled: formData.get("signups_enabled") === "on",
  });

  if (result.ok) {
    revalidatePath("/dashboard/admin/settings");
    revalidatePath("/dashboard/admin/log");
  }
  return result;
}

/*
 * Phase 5. The report queue's actions.
 *
 * deleteReportedComment and suspendUser are the two an officer reaches for
 * from the queue, and both already exist as definer functions that write their
 * own audit_log row. Suspending from here is the same suspendUser above:
 * section 4 asks for suspend inline on every comment, and inline means the
 * same action rather than a second one with its own rules.
 */

function refreshQueue() {
  revalidatePath("/dashboard/admin/reports");
  revalidatePath("/dashboard/admin/log");
}

export async function resolveReport(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const reportId = String(formData.get("report_id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!reportId) return { error: "We could not tell which report that was.", ok: false };
  if (status !== "resolved" && status !== "dismissed") {
    return { error: "A report is either resolved or dismissed.", ok: false };
  }

  const result = await rpc("resolve_report", {
    p_report: reportId,
    p_status: status,
  });

  if (result.ok) refreshQueue();
  return result;
}

export async function deleteReportedComment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const commentId = String(formData.get("comment_id") ?? "");
  const videoId = String(formData.get("video_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!commentId) return { error: "We could not tell which comment that was.", ok: false };
  if (!reason) return { error: "Say why, so the log means something later.", ok: false };

  const result = await rpc("soft_delete_comment", {
    p_comment: commentId,
    p_reason: reason,
  });

  if (result.ok) {
    refreshQueue();
    if (videoId) revalidatePath(`/v/${videoId}`);
  }
  return result;
}

export async function restoreComment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const commentId = String(formData.get("comment_id") ?? "");
  const videoId = String(formData.get("video_id") ?? "");

  if (!commentId) return { error: "We could not tell which comment that was.", ok: false };

  const result = await rpc("restore_comment", { p_comment: commentId });

  if (result.ok) {
    refreshQueue();
    if (videoId) revalidatePath(`/v/${videoId}`);
  }
  return result;
}
