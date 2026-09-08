"use client";

import { useActionState, useRef, useEffect } from "react";
import { postComment } from "./actions";
import { EMPTY_ACTION } from "@/lib/action-state";

const MAX = 1000;

/**
 * The box for writing a comment.
 *
 * A plain textarea and a button. The filter runs on the server, so nothing
 * here tries to pre-empt it: telling somebody in the browser which word was
 * refused is a hint about the list, and the list is not a secret worth
 * keeping but it is not worth publishing either.
 */
export function CommentForm({ videoId }: { videoId: string }) {
  const [state, post, posting] = useActionState(postComment, EMPTY_ACTION);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the box only once the server has accepted it. Clearing on submit
  // would throw away what somebody wrote whenever the filter refuses it.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={post} className="mt-6">
      <input type="hidden" name="video_id" value={videoId} />
      <label htmlFor="comment-body" className="label block text-ink/60">
        Add a comment
      </label>
      <textarea
        id="comment-body"
        name="body"
        rows={3}
        maxLength={MAX}
        required
        aria-describedby={state.error ? "comment-error" : undefined}
        className="mt-3 w-full resize-y rounded-lg border border-ink/25 bg-paper px-4 py-3 leading-relaxed text-ink"
      />

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={posting}
          className="label rounded-full bg-ink px-6 py-3.5 text-mist transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {posting ? "Posting" : "Post"}
        </button>
        <span className="text-sm text-ink/50">
          Your name and picture show with it.
        </span>
      </div>

      {state.error && (
        <p
          id="comment-error"
          role="alert"
          className="mt-3 text-sm leading-relaxed text-hot"
        >
          {state.error}
        </p>
      )}
    </form>
  );
}
