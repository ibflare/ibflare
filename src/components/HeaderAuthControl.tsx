"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Client only because it needs the current path. On /login the sign-in control
 * is not rendered at all: it would point at the page you are already reading.
 */
export function HeaderAuthControl() {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  return (
    <Link
      href="/login"
      className="label rounded-full border border-ink/25 px-4 py-2.5 text-ink transition-colors hover:border-ink hover:bg-ink hover:text-mist"
    >
      Sign in
    </Link>
  );
}
