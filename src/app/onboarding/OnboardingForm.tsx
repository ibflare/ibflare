"use client";

import Link from "next/link";
import { useActionState } from "react";
import { completeOnboarding, type OnboardingState } from "./actions";
import { GRADES } from "@/lib/taxonomy";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function OnboardingForm({
  initial,
  years,
}: {
  initial: OnboardingState["values"];
  years: number[];
}) {
  const [state, formAction, pending] = useActionState(completeOnboarding, {
    errors: {},
    values: initial,
  });

  const v = state.values ?? initial;

  return (
    <form action={formAction} className="mt-12 space-y-10">
      {state.errors.form && (
        <p
          role="alert"
          className="rounded-lg border border-hot/40 bg-hot/5 px-5 py-4 text-sm leading-relaxed"
        >
          {state.errors.form}
        </p>
      )}

      {/*
        Neutral age screen: two selects, neither pre-selected, and nothing here
        naming a threshold. The FTC treats "I am 13 or older" as leading,
        because it tells the reader which answer opens the door. CLAUDE.md 9.4.
      */}
      <fieldset>
        <legend className="label text-ink/60">Date of birth</legend>
        <div className="mt-3 flex flex-wrap gap-3">
          <select
            name="birth_month"
            defaultValue={v.birth_month}
            aria-label="Birth month"
            required
            className="rounded-lg border border-ink/25 bg-paper px-4 py-3 text-ink"
          >
            <option value="" disabled>
              Month
            </option>
            {MONTHS.map((label, i) => (
              <option key={label} value={i + 1}>
                {label}
              </option>
            ))}
          </select>

          <select
            name="birth_year"
            defaultValue={v.birth_year}
            aria-label="Birth year"
            required
            className="rounded-lg border border-ink/25 bg-paper px-4 py-3 text-ink"
          >
            <option value="" disabled>
              Year
            </option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        {state.errors.birth && (
          <p role="alert" className="mt-2 text-sm text-hot">
            {state.errors.birth}
          </p>
        )}
      </fieldset>

      <Field
        name="username"
        label="Username"
        hint="Lowercase letters, numbers, and underscores. Part of your profile address, and permanent."
        defaultValue={v.username}
        error={state.errors.username}
        required
        maxLength={20}
        autoComplete="off"
        spellCheck={false}
      />

      <Field
        name="display_name"
        label="Display name"
        hint="Shown on your profile and next to anything you post. We suggest a first name and last initial."
        defaultValue={v.display_name}
        error={state.errors.display_name}
        required
        maxLength={60}
        autoComplete="off"
      />

      {/* Everything below is private. Section 9.1. */}
      <div className="rounded-lg border border-ink/12 bg-paper-deep/50 p-6 sm:p-7">
        <p className="label text-ink/45">Not shown publicly</p>

        <div className="mt-7 space-y-8">
          <div>
            <label htmlFor="grade" className="label block text-ink/60">
              Grade
            </label>
            <select
              id="grade"
              name="grade"
              defaultValue={v.grade}
              required
              aria-describedby={state.errors.grade ? "grade-error" : undefined}
              aria-invalid={state.errors.grade ? true : undefined}
              className="mt-3 w-full rounded-lg border border-ink/25 bg-paper px-4 py-3 text-ink"
            >
              <option value="">Choose one</option>
              {GRADES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
            {state.errors.grade && (
              <p id="grade-error" role="alert" className="mt-2 text-sm text-hot">
                {state.errors.grade}
              </p>
            )}
          </div>

          <Field
            name="school"
            label="School"
            defaultValue={v.school}
            error={state.errors.school}
            required
            maxLength={120}
          />

          <Field
            name="city"
            label="City"
            hint="City only, never a street address."
            defaultValue={v.city}
            error={state.errors.city}
            required
            maxLength={80}
          />
        </div>
      </div>

      {/*
        Its own checkbox, never folded into the age question. Combining them
        makes each a weaker record of the other.
      */}
      <div>
        <label htmlFor="terms" className="flex items-start gap-3">
          <input
            id="terms"
            name="terms"
            type="checkbox"
            required
            aria-describedby={state.errors.terms ? "terms-error" : undefined}
            className="mt-1 size-4 shrink-0 accent-[var(--color-ink)]"
          />
          <span className="text-sm leading-relaxed text-ink/75">
            I accept the{" "}
            <Link href="/terms" className="underline underline-offset-4">
              Terms of Service
            </Link>{" "}
            and the{" "}
            <Link href="/privacy" className="underline underline-offset-4">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        {state.errors.terms && (
          <p id="terms-error" role="alert" className="mt-2 text-sm text-hot">
            {state.errors.terms}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="label rounded-full bg-ink px-7 py-4 text-mist transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Saving" : "Finish setting up"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  hint,
  error,
  ...props
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;

  return (
    <div>
      <label htmlFor={name} className="label block text-ink/60">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="mt-2 text-sm leading-relaxed text-ink/55">
          {hint}
        </p>
      )}
      <input
        id={name}
        name={name}
        type="text"
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        aria-invalid={error ? true : undefined}
        className="mt-3 w-full rounded-lg border border-ink/25 bg-paper px-4 py-3 text-ink"
        {...props}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-hot">
          {error}
        </p>
      )}
    </div>
  );
}
