import Link from "next/link";
import { getCurrentProfile } from "@/lib/supabase/server";
import { ArticleForm } from "./ArticleForm";

export const metadata = {
  title: "Write an article",
};

/**
 * Writing an article. The prose counterpart to /dashboard/upload, gated on the
 * same capability and structured the same way.
 *
 * A child of the dashboard layout, so this returns a fragment starting at an
 * h2 rather than its own section and heading.
 *
 * The capability check here is a display decision. The insert policy on
 * articles checks can_post, the suspension state and the wordlist itself, so
 * the form being absent is not what enforces anything.
 */
export default async function WritePage() {
  const profile = await getCurrentProfile();

  if (!profile) return null;

  // Suspension first, for the same reason the upload page puts it first: it is
  // the more specific answer, and the other message reads as a permissions
  // problem to take to a sponsor.
  if (profile.suspended_at) {
    return (
      <div className="max-w-2xl">
        <h2 className="font-display text-2xl leading-snug font-medium">
          You cannot publish while your account is suspended
        </h2>
        <p className="mt-4 leading-relaxed text-ink/75">
          Everything you have already published is still up.
        </p>
        <Link
          href="/suspended"
          className="label mt-8 inline-block rounded-full border border-ink/25 px-6 py-3.5 transition-colors hover:border-ink"
        >
          What this means
        </Link>
      </div>
    );
  }

  if (!profile.can_post) {
    return (
      <div className="max-w-2xl">
        <h2 className="font-display text-2xl leading-snug font-medium">
          Publishing is not enabled for your account
        </h2>
        <p className="mt-4 leading-relaxed text-ink/75">
          A sponsor turns this on per person. Ask an officer or the faculty
          sponsor if you are joining as a contributor.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/library"
            className="label rounded-full bg-ink px-6 py-3.5 text-mist transition-opacity hover:opacity-90"
          >
            Browse the library
          </Link>
          <Link
            href="/contribute"
            className="label rounded-full border border-ink/25 px-6 py-3.5 text-ink transition-colors hover:border-ink"
          >
            How to contribute
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-2xl leading-snug font-medium">
        Write an article
      </h2>
      <p className="mt-4 leading-relaxed text-ink/75">
        An article sits in the library beside the videos, under the same level
        and topic. Write it for someone at that level who has not read the rest.
      </p>

      <ArticleForm />
    </div>
  );
}
