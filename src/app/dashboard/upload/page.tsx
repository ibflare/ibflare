import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";
import { UploadForm } from "./UploadForm";

export const metadata = {
  title: "Publish a video",
};

/**
 * The upload form. CLAUDE.md section 7 puts it at /dashboard/upload, gated on
 * can_post.
 *
 * The proxy already sends signed-out visitors to /login for anything under
 * /dashboard, so the check here is the capability rather than the session. It
 * is a display decision either way: the insert policy on videos checks
 * can_post and the suspension state itself.
 *
 * Note /dashboard itself does not exist yet, so this page is reached from
 * /contribute or by URL until phase 4 builds the index around it.
 */
export default async function UploadPage() {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login?next=/dashboard/upload");
  if (!profile.onboarded) redirect("/onboarding");

  if (!profile.can_post) {
    return (
      <section>
        <div className="mx-auto max-w-2xl px-6 py-20 sm:py-24">
          <h1 className="font-display text-4xl leading-[1.1] font-medium text-balance sm:text-5xl">
            Publishing is not enabled for your account
          </h1>
          <p className="mt-8 leading-relaxed text-ink/75">
            A sponsor turns this on per person. Ask an officer or the faculty
            sponsor if you are joining as a contributor.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/library"
              className="label rounded-full bg-ink px-7 py-4 text-mist transition-opacity hover:opacity-90"
            >
              Browse the library
            </Link>
            <Link
              href="/contribute"
              className="label rounded-full border border-ink/25 px-7 py-4 text-ink transition-colors hover:border-ink"
            >
              How to post a video
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mx-auto max-w-2xl px-6 py-20 sm:py-24">
        <h1 className="font-display text-4xl leading-[1.1] font-medium text-balance sm:text-5xl">
          Publish a video
        </h1>
        <p className="mt-8 leading-relaxed text-ink/75">
          Paste the link and FLARE reads the title, thumbnail and length from
          YouTube. Set the visibility to Unlisted or Public first, or the link
          will not resolve.
        </p>

        <UploadForm />
      </div>
    </section>
  );
}
