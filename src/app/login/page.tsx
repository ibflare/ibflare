import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginPanel } from "./LoginPanel";

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
      <LoginPanel next={next} error={error} />
    </div>
  );
}
