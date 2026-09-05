"use client";

import { useActionState, useState } from "react";
import { clearUserAvatar, type AvatarState } from "./actions";

const EMPTY: AvatarState = { error: null };

/**
 * A moderator's route to taking a bad profile picture down.
 *
 * It lives on the profile page rather than in an admin queue because there is
 * no admin surface yet: phase 4 builds /dashboard/admin, and until then the
 * page the image is on is the only place a moderator would think to look.
 *
 * Remove only, never replace. A moderator setting someone else's picture would
 * be a different power, and clear_avatar() in the database does not offer it.
 *
 * Confirmation is a second click rather than a browser confirm(): it is
 * someone else's account, and the action writes an audit_log row with the
 * moderator's name on it.
 */
export function ModeratorAvatarControl({
  targetId,
  targetUsername,
  displayName,
}: {
  targetId: string;
  targetUsername: string;
  displayName: string;
}) {
  const [state, clear, clearing] = useActionState(clearUserAvatar, EMPTY);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="mt-6">
      {confirming ? (
        <form action={clear} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="target_id" value={targetId} />
          <input type="hidden" name="target_username" value={targetUsername} />
          <span className="text-sm text-ink/70">
            Remove {displayName}&rsquo;s picture?
          </span>
          <button
            type="submit"
            disabled={clearing}
            className="label rounded-full bg-hot px-5 py-2.5 text-mist transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {clearing ? "Removing" : "Remove"}
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
          className="label text-ink/45 underline decoration-ink/25 underline-offset-4 transition-colors hover:text-ink"
        >
          Remove this picture
        </button>
      )}

      {state.error && (
        <p role="alert" className="mt-3 max-w-sm text-sm leading-relaxed text-hot">
          {state.error}
        </p>
      )}
    </div>
  );
}
