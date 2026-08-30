import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { HeaderAuthControl } from "./HeaderAuthControl";

/**
 * The header uses FLARE_WORDMARK.png, the full lockup cropped to just the
 * wordmark (generated from FLARE_LOGO.png, tagline band removed). The tagline
 * in the full logo is ~25px tall in a 724px-tall file, so at header height it
 * renders as illegible mush. The full lockup belongs somewhere it has room.
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
    <header className="sticky top-0 z-50 border-b border-ink/10 bg-paper/85 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:gap-6 sm:px-6">
        <Link href="/" aria-label="FLARE, home" className="shrink-0">
          <Image
            src="/images/FLARE_WORDMARK.png"
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
              className={`label text-ink/70 transition-colors hover:text-ink ${
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
                  className="label hidden text-ink/70 transition-colors hover:text-ink sm:inline-block"
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
      </div>
    </header>
  );
}
