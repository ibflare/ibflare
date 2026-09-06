"use client";

import { useActionState, useState } from "react";
import {
  inviteCollaborator,
  removeCollaborator,
  deleteOwnVideo,
  EMPTY_ACTION,
} from "./actions";

type Person = { profile_id: string; display_name: string; status: string };

/**
 * The owner's controls on one of their own videos: who is tagged, and taking
 * it down.
 *
 * Collapsed behind a disclosure by default. A contributor with a dozen videos
 * is looking at a list of titles, and a tag editor plus a delete button opened
 * on every row at once turns that list into a wall of forms.
 */
export function VideoRowControls({
  videoId,
  collaborators,
}: {
  videoId: string;
  collaborators: Person[];
}) {
  const [open, setOpen] = useState(false);
  const [invite, inviteAction, inviting] = useActionState(
    inviteCollaborator,
    EMPTY_ACTION,
  );
  const [remove, removeAction] = useActionState(removeCollaborator, EMPTY_ACTION);
  const [del, deleteAction, deleting] = useActionState(
    deleteOwnVideo,
    EMPTY_ACTION,
  );
  const [confirming, setConfirming] = useState(false);

  const error = invite.error ?? remove.error ?? del.error;

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="label text-ink/45 underline decoration-ink/20 underline-offset-4 transition-colors hover:text-ink"
      >
        {open ? "Done" : "Tags and removal"}
      </button>

      {open && (
        <div className="mt-4 space-y-5 rounded-lg border border-ink/12 bg-paper-deep/40 p-5">
          <div>
            <p className="label text-ink/45">Tagged</p>
            {collaborators.length === 0 ? (
              <p className="mt-2 text-sm text-ink/55">Nobody yet.</p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                {collaborators.map((person) => (
                  <li key={person.profile_id}>
                    <form action={removeAction} className="contents">
                      <input type="hidden" name="video_id" value={videoId} />
                      <input
                        type="hidden"
                        name="profile_id"
                        value={person.profile_id}
                      />
                      <span className="flex items-center gap-2 rounded-full border border-ink/20 py-1.5 pr-2 pl-3.5 text-sm">
                        {person.display_name}
                        {/*
                          Pending is shown to the owner and nobody else, per
                          section 3, so they can tell "waiting" from "declined"
                          rather than wondering why a byline has not changed.
                        */}
                        {person.status !== "accepted" && (
                          <span className="label text-ink/40">
                            {person.status}
                          </span>
                        )}
                        <button
                          type="submit"
                          aria-label={`Remove ${person.display_name}`}
                          className="rounded-full px-1.5 text-ink/45 transition-colors hover:text-hot"
                        >
                          &times;
                        </button>
                      </span>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form action={inviteAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="video_id" value={videoId} />
            <input
              name="username"
              type="text"
              placeholder="username"
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-lg border border-ink/25 bg-paper px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={inviting}
              className="label shrink-0 rounded-full border border-ink/25 px-4 py-2.5 transition-colors hover:border-ink disabled:opacity-50"
            >
              {inviting ? "Tagging" : "Tag"}
            </button>
          </form>

          <div className="border-t border-ink/10 pt-4">
            {confirming ? (
              <form action={deleteAction} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="video_id" value={videoId} />
                <input type="hidden" name="reason" value="Removed by the owner." />
                <span className="text-sm text-ink/70">
                  Take this video down?
                </span>
                <button
                  type="submit"
                  disabled={deleting}
                  className="label rounded-full bg-hot px-5 py-2.5 text-mist transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {deleting ? "Removing" : "Remove"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="label text-ink/55 transition-colors hover:text-ink"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="label text-ink/45 underline decoration-ink/20 underline-offset-4 transition-colors hover:text-hot"
              >
                Take this video down
              </button>
            )}
            {/*
              Says recoverable because it is: the row keeps its history and an
              officer can restore it. Saying "permanently" would be a lie, and
              a contributor who believes it will not ask for it back.
            */}
            <p className="mt-3 text-xs leading-relaxed text-ink/45">
              It disappears from the library straight away. An officer can put
              it back.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm leading-relaxed text-hot">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
