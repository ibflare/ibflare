"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  resolveReport,
  deleteReportedComment,
  restoreComment,
  suspendUser,
} from "../actions";
import { EMPTY_ACTION } from "@/lib/action-state";

export type QueueRow = {
  report_id: string;
  report_reason: string | null;
  report_status: string;
  reported_at: string;
  reporter_name: string | null;
  comment_id: string;
  comment_body: string;
  comment_created_at: string;
  comment_deleted: boolean;
  video_id: string;
  video_title: string;
  author_id: string;
  author_username: string;
  author_display_name: string;
  author_suspended: boolean;
  author_report_count: number;
  author_blocked_count: number;
  author_deleted_count: number;
};

/**
 * One report in the officer queue.
 *
 * Section 4 asks for the comment, the author, and their history, with delete
 * and suspend reachable inline. All four actions are here rather than on
 * separate pages, because the decision an officer is making is a single one:
 * having read the comment, is this a misunderstanding, a bad day, or a
 * pattern. Making them navigate to answer it loses the context they just read.
 *
 * The history is three counts, not a transcript. What matters before acting is
 * whether this is the first time.
 */
export function ReportRow({ row }: { row: QueueRow }) {
  const [resolveState, resolve, resolving] = useActionState(
    resolveReport,
    EMPTY_ACTION,
  );
  const [delState, remove, removing] = useActionState(
    deleteReportedComment,
    EMPTY_ACTION,
  );
  const [restoreState, restore, restoring] = useActionState(
    restoreComment,
    EMPTY_ACTION,
  );
  const [suspendState, suspend, suspending] = useActionState(
    suspendUser,
    EMPTY_ACTION,
  );

  const [open, setOpen] = useState<"delete" | "suspend" | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [suspendReason, setSuspendReason] = useState("");

  const error =
    resolveState.error ?? delState.error ?? restoreState.error ?? suspendState.error;

  const repeat =
    row.author_report_count > 1 ||
    row.author_blocked_count > 0 ||
    row.author_deleted_count > 0;

  return (
    <li className="rounded-2xl border border-ink/15 p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="label text-ink/35">
          {new Date(row.reported_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
        {row.report_status !== "open" && (
          <span className="label text-ink/40">{row.report_status}</span>
        )}
        {row.comment_deleted && (
          <span className="label text-hot">comment deleted</span>
        )}
        {row.author_suspended && (
          <span className="label text-hot">author suspended</span>
        )}
      </div>

      {/*
        The comment itself, quoted. An officer has to read the words to decide,
        and sending them to the video page to find it among thirty others is
        how a queue stops being used.
      */}
      <blockquote className="mt-3 border-l-2 border-ink/20 pl-4">
        <p className="leading-relaxed whitespace-pre-line text-ink/80">
          {row.comment_body}
        </p>
      </blockquote>

      <p className="mt-3 text-sm text-ink/55">
        <Link
          href={`/u/${row.author_username}`}
          className="font-medium text-ink/75 transition-colors hover:text-ink"
        >
          {row.author_display_name}
        </Link>
        {" on "}
        <Link
          href={`/v/${row.video_id}`}
          className="transition-colors hover:text-ink"
        >
          {row.video_title}
        </Link>
      </p>

      <p className="mt-1.5 text-sm text-ink/45">
        Reported by {row.reporter_name ?? "a member"}
        {row.report_reason ? `: ${row.report_reason}` : "."}
      </p>

      {/*
        History. Shown only when there is something to say: a first offence
        with three zeroes beside it reads as an accusation.
      */}
      {repeat && (
        <p className="mt-3 rounded-lg border border-ember/50 bg-ember/10 px-4 py-2.5 text-sm leading-relaxed">
          This account has {row.author_report_count} reported{" "}
          {row.author_report_count === 1 ? "comment" : "comments"},{" "}
          {row.author_deleted_count} deleted, and {row.author_blocked_count}{" "}
          blocked before posting.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm leading-relaxed text-hot">
          {error}
        </p>
      )}

      {open === null && (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {row.report_status === "open" && (
            <>
              <form action={resolve}>
                <input type="hidden" name="report_id" value={row.report_id} />
                <input type="hidden" name="status" value="dismissed" />
                <button
                  type="submit"
                  disabled={resolving}
                  className="label rounded-full border border-ink/25 px-5 py-2.5 transition-colors hover:border-ink disabled:opacity-50"
                >
                  Nothing wrong with it
                </button>
              </form>
              <form action={resolve}>
                <input type="hidden" name="report_id" value={row.report_id} />
                <input type="hidden" name="status" value="resolved" />
                <button
                  type="submit"
                  disabled={resolving}
                  className="label text-ink/45 transition-colors hover:text-ink disabled:opacity-50"
                >
                  Handled elsewhere
                </button>
              </form>
            </>
          )}

          {!row.comment_deleted ? (
            <button
              type="button"
              onClick={() => setOpen("delete")}
              className="label text-ink/45 transition-colors hover:text-hot"
            >
              Delete the comment
            </button>
          ) : (
            <form action={restore}>
              <input type="hidden" name="comment_id" value={row.comment_id} />
              <input type="hidden" name="video_id" value={row.video_id} />
              <button
                type="submit"
                disabled={restoring}
                className="label text-ink/45 transition-colors hover:text-ink disabled:opacity-50"
              >
                {restoring ? "Restoring" : "Put it back"}
              </button>
            </form>
          )}

          {!row.author_suspended && (
            <button
              type="button"
              onClick={() => setOpen("suspend")}
              className="label text-ink/45 transition-colors hover:text-hot"
            >
              Suspend the author
            </button>
          )}
        </div>
      )}

      {open === "delete" && (
        <form action={remove} className="mt-4 flex flex-wrap items-center gap-2">
          <input type="hidden" name="comment_id" value={row.comment_id} />
          <input type="hidden" name="video_id" value={row.video_id} />
          <input
            name="reason"
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            placeholder="Why is this coming down?"
            aria-label="Reason for deleting"
            maxLength={300}
            className="min-w-0 flex-1 rounded-lg border border-ink/25 bg-paper px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={removing || deleteReason.trim().length === 0}
            className="label shrink-0 rounded-full bg-hot px-4 py-2.5 text-mist transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {removing ? "Deleting" : "Delete"}
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

      {open === "suspend" && (
        <form action={suspend} className="mt-4 space-y-3">
          <input type="hidden" name="target_id" value={row.author_id} />
          <input
            name="reason"
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            placeholder={`Why is ${row.author_display_name} being suspended?`}
            aria-label="Reason for suspending"
            maxLength={300}
            className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2 text-sm"
          />
          <p className="text-sm leading-relaxed text-ink/55">
            They can still sign in and watch. They cannot comment, publish, be
            tagged, or edit their profile. Their existing videos and comments
            stay up unless you remove them separately.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={suspending || suspendReason.trim().length === 0}
              className="label rounded-full bg-hot px-5 py-2.5 text-mist transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {suspending ? "Suspending" : "Suspend"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="label text-ink/55 transition-colors hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
