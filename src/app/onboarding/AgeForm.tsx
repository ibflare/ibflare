"use client";

import { useActionState } from "react";
import { attestAge, type AgeState } from "./actions";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Neutral age screen. Two selects, neither pre-selected, and nothing on the
 * page saying what age is required or what happens next. Naming a threshold
 * would tell the reader which answer to give. See CLAUDE.md section 9.4.
 */
export function AgeForm({ years }: { years: number[] }) {
  const [state, formAction, pending] = useActionState<AgeState, FormData>(
    attestAge,
    { blocked: false, error: null },
  );

  if (state.blocked) {
    return (
      <p className="mt-10 leading-relaxed text-ink/75">
        Accounts are not available to you yet.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-10">
      <fieldset>
        <legend className="label text-ink/60">Date of birth</legend>

        <div className="mt-4 flex flex-wrap gap-4">
          <div>
            <label htmlFor="birth_month" className="sr-only">
              Month
            </label>
            <select
              id="birth_month"
              name="birth_month"
              defaultValue=""
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
          </div>

          <div>
            <label htmlFor="birth_year" className="sr-only">
              Year
            </label>
            <select
              id="birth_year"
              name="birth_year"
              defaultValue=""
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
        </div>
      </fieldset>

      {state.error && (
        <p role="alert" className="mt-4 text-sm text-hot">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="label mt-8 rounded-full bg-ink px-7 py-4 text-mist transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Saving" : "Continue"}
      </button>
    </form>
  );
}
