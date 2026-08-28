import Link from "next/link";

/**
 * The wordmark is set in Bodoni Moda at --color-ink, which is sampled from
 * FLARE_LOGO.png — so the header reads as the same mark. The full lockup
 * (flame, tagline rule) is shown as the actual file in the hero, where it has
 * the room to be legible.
 */
const NAV = [
  { href: "/library", label: "Library", mobile: true },
  // Reachable from the CTA band and the footer, so it yields first on narrow
  // screens rather than crowding the sign-in control.
  { href: "/contribute", label: "Contribute", mobile: false },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-ink/10 bg-paper/85 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:gap-6 sm:px-6">
        <Link
          href="/"
          className="font-display text-2xl leading-none font-semibold tracking-tight text-ink"
          aria-label="FLARE — home"
        >
          FLARE
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
          <Link
            href="/login"
            className="label rounded-full border border-ink/25 px-4 py-2.5 text-ink transition-colors hover:border-ink hover:bg-ink hover:text-mist"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
