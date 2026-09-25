"use client";

import Link from "next/link";
import { useActionState } from "react";
import { completeOnboarding, type OnboardingState } from "./actions";
import { GRADES } from "@/lib/taxonomy";
import { Select } from "@/components/Select";

export function OnboardingForm({
  initial,
}: {
  initial: OnboardingState["values"];
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
        The age screen was removed on 16 September. Two selects asking for a
        birth month and year used to open this form; the site no longer asks
        anybody's age, so nothing is collected here that is not needed to make
        a profile. CLAUDE.md 9.4 records what that trades away.
      */}

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
            <Select
              id="grade"
              name="grade"
              label="Grade"
              defaultValue={v.grade}
              placeholder="Choose one"
              required
              requiredMessage="Choose one of the options."
              error={state.errors.grade}
              options={GRADES.map((g) => ({ value: g.value, label: g.label }))}
              className="mt-3"
            />
          </div>

          {/*
            School and city are optional. They carry the word rather than an
            asterisk on everything else, because grade is the only other field
            in this group and marking one field optional is less noise than
            marking two required.
          */}
          <Field
            name="school"
            label="School (optional)"
            defaultValue={v.school}
            error={state.errors.school}
            maxLength={120}
          />

          <Field
            name="city"
            label="City (optional)"
            hint="City only, never a street address."
            defaultValue={v.city}
            error={state.errors.city}
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
