import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signInWithGoogle } from "@/app/auth/actions";
import { EmailAuthForm } from "./EmailAuthForm";

export const metadata = {
  title: "Sign in",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  // Blank tells the callback to resolve the destination from the account.
  const next = typeof params.next === "string" ? params.next : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    if (next.startsWith("/") && !next.startsWith("//")) redirect(next);

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, onboarded")
      .eq("id", user.id)
      .maybeSingle();

    redirect(profile?.onboarded ? `/u/${profile.username}` : "/onboarding");
  }

  return (
    // Centred in the space between header and footer rather than sitting at
    // the top of it. min-h is viewport less the 4rem header.
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-16">
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

        <form action={signInWithGoogle} className="mt-8">
          <input type="hidden" name="next" value={next} />
          <button
            type="submit"
            className="label flex w-full items-center justify-center gap-3 rounded-full bg-ink px-7 py-4 text-mist transition-opacity hover:opacity-90"
          >
            <GoogleMark />
            Continue with Google
          </button>
        </form>

        <EmailAuthForm next={next} />
      </div>
    </div>
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
