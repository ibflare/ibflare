import Link from "next/link";
import { getCurrentProfile } from "@/lib/supabase/server";
import { UploadForm } from "./UploadForm";

export const metadata = {
  title: "Publish a video",
};

/**
 * The upload form. CLAUDE.md section 7 puts it at /dashboard/upload, gated on
 * can_post.
 *
 * A child of the dashboard layout, which handles the sign-in and onboarding
 * redirects and renders the heading and tab nav. So this returns a fragment
 * rather than its own <section> and starts at an h2: two page headings and two
 * width wrappers is what it looked like before the layout existed.
 *
 * The capability check here is a display decision. The insert policy on videos
 * checks can_post and the suspension state itself, so the form being absent is
 * not what enforces anything.
 */
export default async function UploadPage() {
  const profile = await getCurrentProfile();

  // The layout has already redirected anyone without a profile.
  if (!profile) return null;

  /*
   * Suspension first, because it is the more specific answer. Telling a
   * suspended contributor that "publishing is not enabled for your account"
   * would be true and useless: it reads as a permissions problem to take to a
   * sponsor rather than as the suspension they already know about.
   */
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
            How to post a video
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-2xl leading-snug font-medium">
        Publish a video
      </h2>
      <p className="mt-4 leading-relaxed text-ink/75">
        Paste the link and FLARE reads the title, thumbnail and length from
        YouTube. Set the visibility to Unlisted or Public first, or the link
        will not resolve.
      </p>

      <UploadForm />
    </div>
  );
}
