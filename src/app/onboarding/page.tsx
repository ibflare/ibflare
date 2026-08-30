import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";

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

  // Already done. Nothing here to repeat.
  if (profile?.onboarded) redirect(`/u/${profile.username}`);

  return (
    <section>
      <div className="mx-auto max-w-2xl px-6 py-20 sm:py-24">
        <p className="label text-ink/45">Set up your account</p>

        <h1 className="font-display mt-6 text-4xl leading-[1.1] font-medium text-balance">
          A few things before you start.
        </h1>

        <p className="mt-7 leading-relaxed text-ink/75">
          This takes a minute and you only do it once. The first two are public.
          Everything after that is only ever seen by officers and the faculty
          sponsor.
        </p>

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
