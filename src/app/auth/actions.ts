"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * Google is the only sign-in method. Section 1: no password auth, no
 * email/password fallback, ever. Age gating sits on Google's side, which is
 * what keeps the under-13 signup path closed (section 9.4).
 */
export async function signInWithGoogle(formData: FormData) {
  const next = String(formData.get("next") ?? "/dashboard");
  const supabase = await createClient();

  // Built from the request rather than hardcoded, so this works on localhost,
  // on Vercel previews, and in production without a per-environment constant.
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";

  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
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
