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

/**
 * Whether watching requires an account.
 *
 * Now false. The library, video pages and profiles are public; an account is
 * only needed in order to contribute. That is the decision the club made, and
 * it answers the open question in CLAUDE.md section 9.4.
 *
 * It also un-does the cost that section recorded: an under-13 cannot pass the
 * age screen, so cannot hold an account, so while this was true they were shut
 * out of the site entirely, including the level written for the youngest
 * readers. They can now watch. They still cannot post or comment, because both
 * require an onboarded account.
 *
 * This is the routing half only. The other half is a database grant, and the
 * two have to move together: public_profiles has to be readable by anon or
 * /u/[username] returns nothing to a signed-out visitor, since the server
 * client falls back to the anon role when there is no session. Restored in
 * 20260903000000. Re-gating means reverting both, not just this line.
 */
const REQUIRE_ACCOUNT_TO_VIEW = false;

/**
 * Only meaningful while REQUIRE_ACCOUNT_TO_VIEW is true, so unused today.
 *
 * Kept because the gate is reversible and this is the list to restore. /u is
 * in it because a profile page carries a contributor's name and picture, so
 * gating the library while leaving profiles open would put the same people on
 * a public page by another route.
 */
const VIEWING_PREFIXES = ["/library", "/v", "/u"];

/** Always require an account, gate or no gate. */
const DASHBOARD_PREFIXES = ["/dashboard"];

/**
 * Everything a signed-out visitor may reach. The landing page, /contribute,
 * /login and the legal pages stay public in both configurations.
 */
const PROTECTED_PREFIXES = REQUIRE_ACCOUNT_TO_VIEW
  ? [...DASHBOARD_PREFIXES, ...VIEWING_PREFIXES]
  : DASHBOARD_PREFIXES;

/**
 * Reachable before onboarding is finished. Everything else redirects to
 * /onboarding, so a half-created account cannot wander the site.
 */
const PRE_ONBOARDING_ALLOWED = ["/onboarding", "/auth", "/login"];

/**
 * An auth code that landed on the wrong route.
 *
 * Supabase sends the browser to the project's Site URL when the redirectTo it
 * was handed is not in the Redirect URLs allowlist. It does not error: it
 * silently substitutes, so the visitor ends up on / with ?code= still attached
 * and nothing there to exchange it. The symptom is a signed-out visitor sitting
 * on the landing page with an auth code in the address bar.
 *
 * This hands the code to the route that knows what to do with it, whichever
 * page it landed on. It is a backstop and not the fix: if the Site URL points
 * at a different host, the request never reaches this app at all. The allowlist
 * is the fix, and CLAUDE.md section 11 now records what has to be in it.
 */
function strayAuthCode(request: NextRequest): URL | null {
  const { pathname, searchParams } = request.nextUrl;

  // Everything under /auth already handles every shape of this, and
  // intercepting those would loop.
  if (pathname.startsWith("/auth/")) return null;

  const url = request.nextUrl.clone();

  // PKCE, which is what @supabase/ssr uses, and what the default confirmation
  // email template redirects back with.
  if (searchParams.has("code")) {
    url.pathname = "/auth/callback";
    return url;
  }

  // The shape a customised template produces. Same failure, same cause.
  if (searchParams.has("token_hash") && searchParams.has("type")) {
    url.pathname = "/auth/confirm";
    return url;
  }

  return null;
}

export async function proxy(request: NextRequest) {
  const stray = strayAuthCode(request);
  if (stray) return NextResponse.redirect(stray);

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
    if (
      PROTECTED_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
      )
    ) {
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
