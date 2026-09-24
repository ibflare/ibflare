"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteArticle } from "./write/actions";

/**
 * Remove your own article, from the dashboard list.
 *
 * Two steps rather than one, like the video row: removing something you wrote
 * is not a thing to do on a single mis-click. No reason field, because section
 * 4's rule is that an owner removing their own work is editing, while a
 * moderator removing someone else's is a decision that has to be legible in
 * the log. soft_delete_article records `by_owner` either way.
 *
 * Nothing here is a permission. soft_delete_article checks ownership, the
 * moderator capability and the suspension state itself.
 */
export function ArticleRowControls({ articleId }: { articleId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href={`/dashboard/write/${articleId}`}
          className="label text-ink/40 transition-colors hover:text-ink"
        >
          Edit
        </Link>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="label text-ink/40 transition-colors hover:text-hot"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <form action={deleteArticle} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="article_id" value={articleId} />
      <span className="text-sm text-ink/70">Take this article down?</span>
      <button
        type="submit"
        className="label rounded-full bg-hot px-4 py-2.5 text-mist transition-opacity hover:opacity-90"
      >
        Remove
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="label py-2.5 text-ink/55 transition-colors hover:text-ink"
      >
        Cancel
      </button>
    </form>
  );
}
