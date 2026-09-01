import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginPanel } from "./LoginPanel";
import { DIFFICULTY_LEVELS, difficultyAccent } from "@/lib/taxonomy";

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
    /*
     * Two panels from lg up. The form alone left most of the page empty, which
     * is a lot of nothing to sign in against.
     *
     * The left panel carries the mark and the ladder rather than sales copy:
     * the five level names are what the site is, and they are useful to see
     * before you have an account. Hidden below lg, where the form fills the
     * screen on its own.
     */
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[1.1fr_1fr]">
      <div className="hidden flex-col justify-between bg-ink px-12 py-16 text-mist lg:flex xl:px-16">
        <div>
          <Image
            src="/images/FLARE_WORDMARK_MIST.png"
            alt="FLARE"
            width={1993}
            height={517}
            className="h-10 w-auto"
          />
          <p className="label mt-5 text-mist/55">
            Financial Literacy Advancement for RGV Equity
          </p>
        </div>

        <ul className="space-y-5">
          {DIFFICULTY_LEVELS.map((level) => (
            <li key={level.level} className="flex items-baseline gap-4">
              <span
                className="font-display w-5 text-2xl leading-none font-semibold tabular-nums"
                style={{ color: difficultyAccent(level.level) }}
              >
                {level.level}
              </span>
              <span className="font-display text-xl leading-none font-medium">
                {level.name}
              </span>
              <span className="label text-mist/40">{level.audience}</span>
            </li>
          ))}
        </ul>

        <p className="max-w-sm text-sm leading-relaxed text-mist/60">
          A student-run video library at Lamar Academy.
        </p>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <LoginPanel next={next} error={error} />
      </div>
    </div>
  );
}
