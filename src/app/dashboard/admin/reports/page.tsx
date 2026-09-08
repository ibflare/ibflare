import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { ReportRow, type QueueRow } from "./ReportRow";

export const metadata = { title: "Reports" };

type LogRow = {
  id: number;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
  actor_name: string | null;
};

/**
 * The officer queue. CLAUDE.md section 4.
 *
 * Two lists. Reports, which somebody asked for, and blocked attempts, which
 * nobody did: the second tier of the filter refuses a slur and writes an
 * audit_log row rather than a comment, so there is no report and no comment to
 * find, and without this section a repeat offender is invisible.
 *
 * notFound rather than an explanation, like the other admin pages: a member
 * who guesses this URL learns nothing from a 404.
 */
export default async function ReportsPage(
  props: PageProps<"/dashboard/admin/reports">,
) {
  const profile = await getCurrentProfile();
  if (!profile?.can_moderate) notFound();

  const params = await props.searchParams;
  const raw = params.show;
  const showHandled = (Array.isArray(raw) ? raw[0] : raw) === "all";

  const supabase = await createClient();

  const [{ data: queue, error }, { data: log }] = await Promise.all([
    supabase.rpc("read_report_queue", { p_include_handled: showHandled }),
    supabase.rpc("read_audit_log", { p_limit: 200 }),
  ]);

  const rows = (queue ?? []) as QueueRow[];

  const blocked = ((log ?? []) as LogRow[])
    .filter((entry) => entry.action === "comment.blocked")
    .slice(0, 25);

  return (
    <div className="space-y-14">
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl leading-snug font-medium">
            Reported comments
          </h2>
          <Link
            href={
              showHandled
                ? "/dashboard/admin/reports"
                : "/dashboard/admin/reports?show=all"
            }
            className="label text-ink/45 underline decoration-ink/20 underline-offset-4 transition-colors hover:text-ink"
          >
            {showHandled ? "Open only" : "Include handled"}
          </Link>
        </div>

        {error ? (
          <p role="alert" className="mt-6 leading-relaxed text-ink/70">
            {error.message}
          </p>
        ) : rows.length === 0 ? (
          <p className="mt-6 max-w-xl leading-relaxed text-ink/70">
            {showHandled
              ? "Nothing has been reported."
              : "Nothing waiting. Reports show up here the moment somebody taps Report on a comment."}
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {rows.map((row) => (
              <ReportRow key={row.report_id} row={row} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-2xl leading-snug font-medium">
          Blocked before posting
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink/70">
          Comments the filter refused for a slur. These were never posted and
          nobody reported them; they are here so a repeat pattern from one
          account is visible. Swearing is refused without a record.
        </p>

        {blocked.length === 0 ? (
          <p className="mt-6 leading-relaxed text-ink/70">Nothing blocked.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {blocked.map((entry) => (
              <li
                key={entry.id}
                className="rounded-2xl border border-ink/15 bg-paper-deep/40 p-5"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-medium">
                    {entry.actor_name ?? "Unknown account"}
                  </span>
                  <span className="label text-ink/35">
                    {new Date(entry.created_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <blockquote className="mt-2.5 border-l-2 border-hot/40 pl-4">
                  <p className="text-sm leading-relaxed whitespace-pre-line text-ink/70">
                    {String(entry.detail?.body ?? "")}
                  </p>
                </blockquote>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
