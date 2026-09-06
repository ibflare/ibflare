import { notFound } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";

export const metadata = { title: "Log" };

type Entry = {
  id: number;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
  actor_username: string | null;
  actor_name: string | null;
};

/**
 * The audit log, newest first. Gated on can_moderate.
 *
 * Read through `read_audit_log` rather than querying the table. The policy
 * already limits SELECT to moderators, so the rows themselves are reachable,
 * but `actor_id` points at `profiles` and a moderator without
 * `can_manage_users` cannot read anyone else's profile row. A plain query
 * therefore produces a log of "somebody did something", which is no use to
 * exactly the people this page is for.
 */
const LABELS: Record<string, string> = {
  "user.permissions": "Permissions changed",
  "user.suspend": "Account suspended",
  "user.unsuspend": "Suspension lifted",
  "video.delete": "Video removed",
  "video.restore": "Video restored",
  "profile.avatar_clear": "Profile picture cleared",
  "settings.update": "Site settings changed",
  "comment.delete": "Comment removed",
};

export default async function LogPage() {
  const profile = await getCurrentProfile();
  if (!profile?.can_moderate) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("read_audit_log", { p_limit: 200 });

  const entries = (data ?? []) as Entry[];

  return (
    <div>
      <h2 className="font-display text-2xl leading-snug font-medium">Log</h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink/70">
        Every permission change, suspension, and removal, newest first. Entries
        are never edited or deleted.
      </p>

      {error ? (
        <p role="alert" className="mt-10 leading-relaxed text-ink/70">
          {error.message}
        </p>
      ) : entries.length === 0 ? (
        <p className="mt-10 leading-relaxed text-ink/70">
          Nothing has been logged yet. Entries appear here as soon as anyone
          changes a permission, suspends an account, or removes a video.
        </p>
      ) : (
        <ul className="mt-10 space-y-px overflow-hidden rounded-lg bg-ink/12">
          {entries.map((entry) => (
            <li key={entry.id} className="bg-paper px-5 py-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="label">
                  {LABELS[entry.action] ?? entry.action}
                </span>
                <span className="text-sm text-ink/45 tabular-nums">
                  {new Date(entry.created_at).toLocaleString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              <p className="mt-2 text-sm leading-relaxed text-ink/75">
                {entry.actor_name ?? "A deleted account"}
                {entry.target ? ` acted on ${entry.target}` : ""}
              </p>

              {/*
                The detail verbatim. It is deliberately not prettified per
                action: this is the record, and a renderer that only knows
                about today's action types would silently hide tomorrow's.
              */}
              {entry.detail && Object.keys(entry.detail).length > 0 && (
                <pre className="mt-3 overflow-x-auto rounded-md bg-ink/5 px-3 py-2 text-xs leading-relaxed text-ink/60">
                  {JSON.stringify(entry.detail, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
