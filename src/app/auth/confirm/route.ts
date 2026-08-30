import { NextResponse, type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Where the confirmation link in a signup email lands.
 *
 * Confirmation is not optional here. Supabase links accounts by email address,
 * so an unconfirmed signup on an address someone does not own becomes that
 * address owner's account the moment they sign in with Google. See CLAUDE.md
 * section 1.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (!token_hash || !type) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("That confirmation link is not valid. Request a new one.")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("That link has expired or was already used. Sign in to get a new one.")}`,
    );
  }

  // Confirmed and signed in. The signup trigger created the profile row when
  // the account was first registered, so onboarding picks up from there.
  return NextResponse.redirect(`${origin}/onboarding`);
}
