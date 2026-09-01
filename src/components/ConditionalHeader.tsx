"use client";

import { usePathname } from "next/navigation";

/**
 * Hides the header on pages that are a single task with a single exit.
 *
 * SiteHeader is an async server component, so it cannot read the pathname
 * itself. It is passed in as children instead: it still renders on the server,
 * but this decides whether it reaches the DOM. Same shape as
 * ConditionalFooter.
 *
 * The cleaner long-term structure is a route group with its own bare layout,
 * which would also drop the 4rem coupling in the root layout's main. Worth
 * doing if this list grows.
 */
const BARE = ["/login"];

export function ConditionalHeader({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const bare = BARE.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );

  return bare ? null : children;
}
