"use client";

import { useActionState } from "react";
import { postComment } from "./actions";
import { EMPTY_COMMENT } from "@/lib/action-state";

const MAX = 1000;

/**
 * The box for writing a comment.
 *
 * The textarea is keyed on state.token, and that is the whole trick.
 *
 * React resets an uncontrolled form after an action submits, whether the
 * action succeeded or not. The first version of this tried to clear the box
 * from an effect on success and let a failure keep the text; the reset happens
 * regardless, so a comment refused by the filter lost everything the person
 * had written, which is the worst moment to lose it. They have to retype the
 * lot to change one word.
 *
 * The action now echoes the submitted body back on failure and an empty string
 * on success, and a fresh token each time. Keying the textarea on the token
 * remounts it, which is what makes the new defaultValue apply at all: changing
 * defaultValue does nothing to an input that is already mounted.
 *
 * Nothing here tries to pre-empt the filter. Telling somebody in the browser
 * which word was refused is a hint about the list, and the list is not worth
 * publishing.
 */
export function CommentForm({ videoId }: { videoId: string }) {
  const [state, post, posting] = useActionState(postComment, EMPTY_COMMENT);

  return (
    <form action={post} className="mt-6">
      <input type="hidden" name="video_id" value={videoId} />
      <label htmlFor="comment-body" className="label block text-ink/60">
        Add a comment
      </label>
      <textarea
        key={state.token}
        id="comment-body"
        name="body"
        rows={3}
        maxLength={MAX}
        required
        defaultValue={state.body}
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
