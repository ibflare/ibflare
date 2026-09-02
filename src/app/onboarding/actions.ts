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

  // Required, not optional. profiles_onboarded_requires_profile refuses to mark
  // an account onboarded without all three of grade, school and city, so a
  // blank here would fail at the last write with nothing useful to show.
  if (!values.school) {
    errors.school = "Enter your school.";
  } else if (values.school.length > 120) {
    errors.school = "That is too long. Keep it under 120 characters.";
  }

  if (!values.city) {
    errors.city = "Enter your city.";
  } else if (values.city.length > 80) {
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

  /*
   * Deliberately after the age check, not up with the rest of the validation.
   *
   * This is the first thing in the action that sends a typed field anywhere,
   * and an under-13 has been deleted and redirected by the line above before
   * it runs. So their chosen name never reaches the database either, on the
   * same principle as the profile write below.
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
    school: values.school,
    city: values.city,
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
   * onboarded is not set here, and cannot be: two check constraints have to be
   * satisfied first. profiles_onboarded_requires_profile wants grade, school
   * and city, which this write supplies, and
   * profiles_onboarded_requires_consent wants both consent stamps, one of
   * which is written below. The final update is what flips the flag.
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
