"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/** Built from the request, so this works on localhost, previews, and prod. */
async function siteOrigin() {
  return (await headers()).get("origin") ?? "http://localhost:3000";
}

/** `next` arrives from a query string, so anything off-site is discarded. */
function safePath(next: string) {
  return next.startsWith("/") && !next.startsWith("//") ? next : "";
}

export async function signInWithGoogle(formData: FormData) {
  const next = safePath(String(formData.get("next") ?? "").trim());
  const supabase = await createClient();
  const origin = await siteOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export type EmailAuthState = {
  error: string | null;
  /** Set after a signup, so the form can say to go and check their inbox. */
  checkInbox: boolean;
  email: string;
};

const PASSWORD_MIN = 8;

export async function signInWithEmail(
  _prev: EmailAuthState,
  formData: FormData,
): Promise<EmailAuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safePath(String(formData.get("next") ?? "").trim());

  if (!email || !password) {
    return { error: "Enter your email and password.", checkInbox: false, email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabase returns the same message for a wrong password and an unknown
    // address, which is the behaviour we want: confirming which addresses have
    // accounts would leak the membership list.
    return {
      error:
        error.message === "Email not confirmed"
          ? "Confirm your email first. Check your inbox for the link."
          : "That email and password do not match an account.",
      checkInbox: false,
      email,
    };
  }

  redirect(next || "/onboarding");
}

export async function signUpWithEmail(
  _prev: EmailAuthState,
  formData: FormData,
): Promise<EmailAuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email) {
    return { error: "Enter an email address.", checkInbox: false, email };
  }
  if (password.length < PASSWORD_MIN) {
    return {
      error: `Use at least ${PASSWORD_MIN} characters for your password.`,
      checkInbox: false,
      email,
    };
  }

  const supabase = await createClient();
  const origin = await siteOrigin();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });

  if (error) {
    return { error: error.message, checkInbox: false, email };
  }

  // Supabase returns a user with an empty identities array when the address is
  // already registered, rather than erroring, so that signup cannot be used to
  // enumerate accounts. Show the same result either way.
  if (data.user && data.user.identities?.length === 0) {
    return { error: null, checkInbox: true, email };
  }

  return { error: null, checkInbox: true, email };
}
