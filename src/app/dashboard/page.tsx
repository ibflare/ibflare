import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { DIFFICULTY_LEVELS, difficultyAccent } from "@/lib/taxonomy";
import { formatDuration } from "@/lib/youtube";
import { InviteResponse } from "./InviteResponse";
import { VideoRowControls } from "./VideoRowControls";

export const metadata = { title: "Dashboard" };

type VideoLite = {
  id: string;
  title: string;
  status: string;
  difficulty: number;
  duration_s: number | null;
  created_at: string;
  owner_id: string;
};

/**
 * Display names for a set of profile ids.
 *
 * A second query rather than a PostgREST embed, and it has to be. The base
 * `profiles` table is readable only for your own row, so `videos(...,
 * profiles(display_name))` comes back with a null for everyone else. Names
 * live in `public_profiles`, and a view has no foreign key for an embed to
 * follow, so the join happens here.
 */
async function nameMap(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map();

  const supabase = await createClient();
  const { data } = await supabase
    .from("public_profiles")
    .select("id, display_name")
    .in("id", unique);

  return new Map((data ?? []).map((row) => [row.id, row.display_name]));
}

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null; // The layout has already redirected.

  const supabase = await createClient();

  /*
   * Own videos, from the base table rather than public_videos, because this is
   * the one place drafts and hidden videos have to be visible. The owner
   * select policy allows it; public_videos filters them out by design.
   */
  const { data: ownedRaw } = await supabase
    .from("videos")
    .select("id, title, status, difficulty, duration_s, created_at, owner_id")
    .eq("owner_id", profile.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const owned = (ownedRaw ?? []) as VideoLite[];

  // Every tag on my own videos, whatever its state. Pending is mine to see.
  const { data: tagsOnMine } = await supabase
    .from("video_collaborators")
    .select("video_id, profile_id, status")
    .in("video_id", owned.length > 0 ? owned.map((v) => v.id) : ["none"]);

  // Tags on me: pending ones to answer, accepted ones to show as credits.
  const { data: myTags } = await supabase
    .from("video_collaborators")
    .select("video_id, status, invited_at, videos(id, title, status, difficulty, duration_s, created_at, owner_id)")
    .eq("profile_id", profile.id)
    .order("invited_at", { ascending: false });

  const tagRows = (myTags ?? []) as unknown as {
    video_id: string;
    status: string;
    videos: VideoLite | null;
  }[];

  const pending = tagRows.filter((r) => r.status === "pending" && r.videos);
  const credited = tagRows.filter((r) => r.status === "accepted" && r.videos);

  const names = await nameMap([
    ...(tagsOnMine ?? []).map((t) => t.profile_id),
    ...pending.map((r) => r.videos!.owner_id),
    ...credited.map((r) => r.videos!.owner_id),
  ]);

  const collaboratorsFor = (videoId: string) =>
    (tagsOnMine ?? [])
      .filter((t) => t.video_id === videoId)
      .map((t) => ({
        profile_id: t.profile_id,
        display_name: names.get(t.profile_id) ?? "Someone",
        status: t.status,
      }));

  return (
    <div className="space-y-16">
      {/* Actionable first: somebody is waiting on an answer. */}
      {pending.length > 0 && (
        <section>
          <h2 className="font-display text-2xl leading-snug font-medium">
            {pending.length === 1
              ? "You have been tagged on a video"
              : `You have been tagged on ${pending.length} videos`}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink/70">
            Accepting puts your name on the byline. Nothing shows publicly
            until you do.
          </p>

          <ul className="mt-6 space-y-4">
            {pending.map((row) => (
              <li
                key={row.video_id}
                className="flex flex-col gap-4 rounded-2xl border border-ink/15 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-display text-lg leading-snug font-medium">
                    {row.videos!.title}
                  </p>
                  <p className="mt-1.5 text-sm text-ink/55">
                    Posted by {names.get(row.videos!.owner_id) ?? "a member"}
                  </p>
                </div>
                <InviteResponse videoId={row.video_id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl leading-snug font-medium">
            My videos
          </h2>
          {profile.can_post && !profile.suspended_at && (
            <Link
              href="/dashboard/upload"
              className="label rounded-full bg-ink px-5 py-3 text-mist transition-opacity hover:opacity-90"
            >
              Publish a video
            </Link>
          )}
        </div>

        {owned.length === 0 ? (
          <p className="mt-6 max-w-xl leading-relaxed text-ink/70">
            {profile.can_post
              ? "Nothing yet. Paste a YouTube link on the upload page and it appears here."
              : "Publishing is switched on per account by a sponsor. Ask an officer if you are joining as a contributor."}
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {owned.map((video) => {
              const level = DIFFICULTY_LEVELS.find(
                (l) => l.level === video.difficulty,
              );
              const duration = formatDuration(video.duration_s);

              return (
                <li
                  key={video.id}
                  className="rounded-2xl border border-ink/15 p-5"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span
                      className="label"
                      style={{ color: difficultyAccent(video.difficulty) }}
                    >
                      {video.difficulty}. {level?.name}
                    </span>
                    {/* Only worth saying when it is not the normal case. */}
                    {video.status !== "published" && (
                      <span className="label text-ink/40">{video.status}</span>
                    )}
                    {duration && (
                      <span className="label text-ink/35 tabular-nums">
                        {duration}
                      </span>
                    )}
                  </div>

                  <p className="font-display mt-2.5 text-lg leading-snug font-medium">
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

                  <VideoRowControls
                    videoId={video.id}
                    collaborators={collaboratorsFor(video.id)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {credited.length > 0 && (
        <section>
          <h2 className="font-display text-2xl leading-snug font-medium">
            Credited on
          </h2>
          <ul className="mt-6 space-y-3">
            {credited.map((row) => (
              <li key={row.video_id} className="text-ink/75">
                <Link
                  href={`/v/${row.video_id}`}
                  className="underline decoration-ink/20 underline-offset-4 transition-colors hover:text-ink"
                >
                  {row.videos!.title}
                </Link>
                <span className="ml-3 text-sm text-ink/50">
                  by {names.get(row.videos!.owner_id) ?? "a member"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
