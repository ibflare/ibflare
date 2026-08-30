"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  type EmailAuthState,
} from "@/app/auth/actions";

const EMPTY: EmailAuthState = { error: null, checkInbox: false, email: "" };

export function LoginPanel({
  next,
  error,
}: {
  next: string;
  error: string | null;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [reveal, setReveal] = useState(false);
  const [state, formAction, pending] = useActionState(
    mode === "signin" ? signInWithEmail : signUpWithEmail,
    EMPTY,
  );

  /*
   * Once they have submitted a signup they have chosen email. Showing the
   * Google button here would offer a second route at the moment they have
   * already committed to one, so this screen replaces the panel entirely.
   */
  if (state.checkInbox) {
    return (
      <div className="w-full max-w-sm">
        <h1 className="font-display text-4xl leading-tight font-medium">
          Check your email
        </h1>
        <p className="mt-8 leading-relaxed text-ink/75">
          We sent a link to {state.email}.
        </p>
        <Link
          href="/login"
          className="mt-8 block text-sm text-ink/55 underline decoration-ink/25 underline-offset-4 transition-colors hover:text-ink"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-display text-4xl leading-tight font-medium">
        Sign in
      </h1>

      {error && (
        <p
          role="alert"
          className="mt-8 rounded-lg border border-hot/40 bg-hot/5 px-5 py-4 text-sm leading-relaxed"
        >
          {error}
        </p>
      )}

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
          <div className="relative mt-2">
            <input
              id="password"
              name="password"
              type={reveal ? "text" : "password"}
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              required
              minLength={mode === "signup" ? 8 : undefined}
              className="w-full rounded-lg border border-ink/25 bg-paper py-3 pr-12 pl-4 text-ink"
            />
            <button
              type="button"
              onClick={() => setReveal(!reveal)}
              aria-label={reveal ? "Hide password" : "Show password"}
              aria-pressed={reveal}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ink/50 transition-colors hover:text-ink"
            >
              {reveal ? <EyeOff /> : <Eye />}
            </button>
          </div>
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
      </form>

      {/*
        Its own form, since forms cannot nest, and placed between the submit
        button and the mode toggle: below the email action, above the link that
        switches which email action you are taking.
      */}
      <form action={signInWithGoogle} className="mt-4">
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          className="label flex w-full items-center justify-center gap-3 rounded-full bg-ink px-7 py-4 text-mist transition-opacity hover:opacity-90"
        >
          <GoogleMark />
          Continue with Google
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-4 block text-sm text-ink/55 underline decoration-ink/25 underline-offset-4 transition-colors hover:text-ink"
      >
        {mode === "signin" ? "Create an account" : "Sign in instead"}
      </button>
    </div>
  );
}

function Eye() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M10.6 5.2A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.2 6.2A17.6 17.6 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.2-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m3 3 18 18" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z"
      />
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72l2.84 2.2c1.66-1.53 2.76-3.79 2.76-6.56z"
      />
      <path
        fill="#FBBC05"
        d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A8.99 8.99 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.4-1.57-5.13-3.74L.96 13.04C2.44 15.98 5.48 18 9 18z"
      />
    </svg>
  );
}
