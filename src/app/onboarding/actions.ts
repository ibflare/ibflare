"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GRADES } from "@/lib/taxonomy";

export type OnboardingState = {
  errors: Partial<
    Record<
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
    username: string;
    display_name: string;
    grade: string;
    school: string;
    city: string;
  };
};

/*
 * The reserved username list is not here.
 *
 * It used to be, as a Set in this file, which meant it was enforced by this
 * one code path and nowhere else: a test account was renamed to "flare"
 * straight through the API. It now lives in the database as
 * is_reserved_username(), backing a check constraint on the column, and this
 * action calls that same function rather than keeping a second copy in step
 * with it. See 20260902000000_close_profile_findings.sql.
 */

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

  // Reserved names are checked further down, against the database. Format is
  // all that can be judged without a round trip.
  if (!USERNAME_PATTERN.test(values.username)) {
    errors.username =
      "Use 3 to 20 characters: lowercase letters, numbers, and underscores.";
  }

  if (values.display_name.length < 1 || values.display_name.length > 60) {
    errors.display_name = "Enter a name between 1 and 60 characters.";
  }

  if (!GRADES.some((g) => g.value === values.grade)) {
    errors.grade = "Choose one of the options.";
  }

  // Optional as of 20260909000000, so only the length is checked. Blank is a
  // valid answer and reaches the database as NULL rather than '', because an
  // empty string in a private column is a value we would then be storing about
  // a minor for no reason.
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
    return { errors: { form: "Your session expired. Sign in again." }, values };
  }

  /*
   * The age screen used to run here, before any other field was written, so
   * that an under-13's typed name never reached the database. It was removed
   * on 16 September along with attest_age and the account deletion that
   * followed a failure. Nothing in this action asks about age now.
   *
   * is_reserved_username() is the function the check constraint on the column
   * calls, so a name that passes here cannot fail that constraint later. The
   * list is not duplicated in this file.
   */
  const { data: reserved, error: reservedError } = await supabase.rpc(
    "is_reserved_username",
    { u: values.username },
  );

  if (reservedError) {
    return {
      errors: { form: `We could not save that: ${reservedError.message}` },
      values,
    };
  }

  if (reserved) {
    return {
      errors: { username: "That username is reserved. Pick another one." },
      values,
    };
  }

  const fields = {
    username: values.username,
    display_name: values.display_name,
    grade: values.grade,
    // Blank means "not answered", which is NULL. Writing '' would leave the
    // column looking answered and would satisfy any future non-empty check by
    // accident.
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
   * onboarded is not set here, and as of 20260916010000 cannot be from any
   * client at all: the column left both grants so that the username lock
   * cannot be stepped around by unsetting it. complete_onboarding() is the
   * only writer, and it re-checks grade and the terms stamp itself.
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

  // Stamped server-side by a definer function, so the timestamp is ours rather
  // than the client's. The one consent stamp left after the age screen went.
  const { error: termsError } = await supabase.rpc("accept_terms");
  if (termsError) {
    return {
      errors: { form: `We could not save that: ${termsError.message}` },
      values,
    };
  }

  // The only path to onboarded = true. It re-reads the row and refuses unless
  // grade and the terms stamp are both there, so this cannot mark a half
  // filled profile complete even if the writes above partly failed.
  const { error } = await supabase.rpc("complete_onboarding");

  if (error) {
    return {
      errors: { form: `We could not save that: ${error.message}` },
      values,
    };
  }

  redirect(`/u/${values.username}`);
}
