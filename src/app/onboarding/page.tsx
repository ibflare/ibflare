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

  if (profile?.onboarded) redirect(`/u/${profile.username}`);

  // Built here rather than in the client component: the two would disagree
  // across a new year boundary and hydration would fail.
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 96 }, (_, i) => thisYear - i);

  return (
    <div className="mx-auto max-w-lg px-6 py-16 sm:py-20">
      <h1 className="font-display text-4xl leading-[1.1] font-medium text-balance">
        Set up your account
      </h1>

      <OnboardingForm
        years={years}
        initial={{
          birth_month: "",
          birth_year: "",
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
  );
}
