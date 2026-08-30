"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GRADES } from "@/lib/taxonomy";

export type OnboardingState = {
  errors: Partial<
    Record<"username" | "display_name" | "grade" | "school" | "city" | "form", string>
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
