"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "./SiteFooter";

/**
 * The footer is a site-wide navigation surface. On the pages where you are in
 * the middle of a single task, it is noise: three columns of links and a
 * liability notice under a form asking for your date of birth.
 *
 * These pages keep the header, so the wordmark and a way out are still there.
 */
const BARE = ["/login", "/onboarding", "/auth", "/account-unavailable"];

export function ConditionalFooter() {
  const pathname = usePathname();

  const bare = BARE.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );

  return bare ? null : <SiteFooter />;
}
