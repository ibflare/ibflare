"use client";

import { useActionState } from "react";
import { completeOnboarding, type OnboardingState } from "./actions";
import { GRADES } from "@/lib/taxonomy";

export function OnboardingForm({ initial }: { initial: OnboardingState["values"] }) {
  const [state, formAction, pending] = useActionState(completeOnboarding, {
    errors: {},
    values: initial,
  });

  const v = state.values ?? initial;

  return (
    <form action={formAction} className="mt-12 space-y-9">
      {state.errors.form && (
        <p
          role="alert"
          className="rounded-lg border border-hot/40 bg-hot/5 px-5 py-4 text-sm leading-relaxed"
        >
          {state.errors.form}
        </p>
      )}

      <Field
        name="username"
        label="Username"
        hint="Lowercase letters, numbers, and underscores. This is part of your profile address, and it cannot be changed later."
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
        hint="Shown on your profile and next to anything you post. We suggest your first name and last initial."
        defaultValue={v.display_name}
        error={state.errors.display_name}
        required
        maxLength={60}
        autoComplete="off"
      />

      {/* Everything below is private. Section 9.1. */}
      <div className="rounded-lg border border-ink/12 bg-paper-deep/60 p-6 sm:p-8">
        <p className="label text-ink/45">Not shown publicly</p>
        <p className="mt-3 text-sm leading-relaxed text-ink/70">
          Officers and the faculty sponsor use these to know who is in the club.
          They never appear on your profile or anywhere else on the site. We do
          not ask for your address, phone number, or birthday.
        </p>

        <div className="mt-8 space-y-9">
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
            hint="Optional."
            defaultValue={v.school}
            error={state.errors.school}
            maxLength={120}
          />

          <Field
            name="city"
            label="City"
            hint="Optional. City only, never a street address."
            defaultValue={v.city}
            error={state.errors.city}
            maxLength={80}
          />
        </div>
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
        <p id={hintId} className="mt-2 text-sm leading-relaxed text-ink/60">
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
