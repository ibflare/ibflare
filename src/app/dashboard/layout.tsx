import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";

/**
 * Everything under /dashboard.
 *
 * The proxy already sends signed-out visitors to /login for this whole prefix,
 * so the checks here are the ones it cannot make: onboarding, and which tabs
 * this person is allowed to see. None of it is enforcement. Every page below
 * re-checks its own capability, and the database checks it again underneath
 * both, because a tab that is merely not rendered is not a permission.
 */
const TABS = [
  { href: "/dashboard", label: "My videos", need: null },
  { href: "/dashboard/admin", label: "All videos", need: "moderate" },
  { href: "/dashboard/admin/people", label: "People", need: "manage_users" },
  { href: "/dashboard/admin/log", label: "Log", need: "moderate" },
  { href: "/dashboard/admin/settings", label: "Settings", need: "manage_users" },
] as const;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login?next=/dashboard");
  if (!profile.onboarded) redirect("/onboarding");

  const visible = TABS.filter((tab) => {
    if (tab.need === "moderate") return profile.can_moderate === true;
    if (tab.need === "manage_users") return profile.can_manage_users === true;
    return true;
  });

  return (
    <section>
      <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <h1 className="font-display text-4xl leading-[1.1] font-medium sm:text-5xl">
          Dashboard
        </h1>

        {/*
          Only rendered when there is a choice to make. A member with no
          capabilities sees one tab, which is not a tab, it is a label.
        */}
        {visible.length > 1 && (
          <nav className="mt-8 flex flex-wrap gap-2 border-b border-ink/10 pb-6">
            {visible.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className="label rounded-full border border-ink/20 px-4 py-2.5 text-ink/70 transition-colors hover:border-ink/50 hover:text-ink"
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        )}

        {profile.suspended_at && (
          <p
            role="alert"
            className="mt-8 rounded-lg border border-hot/40 bg-hot/5 px-5 py-4 text-sm leading-relaxed"
          >
            Your account is suspended, so you cannot publish, tag anyone, or
            edit your profile.{" "}
            <Link href="/suspended" className="underline underline-offset-4">
              What this means
            </Link>
          </p>
        )}

        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}
