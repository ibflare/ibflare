"use client";

import { useActionState } from "react";
import { respondToInvite, EMPTY_ACTION } from "./actions";

/**
 * Accept or decline a tag.
 *
 * Two buttons in one form, distinguished by a hidden field the submitter sets,
 * rather than two forms or a client-side branch. The whole decision is one
 * round trip either way and there is nothing to hold in state.
 */
export function InviteResponse({ videoId }: { videoId: string }) {
  const [state, respond, pending] = useActionState(
    respondToInvite,
    EMPTY_ACTION,
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <form action={respond}>
          <input type="hidden" name="video_id" value={videoId} />
          <input type="hidden" name="accept" value="true" />
          <button
            type="submit"
            disabled={pending}
            className="label rounded-full bg-ink px-5 py-2.5 text-mist transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving" : "Accept"}
          </button>
        </form>
        <form action={respond}>
          <input type="hidden" name="video_id" value={videoId} />
          <input type="hidden" name="accept" value="false" />
          <button
            type="submit"
            disabled={pending}
            className="label text-ink/55 transition-colors hover:text-ink disabled:opacity-50"
          >
            Decline
          </button>
        </form>
      </div>

      {state.error && (
        <p role="alert" className="mt-3 text-sm leading-relaxed text-hot">
          {state.error}
        </p>
      )}
    </div>
  );
}
