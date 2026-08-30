import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";
import { AgeForm } from "./AgeForm";

export const metadata = {
  title: "Set up your account",
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/onboarding");

  const profile = await getCurrentProfile();

  if (profile?.onboarded) redirect(`/u/${profile.username}`);

  /*
   * The age screen comes first, and on its own. Nothing else is collected
   * until it passes, so an account that turns out to be under 13 has had no
   * username, name, school or city taken from it.
   */
  if (!profile?.age_attested_at) {
    // Built here rather than in the client component: the two would disagree
    // across a new year boundary and hydration would fail.
    const thisYear = new Date().getFullYear();
    const years = Array.from({ length: 96 }, (_, i) => thisYear - i);

    return (
      <section>
        <div className="mx-auto max-w-2xl px-6 py-20 sm:py-24">
          <h1 className="font-display text-4xl leading-[1.1] font-medium text-balance">
            When were you born?
          </h1>
          <AgeForm years={years} />
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mx-auto max-w-2xl px-6 py-20 sm:py-24">
        <h1 className="font-display text-4xl leading-[1.1] font-medium text-balance">
          A few things before you start.
        </h1>

        <OnboardingForm
          initial={{
            // The signup trigger prefills a username from the email and a
            // first-name + last-initial display name from Google. Both are
            // defaults to edit, not decisions already made.
            username: profile?.username ?? "",
            display_name: profile?.display_name ?? "",
            grade: profile?.grade ?? "",
            school: profile?.school ?? "",
            city: profile?.city ?? "",
          }}
        />
      </div>
    </section>
  );
}
