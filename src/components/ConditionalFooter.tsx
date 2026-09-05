"use client";

import { usePathname } from "next/navigation";

/**
 * The footer is a site-wide navigation surface. On the pages where you are in
 * the middle of a single task, it is noise: three columns of links and a
 * liability notice under a form asking for your date of birth.
 *
 * These pages keep the header, so the wordmark and a way out are still there.
 */
const BARE = ["/login", "/onboarding", "/auth", "/account-unavailable"];

/**
 * Takes SiteFooter as children rather than importing it, mirroring
 * ConditionalHeader.
 *
 * It used to import it directly, which was fine while the footer was static.
 * The moment the footer needed the session it became an async server component
 * reading next/headers, and a client component cannot render one of those: the
 * build fails with "you are using it in the Pages Router", which is a
 * confusing way to say the child got treated as client code. Passing it in
 * from the server layout keeps it on the server and leaves this component
 * doing the one thing it needs the pathname for.
 */
export function ConditionalFooter({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const bare = BARE.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );

  return bare ? null : children;
}
