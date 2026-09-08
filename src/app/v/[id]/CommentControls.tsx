"use client";

import { useActionState, useState } from "react";
import { deleteComment, editComment, reportComment } from "./actions";
import { EMPTY_ACTION } from "@/lib/action-state";

/**
 * Report, edit and delete, under one comment.
 *
 * Which of the three appear is decided by the server component that renders
 * this, from the viewer's own row. Nothing here is a permission: the report
 * function refuses your own comment, the edit policy enforces the five
 * minutes, and soft_delete_comment checks ownership and can_moderate.
 *
 * Every control opens into a small inline form rather than a dialog. A
 * confirm() cannot carry a reason field, and both deleting as a moderator and
 * reporting want one.
 */
export function CommentControls({
  commentId,
  videoId,
  body,
  canEdit,
  canDelete,
  canReport,
  moderating,
}: {
  commentId: string;
  videoId: string;
  body: string;
  canEdit: boolean;
  canDelete: boolean;
  canReport: boolean;
  /** True when the viewer is deleting somebody else's comment as a moderator. */
  moderating: boolean;
}) {
  const [report, reportAction, reporting] = useActionState(
    reportComment,
    EMPTY_ACTION,
  );
  const [del, deleteAction, deleting] = useActionState(
    deleteComment,
    EMPTY_ACTION,
  );
  const [edit, editAction, editing] = useActionState(editComment, EMPTY_ACTION);

  const [open, setOpen] = useState<"report" | "delete" | "edit" | null>(null);
  const [reason, setReason] = useState("");

  const error = report.error ?? del.error ?? edit.error;
  const reported = report.ok && !report.error;

  if (open === "edit") {
    return (
      <form action={editAction} className="mt-3">
        <input type="hidden" name="comment_id" value={commentId} />
        <input type="hidden" name="video_id" value={videoId} />
        <textarea
          name="body"
          rows={3}
          maxLength={1000}
          defaultValue={body}
          required
          className="w-full resize-y rounded-lg border border-ink/25 bg-paper px-4 py-3 text-sm leading-relaxed"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={editing}
            className="label rounded-full bg-ink px-5 py-2.5 text-mist transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {editing ? "Saving" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(null)}
            className="label text-ink/55 transition-colors hover:text-ink"
          >
            Cancel
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-hot">
            {error}
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="mt-2">
      {open === null && (
        <div className="flex flex-wrap items-center gap-4">
          {canEdit && (
            <button
              type="button"
              onClick={() => setOpen("edit")}
              className="label text-ink/40 transition-colors hover:text-ink"
            >
              Edit
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => setOpen("delete")}
              className="label text-ink/40 transition-colors hover:text-hot"
            >
              Delete
            </button>
          )}
          {canReport && !reported && (
            <button
              type="button"
              onClick={() => setOpen("report")}
              className="label text-ink/40 transition-colors hover:text-ink"
            >
              Report
            </button>
          )}
          {reported && (
            <span className="label text-ink/40">
              Reported. An officer will look at it
            </span>
          )}
        </div>
      )}

      {open === "report" && (
        <form action={reportAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="comment_id" value={commentId} />
          <input
            name="reason"
            placeholder="What is wrong with it? (optional)"
            aria-label="Reason for reporting"
            maxLength={300}
            className="min-w-0 flex-1 rounded-lg border border-ink/25 bg-paper px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={reporting}
            onClick={() => setOpen(null)}
            className="label shrink-0 rounded-full border border-ink/25 px-4 py-2.5 transition-colors hover:border-ink disabled:opacity-50"
          >
            {reporting ? "Sending" : "Report"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(null)}
            className="label shrink-0 py-2.5 text-ink/55 transition-colors hover:text-ink"
          >
            Cancel
          </button>
        </form>
      )}

      {open === "delete" && (
        <form action={deleteAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="comment_id" value={commentId} />
          <input type="hidden" name="video_id" value={videoId} />
          {/*
            A moderator removing somebody else's comment gives a reason, and it
            is copied into audit_log with the body and the author. Somebody
            deleting their own writes no record at all, so there is nothing to
            explain and no field to fill.
          */}
          {moderating ? (
            <input
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this coming down?"
              aria-label="Reason"
              maxLength={300}
              className="min-w-0 flex-1 rounded-lg border border-ink/25 bg-paper px-3 py-2 text-sm"
            />
          ) : (
            <span className="text-sm text-ink/70">Delete this comment?</span>
          )}
          <button
            type="submit"
            disabled={deleting || (moderating && reason.trim().length === 0)}
            className="label shrink-0 rounded-full bg-hot px-4 py-2.5 text-mist transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {deleting ? "Deleting" : "Delete"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(null)}
            className="label shrink-0 py-2.5 text-ink/55 transition-colors hover:text-ink"
          >
            Cancel
          </button>
        </form>
      )}

      {error && open === null && (
        <p role="alert" className="mt-2 text-sm text-hot">
          {error}
        </p>
      )}
    </div>
  );
}
