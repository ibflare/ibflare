import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Where Google sends the user back to. Supabase hands us a one-time code in
 * the query string; exchanging it sets the session cookies.
 *
 * The redirect URI registered in Google Cloud Console points at Supabase
 * (https://<ref>.supabase.co/auth/v1/callback), not here. Supabase then
 * forwards to this route. See CLAUDE.md section 11.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Empty means "decide once we know who signed in". Resolved below.
  const next = searchParams.get("next") ?? "";

  // Google can return an error instead of a code, for instance if the person
  // cancelled at the consent screen.
  const error = searchParams.get("error_description") ?? searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("No sign-in code was returned. Try again.")}`,
    );
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`,
    );
  }

  // Only ever redirect to a path on this site. `next` arrives from the query
  // string, so treating it as a full URL would be an open redirect.
  if (next.startsWith("/") && !next.startsWith("//")) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  // No explicit destination, so send them to their own profile. /dashboard is
  // the natural landing spot but does not exist until phase 3, and bouncing
  // someone into a 404 immediately after signing in is not a welcome.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, onboarded")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.onboarded) {
      return NextResponse.redirect(`${origin}/u/${profile.username}`);
    }
  }

  // First sign-in, or the signup trigger has not landed yet. Onboarding is
  // where they need to be either way.
  return NextResponse.redirect(`${origin}/onboarding`);
}
