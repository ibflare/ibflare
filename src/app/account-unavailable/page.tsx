import Link from "next/link";

export const metadata = {
  title: "Accounts are not available to you yet",
};

/**
 * Where someone lands after failing the age screen.
 *
 * A separate public page rather than a message on /onboarding, because by the
 * time this renders the account has been deleted and the session cleared, so
 * /onboarding would just bounce them to /login with no explanation at all.
 */
export default function AccountUnavailablePage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-4xl leading-tight font-medium text-balance">
          Accounts are not available to you yet.
        </h1>
        <Link
          href="/"
          className="mt-8 block text-sm text-ink/55 underline decoration-ink/25 underline-offset-4 transition-colors hover:text-ink"
        >
          Back to FLARE
        </Link>
      </div>
    </div>
  );
}
