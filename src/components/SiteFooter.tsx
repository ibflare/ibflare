import Link from "next/link";

const COLUMNS = [
  {
    heading: "Watch",
    links: [
      { href: "/library", label: "Library" },
      { href: "/library?difficulty=1", label: "Start at level 1" },
    ],
  },
  {
    heading: "Take part",
    links: [
      { href: "/contribute", label: "How to contribute" },
      { href: "/login", label: "Sign in" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-ink text-mist">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-[1.6fr_1fr_1fr]">
          <div>
            <p className="font-display text-3xl leading-none font-semibold">
              FLARE
            </p>
            <p className="label mt-4 text-mist/55">
              Financial Literacy Advancement for RGV Equity
            </p>
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-mist/70">
              A student-run video library at Lamar Academy. Members explain
              money, taxes, and economics at the level you are actually at.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <p className="label text-mist/45">{column.heading}</p>
              <ul className="mt-5 space-y-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-mist/80 transition-colors hover:text-mist"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-mist/15 pt-7 text-xs text-mist/50 sm:flex-row sm:items-center sm:justify-between">
          <p>FLARE at Lamar Academy · Rio Grande Valley, Texas</p>
          <p>
            Videos are made by students. Nothing here is financial advice, and
            we never take sponsors or referral codes.
          </p>
        </div>
      </div>
    </footer>
  );
}
