import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { HeaderAuthControl } from "./HeaderAuthControl";
import { MobileNav } from "./MobileNav";

/**
 * The header uses FLARE_WORDMARK.png, the full lockup cropped to just the
 * wordmark (generated from FLARE_LOGO.png, tagline band removed). The tagline
 * in the full logo is ~25px tall in a 724px-tall file, so at header height it
 * renders as illegible mush. The full lockup belongs somewhere it has room.
 */
/**
 * Both links show in both navs now. They used to carry a `mobile` flag,
 * because the narrow header had room for one and /contribute was the one that
 * yielded. The panel in MobileNav has room for everything, so the flag went.
 */
const NAV = [
  { href: "/library", label: "Library" },
  { href: "/contribute", label: "Contribute" },
];

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let username: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("public_profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();
    username = data?.username ?? null;
  }

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
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="label text-ink/70 transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}

          {user ? (
            <>
              {username && (
                <Link
                  href={`/u/${username}`}
                  className="label text-ink/70 transition-colors hover:text-ink"
                >
                  Profile
                </Link>
              )}
              <form action={signOut}>
                <button
                  type="submit"
                  className="label rounded-full border border-ink/25 px-4 py-2.5 text-ink transition-colors hover:border-ink hover:bg-ink hover:text-mist"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <HeaderAuthControl />
          )}
        </nav>

        <div className="ml-auto sm:hidden">
          <MobileNav links={NAV} username={username} signedIn={Boolean(user)} />
        </div>
      </div>
    </header>
  );
}
