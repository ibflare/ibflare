"use client";

import { useActionState, useState } from "react";
import {
  signInWithEmail,
  signUpWithEmail,
  type EmailAuthState,
} from "@/app/auth/actions";

const EMPTY: EmailAuthState = { error: null, checkInbox: false, email: "" };

export function EmailAuthForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [state, formAction, pending] = useActionState(
    mode === "signin" ? signInWithEmail : signUpWithEmail,
    EMPTY,
  );

  if (state.checkInbox) {
    return (
      <p className="mt-8 rounded-lg border border-ink/20 bg-paper-deep/60 px-5 py-4 text-sm leading-relaxed">
        Check {state.email} for a confirmation link.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <input type="hidden" name="next" value={next} />

      <div>
        <label htmlFor="email" className="label block text-ink/60">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          className="mt-2 w-full rounded-lg border border-ink/25 bg-paper px-4 py-3 text-ink"
        />
      </div>

      <div>
        <label htmlFor="password" className="label block text-ink/60">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          required
          minLength={mode === "signup" ? 8 : undefined}
          className="mt-2 w-full rounded-lg border border-ink/25 bg-paper px-4 py-3 text-ink"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm leading-relaxed text-hot">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="label w-full rounded-full border border-ink/25 px-7 py-4 text-ink transition-colors hover:border-ink disabled:opacity-50"
      >
        {mode === "signin" ? "Sign in" : "Create account"}
      </button>

      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="w-full text-sm text-ink/55 underline decoration-ink/25 underline-offset-4 transition-colors hover:text-ink"
      >
        {mode === "signin" ? "Create an account" : "Sign in instead"}
      </button>
    </form>
  );
}
