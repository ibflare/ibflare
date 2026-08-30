"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteAuthUser } from "@/lib/supabase/admin";
import { GRADES } from "@/lib/taxonomy";

export type OnboardingState = {
  errors: Partial<
    Record<
      | "birth"
      | "username"
      | "display_name"
      | "grade"
      | "school"
      | "city"
      | "terms"
      | "form",
      string
    >
  >;
  values: {
    birth_month: string;
    birth_year: string;
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
    birth_month: String(formData.get("birth_month") ?? ""),
    birth_year: String(formData.get("birth_year") ?? ""),
    username: String(formData.get("username") ?? "").trim().toLowerCase(),
    display_name: String(formData.get("display_name") ?? "").trim(),
    grade: String(formData.get("grade") ?? "").trim(),
    school: String(formData.get("school") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
  };

  const errors: OnboardingState["errors"] = {};

  const month = Number(values.birth_month);
  const year = Number(values.birth_year);

  if (
    !Number.isInteger(month) || month < 1 || month > 12 ||
    !Number.isInteger(year) || year < 1900
  ) {
    errors.birth = "Choose a month and a year.";
  }

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

  // Captured before the delete below, which invalidates the session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { errors: { form: "Your session expired. Sign in again." }, values };
  }

  /*
   * Age is checked first, before a single other field is written.
   *
   * The form asks for everything on one page, so an under-13 will have typed a
   * name and a school by the time they submit. None of it is ever stored: this
   * call runs before the profile update below, and if it fails the account is
   * deleted and the request never reaches the write. Typed is not collected.
   */
  const { data: oldEnough, error: ageError } = await supabase.rpc("attest_age", {
    p_birth_month: month,
    p_birth_year: year,
  });

  if (ageError) {
    return { errors: { form: ageError.message }, values };
  }

  if (oldEnough === false) {
    await deleteAuthUser(user.id);

    try {
      await supabase.auth.signOut();
    } catch {
      // Already invalid once the user is gone. Clearing cookies is the point.
    }

    // A public page: by now the session is gone, so anything gated would
    // bounce them to /login with no explanation.
    redirect("/account-unavailable");
  }

  const fields = {
    username: values.username,
    display_name: values.display_name,
    grade: values.grade,
    school: values.school || null,
    city: values.city || null,
  };

  const asUsernameError = (code?: string) =>
    // 23505 is unique_violation. The only unique column here is username.
    code === "23505"
      ? { errors: { username: "That username is taken. Try another one." }, values }
      : null;

  /*
   * Update first, then insert only if nothing matched.
   *
   * Not an upsert: PostgREST implements that as INSERT ... ON CONFLICT DO
   * UPDATE, which needs UPDATE privilege on every column in the payload
   * including id, and id is deliberately absent from the update grant because
   * a primary key must never change. The upsert failed with "permission denied
   * for table profiles" for exactly that reason.
   *
   * The insert branch exists because the signup trigger normally creates the
   * row, but if it is ever missing an update silently affects zero rows and
   * leaves the account stuck on this page with no error to show. Insert is
   * column-restricted by 20260830010000, so it cannot set a capability flag.
   *
   * onboarded is not set here: the check constraint requires both consent
   * stamps first, and one of them is written below.
   */
  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update(fields)
    .eq("id", user.id)
    .select("id");

  if (updateError) {
    return (
      asUsernameError(updateError.code) ?? {
        errors: { form: `We could not save that: ${updateError.message}` },
        values,
      }
    );
  }

  if (!updated || updated.length === 0) {
    const { error: insertError } = await supabase
      .from("profiles")
      .insert({ id: user.id, ...fields });

    if (insertError) {
      return (
        asUsernameError(insertError.code) ?? {
          errors: { form: `We could not save that: ${insertError.message}` },
          values,
        }
      );
    }
  }

  // Called again because the first call above wrote nothing if the row did not
  // exist yet. Idempotent, and this is what guarantees age_attested_at is set
  // before the constraint below is tested.
  const { error: stampError } = await supabase.rpc("attest_age", {
    p_birth_month: month,
    p_birth_year: year,
  });
  if (stampError) {
    return { errors: { form: stampError.message }, values };
  }

  // Stamped server-side by a definer function, so the timestamp is ours rather
  // than the client's. Separate from the age question by design.
  const { error: termsError } = await supabase.rpc("accept_terms");
  if (termsError) {
    return {
      errors: { form: `We could not save that: ${termsError.message}` },
      values,
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ onboarded: true })
    .eq("id", user.id);

  if (error) {
    return {
      errors: { form: `We could not save that: ${error.message}` },
      values,
    };
  }

  redirect(`/u/${values.username}`);
}
