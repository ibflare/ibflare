"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { signOut } from "@/app/auth/actions";

/**
 * The narrow-screen nav: three lines that open a full-height panel.
 *
 * Exists because the header ran out of room: below sm it was showing the
 * wordmark, one nav link and a sign-in pill, having dropped everything else to
 * fit. The panel holds the whole nav instead.
 *
 * `links` arrives already chosen for the signed-in state, so this component
 * does not know or care which set it is rendering. SiteHeader is an async
 * server component and makes that decision once; this is a client component
 * only because a disclosure has state.
 */
export function MobileNav({
  links,
  signedIn,
}: {
  links: { href: string; label: string }[];
  signedIn: boolean;
}) {
  const pathname = usePathname();

  /*
   * Open state is the route it was opened on, not a boolean, so that any
   * navigation closes the panel by making this comparison false. Derived
   * rather than reset from an effect: an effect that calls setState on a
   * pathname change is what react-hooks/set-state-in-effect exists to stop,
   * and this also covers the back button, which a link onClick would not.
   */
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt !== null && openAt === pathname;

  useEffect(() => {
    if (!open) return;

    // Without this the page behind the panel scrolls under it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenAt(null);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenAt(open ? null : pathname)}
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        className="-mr-2 flex size-11 items-center justify-center text-ink"
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>

      {open &&
        /*
          Portalled to the body, and it has to be.

          The header carries backdrop-blur-sm, and backdrop-filter makes an
          element a containing block for fixed-position descendants exactly the
          way transform does. Left inside the header, this panel's `fixed`
          resolved against the 4rem header rather than the viewport, so
          top-16 bottom-0 collapsed it into a strip across the top of the page
          with the content still showing through underneath.
        */
        createPortal(
          <div
            id="mobile-nav"
            // Starts below the header, so the wordmark and the close control
            // stay visible and the panel reads as belonging to the header.
            className="fixed inset-x-0 top-16 bottom-0 z-40 overflow-y-auto bg-paper px-5 py-12"
          >
            <nav className="flex flex-col items-start gap-9">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="font-display text-3xl leading-none font-medium text-ink"
                >
                  {link.label}
                </Link>
              ))}

              {signedIn ? (
                <form action={signOut}>
                  <button
                    type="submit"
                    className="label rounded-full border border-ink/25 px-6 py-3.5 text-ink"
                  >
                    Sign out
                  </button>
                </form>
              ) : (
                <Link
                  href="/login"
                  className="label rounded-full bg-ink px-6 py-3.5 text-mist"
                >
                  Sign in
                </Link>
              )}
            </nav>
          </div>,
          document.body,
        )}
    </>
  );
}

/* Three lines. Drawn rather than pulled from an icon set: two elements in the
   whole app need an icon, and neither justifies a dependency. */
function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden focusable="false">
      <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <line x1="3" y1="6.5" x2="21" y2="6.5" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="17.5" x2="21" y2="17.5" />
      </g>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden focusable="false">
      <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <line x1="5" y1="5" x2="19" y2="19" />
        <line x1="19" y1="5" x2="5" y2="19" />
      </g>
    </svg>
  );
}
