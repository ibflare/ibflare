import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { HeaderAuthControl } from "./HeaderAuthControl";

/**
 * Ink bar. On paper it was the same pale sage as the page beneath it, so the
 * two read as one flat surface with a hairline through it.
 *
 * The wordmark is the mist variant for the same reason the footer uses it: the
 * deep green original is invisible against this background. Both variants are
 * cropped from FLARE_LOGO.png with the tagline band removed, since that band
 * is 25px tall in a 724px file and turns to mush at header height.
 */
const NAV = [
  { href: "/library", label: "Library", mobile: true },
  // Reachable from the CTA band and the footer, so it yields first on narrow
  // screens rather than crowding the sign-in control.
  { href: "/contribute", label: "Contribute", mobile: false },
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
    <header className="sticky top-0 z-50 bg-ink text-mist">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:gap-6 sm:px-6">
        <Link href="/" aria-label="FLARE, home" className="shrink-0">
          <Image
            src="/images/FLARE_WORDMARK_MIST.png"
            alt="FLARE"
            width={1993}
            height={517}
            priority
            className="h-7 w-auto sm:h-8"
          />
        </Link>

        <nav className="flex items-center gap-4 sm:gap-7">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`label text-mist/70 transition-colors hover:text-mist ${
                item.mobile ? "" : "hidden sm:inline-block"
              }`}
            >
              {item.label}
            </Link>
          ))}

          {user ? (
            <>
              {username && (
                <Link
                  href={`/u/${username}`}
                  className="label hidden text-mist/70 transition-colors hover:text-mist sm:inline-block"
                >
                  Profile
                </Link>
              )}
              <form action={signOut}>
                <button
                  type="submit"
                  className="label rounded-full border border-mist/30 px-4 py-2.5 text-mist transition-colors hover:border-mist hover:bg-mist hover:text-ink"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <HeaderAuthControl />
          )}
        </nav>
      </div>
    </header>
  );
}
