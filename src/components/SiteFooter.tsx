import Image from "next/image";
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

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
];

export function SiteFooter() {
  return (
    <footer className="bg-ink text-mist">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr] md:gap-12">
          <div>
            {/*
              Mist-recoloured wordmark. The header's copy is deep green and
              would be invisible here; this variant uses the original's ink
              coverage as an alpha mask, so the flame stays a real cut-out and
              the ink background shows through it.
            */}
            <Image
              src="/images/FLARE_WORDMARK_MIST.png"
              alt="FLARE"
              width={1993}
              height={517}
              className="h-8 w-auto"
            />
            <p className="label mt-3.5 text-mist/55">
              Financial Literacy Advancement for RGV Equity
            </p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-mist/70">
              A student-run video library at Lamar Academy, publishing
              instruction on financial literacy, taxation, and economics across
              five levels of difficulty.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <p className="label text-mist/45">{column.heading}</p>
              <ul className="mt-4 space-y-2.5">
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

        <div className="mt-10 border-t border-mist/15 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-mist/50">
              FLARE at Lamar Academy · Rio Grande Valley, Texas
            </p>
            <nav className="flex gap-5">
              {LEGAL_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-xs text-mist/50 underline decoration-mist/25 underline-offset-4 transition-colors hover:text-mist hover:decoration-mist/60"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/*
            Formal register here is deliberate and departs from the plain-voice
            rule in CLAUDE.md §8. That rule governs teaching copy; a liability
            and independence disclaimer is doing different work.
          */}
          <p className="mt-5 max-w-4xl text-xs leading-relaxed text-mist/40">
            FLARE is a student organization operating at Lamar Academy. All
            material published on this site is produced by student contributors
            for educational purposes only and does not constitute financial,
            investment, tax, accounting, or legal advice, nor a recommendation
            to buy, sell, or hold any security or financial product. FLARE
            receives no sponsorship, affiliate compensation, or referral
            consideration from any third party, and no contributor is
            compensated for the content they publish. Viewers should consult a
            qualified professional before acting on any information presented
            here.
          </p>
        </div>
      </div>
    </footer>
  );
}
