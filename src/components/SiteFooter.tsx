import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/**
 * The second column follows the header: Our mission and Sign in for a visitor,
 * How to contribute and Sign out for a member. The first column is the same
 * either way, since the library is public.
 *
 * This is why the footer is an async server component now. It was static, and
 * reading the session here costs one getUser call that the header has already
 * made; a shared cache is the tidier answer if a third surface ever needs it.
 */
const WATCH = {
  heading: "Watch",
  links: [
    { href: "/library", label: "Library" },
    { href: "/library?difficulty=1", label: "Start at level 1" },
  ],
};

const TAKE_PART_SIGNED_OUT = {
  heading: "About",
  links: [
    { href: "/our-mission", label: "Our mission" },
    { href: "/login", label: "Sign in" },
  ],
};

const TAKE_PART_SIGNED_IN = {
  heading: "Take part",
  links: [
    { href: "/contribute", label: "How to contribute" },
    { href: "/dashboard/upload", label: "Publish a video" },
  ],
};

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
];

export async function SiteFooter() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const columns = [WATCH, user ? TAKE_PART_SIGNED_IN : TAKE_PART_SIGNED_OUT];

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
              A student organization at Lamar Academy building a free financial
              education library for the Rio Grande Valley.
            </p>
          </div>

          {columns.map((column) => (
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

          {/* Liability and independence notice. Client-supplied copy. */}
          <p className="mt-5 max-w-4xl text-xs leading-relaxed text-mist/40">
            FLARE is a student organization at Lamar Academy. Everything
            published here is made by student contributors for educational
            purposes. It is not financial, investment, tax, accounting, or legal
            advice, and nothing on this site is a recommendation to buy, sell,
            or hold any security or financial product. FLARE accepts no
            sponsorship, affiliate compensation, or referral payments, and no
            contributor is paid for what they publish. Talk to a qualified
            professional before acting on anything you see here.
          </p>
        </div>
      </div>
    </footer>
  );
}
