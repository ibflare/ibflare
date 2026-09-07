"use client";

import { useActionState, useState } from "react";
import { moderatorDeleteVideo, restoreVideo } from "./actions";
import { EMPTY_ACTION } from "@/lib/action-state";

/**
 * Delete with a reason, or restore.
 *
 * The reason field is required and the button stays disabled without it. It
 * ends up in the audit_log row, and a log full of deletions with no reason is
 * the state this whole table exists to avoid: six months later nobody can tell
 * a spam removal from a disagreement.
 */
export function VideoModeration({
  videoId,
  deleted,
}: {
  videoId: string;
  deleted: boolean;
}) {
  const [del, deleteAction, deleting] = useActionState(
    moderatorDeleteVideo,
    EMPTY_ACTION,
  );
  const [res, restoreAction, restoring] = useActionState(
    restoreVideo,
    EMPTY_ACTION,
  );
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const error = del.error ?? res.error;

  if (deleted) {
    return (
      <div>
        <form action={restoreAction}>
          <input type="hidden" name="video_id" value={videoId} />
          <button
            type="submit"
            disabled={restoring}
            className="label rounded-full border border-ink/25 px-4 py-2.5 transition-colors hover:border-ink disabled:opacity-50"
          >
            {restoring ? "Restoring" : "Restore"}
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-2 text-sm text-hot">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      {open ? (
        <form action={deleteAction} className="flex flex-wrap items-start gap-2">
          <input type="hidden" name="video_id" value={videoId} />
          <input
            name="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this coming down?"
            aria-label="Reason"
            maxLength={200}
            className="min-w-0 flex-1 rounded-lg border border-ink/25 bg-paper px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={deleting || reason.trim().length === 0}
            className="label shrink-0 rounded-full bg-hot px-4 py-2.5 text-mist transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {deleting ? "Removing" : "Remove"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="label shrink-0 py-2.5 text-ink/55 transition-colors hover:text-ink"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="label text-ink/45 underline decoration-ink/20 underline-offset-4 transition-colors hover:text-hot"
        >
          Remove
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-hot">
          {error}
        </p>
      )}
    </div>
  );
}
