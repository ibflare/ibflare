import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { DIFFICULTY_LEVELS, difficultyAccent } from "@/lib/taxonomy";
import { VideoModeration } from "./VideoModeration";

export const metadata = { title: "All videos" };

type Row = {
  id: string;
  title: string;
  status: string;
  difficulty: number;
  owner_id: string;
  created_at: string;
  deleted_at: string | null;
};

/**
 * Every video, including deleted ones. Gated on can_moderate.
 *
 * notFound rather than a redirect or an explanation: a member who guesses this
 * URL learns nothing from a 404, where "you do not have permission to moderate"
 * confirms the page exists and tells them what to ask for.
 *
 * Reads the base table, not public_videos, because the point of the page is
 * the rows that view hides: drafts, hidden videos, and soft-deleted ones. The
 * moderator select policy from 20260904000000 is what allows it.
 */
export default async function AdminVideosPage() {
  const profile = await getCurrentProfile();
  if (!profile?.can_moderate) notFound();

  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("videos")
    .select("id, title, status, difficulty, owner_id, created_at, deleted_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const videos = (rows ?? []) as Row[];

  const { data: people } = await supabase
    .from("public_profiles")
    .select("id, display_name, username")
    .in(
      "id",
      videos.length > 0 ? [...new Set(videos.map((v) => v.owner_id))] : ["none"],
    );

  const byId = new Map((people ?? []).map((p) => [p.id, p]));

  const live = videos.filter((v) => !v.deleted_at);
  const removed = videos.filter((v) => v.deleted_at);

  return (
    <div className="space-y-14">
      <section>
        <h2 className="font-display text-2xl leading-snug font-medium">
          All videos
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink/70">
          Every video on the site, including drafts and hidden ones. Newest
          first, capped at 200.
        </p>

        {live.length === 0 ? (
          <p className="mt-6 text-ink/70">Nothing published yet.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {live.map((video) => (
              <li
                key={video.id}
                className="flex flex-col gap-3 rounded-2xl border border-ink/15 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span
                      className="label"
                      style={{ color: difficultyAccent(video.difficulty) }}
                    >
                      {video.difficulty}.{" "}
                      {
                        DIFFICULTY_LEVELS.find(
                          (l) => l.level === video.difficulty,
                        )?.name
                      }
                    </span>
                    {video.status !== "published" && (
                      <span className="label text-ink/40">{video.status}</span>
                    )}
                  </div>
                  <p className="font-display mt-2 text-lg leading-snug font-medium">
                    {video.status === "published" ? (
                      <Link
                        href={`/v/${video.id}`}
                        className="transition-colors hover:text-ink/70"
                      >
                        {video.title}
                      </Link>
                    ) : (
                      video.title
                    )}
                  </p>
                  <p className="mt-1.5 text-sm text-ink/55">
                    {byId.get(video.owner_id) ? (
                      <Link
                        href={`/u/${byId.get(video.owner_id)!.username}`}
                        className="transition-colors hover:text-ink"
                      >
                        {byId.get(video.owner_id)!.display_name}
                      </Link>
                    ) : (
                      "Unknown owner"
                    )}
                  </p>
                </div>
                <VideoModeration videoId={video.id} deleted={false} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/*
        Section 3: deleted rows stay recoverable and moderators can see them
        here. That is the entire reason deletes are soft, so the list is not
        hidden behind a toggle.
      */}
      <section>
        <h2 className="font-display text-2xl leading-snug font-medium">
          Removed
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink/70">
          Deleted videos are hidden from the site but kept. Restoring one puts
          it straight back in the library.
        </p>

        {removed.length === 0 ? (
          <p className="mt-6 text-ink/70">Nothing has been removed.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {removed.map((video) => (
              <li
                key={video.id}
                className="flex flex-col gap-3 rounded-2xl border border-ink/15 bg-paper-deep/40 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-display text-lg leading-snug font-medium">
                    {video.title}
                  </p>
                  <p className="mt-1.5 text-sm text-ink/55">
                    {byId.get(video.owner_id)?.display_name ?? "Unknown owner"}
                    {" · removed "}
                    {new Date(video.deleted_at!).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <VideoModeration videoId={video.id} deleted />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Reported comments land here in phase 5, with the comments table. */}
    </div>
  );
}
