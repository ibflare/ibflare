import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { HeaderAuthControl } from "./HeaderAuthControl";
import { MobileNav } from "./MobileNav";

/**
 * The nav depends on whether you are signed in.
 *
 *   signed out  Library, Our mission, then Sign in
 *   signed in   Library, Contribute, Dashboard*, Profile, then Sign out
 *
 * Our mission is for people deciding whether FLARE is worth their time, which
 * is not a question a signed-in member still has. Contribute is instructions
 * for publishing, which is not useful to someone who cannot publish yet.
 * Neither appears in the other state.
 *
 * *Dashboard only for an account holding can_post, can_moderate or
 * can_manage_users. See the capability note below.
 */
const NAV_SIGNED_OUT = [
  { href: "/library", label: "Library" },
  { href: "/our-mission", label: "Our mission" },
];

const NAV_SIGNED_IN = [
  { href: "/library", label: "Library" },
  { href: "/contribute", label: "Contribute" },
];

/**
 * Profile is back, as a fourth item for signed-in accounts only.
 *
 * It was dropped when the nav split by session, which left a member with no
 * route from the chrome to their own profile: the page their picture upload
 * lives on, and the page phase 4's moderator control sits on. It needs the
 * username, so the header pays for one profile lookup per signed-in request
 * again, and now uses the same row for the suspension banner rather than
 * querying twice.
 */

/**
 * Uses FLARE_WORDMARK.png, the full lockup cropped to just the wordmark
 * (generated from FLARE_LOGO.png with the tagline band removed). The tagline
 * in the full logo is ~25px tall in a 724px-tall file, so at header height it
 * renders as illegible mush. The full lockup belongs somewhere it has room.
 */
export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let username: string | null = null;
  let suspended = false;
  let hasDashboard = false;

  if (user) {
    /*
     * The base table, not public_profiles, because suspended_at and the
     * capability flags are not in the view and should not be: they are nobody
     * else's business. The owner select policy is what allows this, so it only
     * ever returns the caller's row.
     */
    const { data } = await supabase
      .from("profiles")
      .select("username, suspended_at, can_post, can_moderate, can_manage_users")
      .eq("id", user.id)
      .maybeSingle();

    username = data?.username ?? null;
    suspended = Boolean(data?.suspended_at);

    /*
     * Any one of the three, not the role. A viewer with can_post still has
     * drafts and collaboration invites to deal with, and gating on
     * role === 'member' would hide the dashboard from exactly that person.
     * Section 2: always gate on the capability, never on the role string.
     *
     * Someone with none of the three has nothing on that page: no videos to
     * list, no tabs, and an upload link they cannot use. The link is left out
     * rather than leading them to an empty room.
     */
    hasDashboard = Boolean(
      data?.can_post || data?.can_moderate || data?.can_manage_users,
    );
  }

  const nav = [
    ...(user ? NAV_SIGNED_IN : NAV_SIGNED_OUT),
    ...(user && hasDashboard
      ? [{ href: "/dashboard", label: "Dashboard" }]
      : []),
    ...(user && username
      ? [{ href: `/u/${username}`, label: "Profile" }]
      : []),
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-ink/10 bg-paper/85 backdrop-blur-sm">
      <div className="relative mx-auto flex h-16 max-w-6xl items-center px-5 sm:gap-6 sm:px-6">
        {/*
          Centred below sm, back to its normal left position from sm up.
          Absolute rather than a three-column grid with an empty first cell,
          so the wordmark is centred on the header itself and does not shift
          when the sign-in control beside it changes width.
        */}
        <Link
          href="/"
          aria-label="FLARE, home"
          className="absolute left-1/2 -translate-x-1/2 shrink-0 sm:static sm:left-auto sm:translate-x-0"
        >
          <Image
            src="/images/FLARE_WORDMARK.png"
            alt="FLARE"
            width={1993}
            height={517}
            priority
            className="h-7 w-auto sm:h-8"
          />
        </Link>

        <nav className="ml-auto hidden items-center gap-7 sm:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="label text-ink/70 transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}

          {user ? (
            <form action={signOut}>
              <button
                type="submit"
                className="label rounded-full border border-ink/25 px-4 py-2.5 text-ink transition-colors hover:border-ink hover:bg-ink hover:text-mist"
              >
                Sign out
              </button>
            </form>
          ) : (
            <HeaderAuthControl />
          )}
        </nav>

        <div className="ml-auto sm:hidden">
          <MobileNav links={nav} signedIn={Boolean(user)} />
        </div>
      </div>

      {/*
        Section 2: a suspended user sees a banner explaining they have been
        suspended and who to talk to.

        In the header rather than a page, because nothing redirects a suspended
        account anywhere. They keep browsing the site, so the notice has to
        travel with them, and it sits inside the sticky header so it cannot be
        scrolled past and forgotten.
      */}
      {suspended && (
        <div className="border-t border-mist/15 bg-ink text-mist">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-2.5 sm:px-6">
            <p className="text-sm">
              Your account is suspended. You can still watch.
            </p>
            <Link
              href="/suspended"
              className="label underline decoration-mist/40 underline-offset-4 transition-colors hover:decoration-mist"
            >
              What this means
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
