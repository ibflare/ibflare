import { redirect } from "next/navigation";
import Link from "next/link";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ConfirmFromFragment } from "./ConfirmFromFragment";

export const metadata = {
  title: "Confirming your email",
};

/**
 * Where the confirmation link in a signup email lands.
 *
 * Supabase can deliver a confirmation three different ways depending on the
 * email template and the flow, and the first version of this route handled
 * only one of them, so every real link failed:
 *
 *   token_hash + type   the template was customised to use {{ .TokenHash }}
 *   code                the default {{ .ConfirmationURL }} template, which
 *                       verifies at Supabase first and then redirects here
 *                       with a PKCE code
 *   #access_token=...   the same, on projects using the implicit flow. A
 *                       fragment never reaches the server, so that case has
 *                       to be finished in the browser
 *
 * All three are handled. Confirmation is not optional: Supabase links accounts
 * by email, so an unconfirmed signup on an address someone does not own
 * becomes that address owner's account the moment they sign in with Google.
 * See CLAUDE.md section 1.
 */
export default async function ConfirmPage({
  searchParams,
}: PageProps<"/auth/confirm">) {
  const params = await searchParams;

  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;

  const tokenHash = first(params.token_hash);
  const type = first(params.type) as EmailOtpType | undefined;
  const code = first(params.code);
  const errorDescription =
    first(params.error_description) ?? first(params.error);

  if (errorDescription) {
    redirect(`/login?error=${encodeURIComponent(errorDescription)}`);
  }

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error) {
      redirect(
        `/login?error=${encodeURIComponent("That link has expired or was already used. Sign in to get a new one.")}`,
      );
    }
    redirect("/onboarding");
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      redirect(
        `/login?error=${encodeURIComponent("That link has expired or was already used. Sign in to get a new one.")}`,
      );
    }
    redirect("/onboarding");
  }

  /*
   * Nothing in the query string. Either the tokens are in the URL fragment,
   * which the server cannot see, or the link was malformed. Hand off to the
   * browser to check, and give it somewhere to go if there is nothing there.
   */
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-4xl leading-tight font-medium">
          Confirming your email
        </h1>
        <ConfirmFromFragment />
        <noscript>
          <p className="mt-6 text-sm leading-relaxed text-ink/70">
            This step needs JavaScript.{" "}
            <Link href="/login" className="underline underline-offset-4">
              Sign in
            </Link>{" "}
            instead.
          </p>
        </noscript>
      </div>
    </div>
  );
}
