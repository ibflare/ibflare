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
  const next = searchParams.get("next") ?? "/dashboard";

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
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  return NextResponse.redirect(`${origin}${safeNext}`);
}
