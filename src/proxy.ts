import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next 16 renamed the `middleware` file convention to `proxy`. Same execution
 * model, same position in the request lifecycle; only the file and export name
 * changed. CLAUDE.md section 7 still calls this middleware, which is the right
 * word for what it does.
 *
 * Two jobs:
 *   1. Refresh the Supabase session on every request. Server components cannot
 *      write cookies, so if this does not run the session silently expires.
 *   2. The route guards from section 7.
 */

/** Signed out users hitting these get sent to /login. */
const PROTECTED_PREFIXES = ["/dashboard"];

/**
 * Reachable before onboarding is finished. Everything else redirects to
 * /onboarding, so a half-created account cannot wander the site.
 */
const PRE_ONBOARDING_ALLOWED = ["/onboarding", "/auth", "/login"];

export async function proxy(request: NextRequest) {
  // Must be mutated rather than recreated: the Supabase client writes refreshed
  // auth cookies onto this exact response object.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser, not getSession. getSession trusts whatever is in the cookie;
  // getUser verifies it against the auth server. A guard that trusts an
  // unverified cookie is not a guard.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user) {
    if (PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      // So login can send them back where they were headed.
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Signed in. Section 7: anyone with onboarded = false goes to /onboarding
  // from everywhere except /onboarding itself.
  const isAllowedPreOnboarding = PRE_ONBOARDING_ALLOWED.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );

  if (!isAllowedPreOnboarding) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarded")
      .eq("id", user.id)
      .maybeSingle();

    // A missing row means the signup trigger has not landed yet. Treat it the
    // same as unfinished onboarding: that page creates the row if it has to.
    if (!profile?.onboarded) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  /*
   * Without a matcher this runs on every request including static assets, and
   * an auth check in front of the CSS is a good way to make a site look broken.
   * Excludes _next internals and anything with a file extension, which covers
   * the video, the images, and the favicon.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
