"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GRADES } from "@/lib/taxonomy";

export type AgeState = {
  /** Set when the account did not clear the minimum age. */
  blocked: boolean;
  error: string | null;
};

/**
 * The age screen.
 *
 * Deliberately a neutral screen: two selects, neither pre-selected, and no
 * text anywhere stating what age is required. FTC guidance treats a "are you
 * 13 or older" checkbox as a leading design, because it tells the reader which
 * answer opens the door. Asking for a birth date without signalling the cutoff
 * is the neutral form. See CLAUDE.md section 9.4.
 *
 * The age itself is computed in the database by attest_age(), not here. The
 * birth month reaches Postgres as an argument and is never stored.
 */
export async function attestAge(
  _prev: AgeState,
  formData: FormData,
): Promise<AgeState> {
  const month = Number(formData.get("birth_month"));
  const year = Number(formData.get("birth_year"));

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { blocked: false, error: "Choose a month." };
  }
  if (!Number.isInteger(year) || year < 1900) {
    return { blocked: false, error: "Choose a year." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("attest_age", {
    p_birth_month: month,
    p_birth_year: year,
  });

  if (error) {
    return { blocked: false, error: error.message };
  }

  if (data === false) {
    return { blocked: true, error: null };
  }

  redirect("/onboarding");
}

export type OnboardingState = {
  errors: Partial<
    Record<
      "username" | "display_name" | "grade" | "school" | "city" | "terms" | "form",
      string
    >
  >;
  values: {
    username: string;
    display_name: string;
    grade: string;
    school: string;
    city: string;
  };
};

/**
 * Names that would collide with a route or let someone pose as the club.
 * /u/[username] shares a namespace with nothing today, but "flare" and
 * "admin" are impersonation risks regardless of routing.
 */
const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "flare", "flare_official", "official", "moderator",
  "mod", "sponsor", "officer", "staff", "support", "help", "root", "system",
  "api", "auth", "login", "logout", "signin", "signup", "onboarding",
  "dashboard", "library", "contribute", "privacy", "terms", "suspended",
  "settings", "account", "profile", "u", "v", "me", "null", "undefined",
]);

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export async function completeOnboarding(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const values = {
    username: String(formData.get("username") ?? "").trim().toLowerCase(),
    display_name: String(formData.get("display_name") ?? "").trim(),
    grade: String(formData.get("grade") ?? "").trim(),
    school: String(formData.get("school") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
  };

  const errors: OnboardingState["errors"] = {};

  if (!USERNAME_PATTERN.test(values.username)) {
    errors.username =
      "Use 3 to 20 characters: lowercase letters, numbers, and underscores.";
  } else if (RESERVED_USERNAMES.has(values.username)) {
    errors.username = "That username is reserved. Pick another one.";
  }

  if (values.display_name.length < 1 || values.display_name.length > 60) {
    errors.display_name = "Enter a name between 1 and 60 characters.";
  }

  if (!GRADES.some((g) => g.value === values.grade)) {
    errors.grade = "Choose one of the options.";
  }

  if (values.school.length > 120) {
    errors.school = "That is too long. Keep it under 120 characters.";
  }

  if (values.city.length > 80) {
    errors.city = "That is too long. Keep it under 80 characters.";
  }

  if (formData.get("terms") !== "on") {
    errors.terms = "Accept the terms to continue.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      errors: { form: "Your session expired. Sign in again." },
      values,
    };
  }

  // Stamped server-side by a definer function, so the timestamp is ours rather
  // than the client's. Separate from the age screen by design.
  const { error: termsError } = await supabase.rpc("accept_terms");
  if (termsError) {
    return {
      errors: { form: `We could not save that: ${termsError.message}` },
      values,
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      username: values.username,
      display_name: values.display_name,
      grade: values.grade,
      school: values.school || null,
      city: values.city || null,
      onboarded: true,
    })
    .eq("id", user.id);

  if (error) {
    // 23505 is unique_violation. The only unique column here is username.
    if (error.code === "23505") {
      return {
        errors: { username: "That username is taken. Try another one." },
        values,
      };
    }
    return {
      errors: { form: `We could not save that: ${error.message}` },
      values,
    };
  }

  redirect(`/u/${values.username}`);
}
