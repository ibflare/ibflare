import { notFound } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { SettingsForm } from "./SettingsForm";

export const metadata = { title: "Settings" };

/**
 * The kill switches. Section 4: one person flips a switch in ten seconds, with
 * no deploy, no code change, and no waiting on whoever has repo access.
 *
 * Gated on can_manage_users, and `set_site_settings` checks the same thing
 * again. The table has no UPDATE policy and no update grant at all, so that
 * function is the only path and every flip lands in the log with a name on it.
 */
export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile?.can_manage_users) notFound();

  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("site_settings")
    .select("comments_enabled, signups_enabled, updated_by, updated_at")
    .eq("id", 1)
    .maybeSingle();

  let updatedByName: string | null = null;
  if (settings?.updated_by) {
    const { data: who } = await supabase
      .from("public_profiles")
      .select("display_name")
      .eq("id", settings.updated_by)
      .maybeSingle();
    updatedByName = who?.display_name ?? null;
  }

  return (
    <div>
      <h2 className="font-display text-2xl leading-snug font-medium">
        Settings
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink/70">
        Two switches that take effect immediately, for everyone, without a
        deploy.
      </p>

      <SettingsForm
        commentsEnabled={settings?.comments_enabled ?? true}
        signupsEnabled={settings?.signups_enabled ?? true}
        updatedAt={settings?.updated_at ?? null}
        updatedByName={updatedByName}
      />

      {/*
        Worth saying on the page rather than only in the spec: the switch is
        checked in the database, so it holds even against someone calling the
        API directly. A sponsor flipping it during a school week needs to know
        it actually stops things.
      */}
      <p className="mt-12 max-w-xl border-t border-ink/10 pt-6 text-sm leading-relaxed text-ink/55">
        Both switches are enforced by the database, not just hidden in the
        interface, so turning one off stops the thing itself rather than the
        button for it.
      </p>
    </div>
  );
}
