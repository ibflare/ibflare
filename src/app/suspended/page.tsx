import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";

export const metadata = { title: "Your account is suspended" };

const MAIL = "mailto:ibflarergv@gmail.com";

/**
 * Shown to a suspended user: the reason, the date, and who to contact.
 * Section 7.
 *
 * Not a wall. Section 2 is explicit that a suspended user can still sign in
 * and watch, so nothing redirects here and nothing traps anyone on it. The
 * proxy does not know or care about suspension; this page is reached from the
 * banner, and the restrictions themselves are enforced in the database.
 *
 * An unsuspended visitor is sent to the library rather than shown an empty
 * version of this page, since there is nothing here for them.
 */
export default async function SuspendedPage() {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login?next=/suspended");
  if (!profile.suspended_at) redirect("/library");

  const since = new Date(profile.suspended_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <section>
      <div className="mx-auto max-w-2xl px-6 py-20 sm:py-24">
        <h1 className="font-display text-4xl leading-[1.1] font-medium text-balance sm:text-5xl">
          Your account is suspended
        </h1>

        <dl className="mt-10 space-y-6 border-y border-ink/10 py-8">
          <div>
            <dt className="label text-ink/45">Since</dt>
            <dd className="mt-2">{since}</dd>
          </div>
          {profile.suspension_reason && (
            <div>
              <dt className="label text-ink/45">Reason given</dt>
              <dd className="mt-2 leading-relaxed">
                {profile.suspension_reason}
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-10 space-y-5 leading-relaxed text-ink/75">
          <p>
            You can still sign in and watch everything in the library. You
            cannot publish a video, be tagged on someone else&rsquo;s, or change
            your profile.
          </p>
          <p>
            Videos you already published are still up. They are removed only if
            an officer removes them separately.
          </p>
          <p>
            If you think this is a mistake, talk to an officer or the faculty
            sponsor in person, or email{" "}
            <a
              href={MAIL}
              className="underline decoration-ink/30 underline-offset-4 transition-colors hover:decoration-ink"
            >
              ibflarergv@gmail.com
            </a>
            . A suspension can be lifted by a sponsor.
          </p>
        </div>

        <div className="mt-12 flex flex-wrap gap-4">
          <Link
            href="/library"
            className="label rounded-full bg-ink px-7 py-4 text-mist transition-opacity hover:opacity-90"
          >
            Browse the library
          </Link>
          <Link
            href={`/u/${profile.username}`}
            className="label rounded-full border border-ink/25 px-7 py-4 text-ink transition-colors hover:border-ink"
          >
            Your profile
          </Link>
        </div>
      </div>
    </section>
  );
}
