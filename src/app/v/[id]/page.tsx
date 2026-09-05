import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { Player } from "./Player";
import { publicTag } from "@/lib/profiles";
import {
  DIFFICULTY_LEVELS,
  TOPIC_LABELS,
  difficultyAccent,
  type Topic,
} from "@/lib/taxonomy";
import { formatDuration } from "@/lib/youtube";

/**
 * A video page. Public: viewing does not require an account.
 *
 * Reads public_videos, which is already limited to published, non-deleted
 * rows and carries the owner's public fields. A draft is therefore a 404 here
 * even for its owner, which is correct until the phase 4 dashboard gives
 * drafts somewhere of their own to live.
 */
type VideoDetail = {
  id: string;
  title: string;
  description: string | null;
  youtube_id: string;
  thumbnail_url: string | null;
  duration_s: number | null;
  difficulty: number;
  topic: string;
  published_at: string | null;
  owner_username: string;
  owner_display_name: string;
  owner_title: string | null;
  owner_avatar_url: string | null;
  owner_role: string;
};

/**
 * Postgres raises 22P02 on a malformed uuid rather than returning no rows, so
 * /v/not-a-uuid would be a 500 instead of a 404 without this.
 */
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getVideo(id: string): Promise<VideoDetail | null> {
  if (!UUID.test(id)) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("public_videos")
    .select(
      "id, title, description, youtube_id, thumbnail_url, duration_s, difficulty, topic, published_at, owner_username, owner_display_name, owner_title, owner_avatar_url, owner_role",
    )
    .eq("id", id)
    .maybeSingle();

  return data;
}

export async function generateMetadata({ params }: PageProps<"/v/[id]">) {
  const { id } = await params;
  const video = await getVideo(id);

  if (!video) return { title: "Video not found" };

  const level = DIFFICULTY_LEVELS.find((l) => l.level === video.difficulty);

  return {
    title: video.title,
    description:
      video.description?.slice(0, 200) ??
      `${level?.name} level, explained by ${video.owner_display_name}.`,
    openGraph: {
      title: video.title,
      images: video.thumbnail_url ? [{ url: video.thumbnail_url }] : undefined,
    },
  };
}

export default async function VideoPage({ params }: PageProps<"/v/[id]">) {
  const { id } = await params;
  const video = await getVideo(id);

  if (!video) notFound();

  const level = DIFFICULTY_LEVELS.find((l) => l.level === video.difficulty);
  const duration = formatDuration(video.duration_s);
  const tag = publicTag(video.owner_role, video.owner_title);
  const accent = difficultyAccent(video.difficulty);

  return (
    <section>
      <div className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
        <Player
          youtubeId={video.youtube_id}
          title={video.title}
          thumbnailUrl={video.thumbnail_url}
        />

        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            href={`/library?difficulty=${video.difficulty}`}
            className="label"
            style={{ color: accent }}
          >
            {video.difficulty}. {level?.name}
          </Link>
          <Link
            href={`/library?topic=${video.topic}`}
            className="label text-ink/50 transition-colors hover:text-ink"
          >
            {TOPIC_LABELS[video.topic as Topic] ?? video.topic}
          </Link>
          {duration && (
            <span className="label text-ink/40 tabular-nums">{duration}</span>
          )}
        </div>

        <h1 className="font-display mt-5 text-3xl leading-tight font-medium text-balance sm:text-4xl">
          {video.title}
        </h1>

        {/*
          The byline. One name for now: collaborators and the "and Andre L."
          form arrive with video_collaborators in phase 4.
        */}
        <div className="mt-8 flex items-center gap-3 border-y border-ink/10 py-5">
          <Link href={`/u/${video.owner_username}`} className="shrink-0">
            <Avatar
              src={video.owner_avatar_url}
              displayName={video.owner_display_name}
              px={44}
              className="size-11"
            />
          </Link>
          <div className="min-w-0">
            <Link
              href={`/u/${video.owner_username}`}
              className="font-medium transition-colors hover:text-ink/70"
            >
              {video.owner_display_name}
            </Link>
            {tag && <p className="label mt-1 text-ink/45">{tag}</p>}
          </div>
        </div>

        {video.description && (
          <div className="mt-8 max-w-2xl">
            {/*
              whitespace-pre-line, so the paragraph breaks a contributor typed
              survive without running the text through a markdown dependency.
            */}
            <p className="leading-relaxed whitespace-pre-line text-ink/75">
              {video.description}
            </p>
          </div>
        )}

        <div className="mt-12 flex flex-wrap items-center gap-4 border-t border-ink/10 pt-8">
          <Link
            href={`/library?difficulty=${video.difficulty}`}
            className="label rounded-full border border-ink/25 px-6 py-3.5 text-ink transition-colors hover:border-ink"
          >
            More at level {video.difficulty}
          </Link>
          <Link
            href="/library"
            className="text-sm text-ink/55 underline decoration-ink/25 underline-offset-4 transition-colors hover:text-ink"
          >
            Back to the library
          </Link>
        </div>

        {/* Comments are phase 5, and ship with the moderation stack or not at all. */}
      </div>
    </section>
  );
}
