import Image from "next/image";
import Link from "next/link";
import { Avatar } from "./Avatar";
import { DIFFICULTY_LEVELS, TOPIC_LABELS, difficultyAccent } from "@/lib/taxonomy";
import { formatDuration } from "@/lib/youtube";
import type { Topic } from "@/lib/taxonomy";

export type VideoRow = {
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
  owner_avatar_url: string | null;
};

/**
 * One video in the library grid.
 *
 * The whole card is a single link to the video page. The byline is inside it,
 * so it is deliberately not a link to the contributor's profile: a link inside
 * a link is invalid, and phase 4 puts the profile link on the video page where
 * it has room.
 */
export function VideoCard({ video }: { video: VideoRow }) {
  const level = DIFFICULTY_LEVELS.find((l) => l.level === video.difficulty);
  const duration = formatDuration(video.duration_s);

  return (
    <Link
      href={`/v/${video.id}`}
      className="group flex flex-col bg-paper transition-colors hover:bg-paper-deep/60"
    >
      <div className="relative aspect-video overflow-hidden bg-ink/8">
        {video.thumbnail_url && (
          <Image
            src={video.thumbnail_url}
            alt=""
            width={480}
            height={360}
            className="size-full object-cover"
            unoptimized
          />
        )}
        {duration && (
          <span className="absolute right-2 bottom-2 rounded bg-ink/85 px-1.5 py-0.5 text-xs font-medium text-mist tabular-nums">
            {duration}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-baseline gap-2">
          <span
            className="label"
            style={{ color: difficultyAccent(video.difficulty) }}
          >
            {video.difficulty}. {level?.name}
          </span>
          <span className="label text-ink/40">
            {TOPIC_LABELS[video.topic as Topic] ?? video.topic}
          </span>
        </div>

        <h3 className="font-display mt-3 text-lg leading-snug font-medium text-balance">
          {video.title}
        </h3>

        <div className="mt-auto flex items-center gap-2.5 pt-5">
          <Avatar
            src={video.owner_avatar_url}
            displayName={video.owner_display_name}
            px={28}
            className="size-7"
          />
          <span className="truncate text-sm text-ink/55">
            {video.owner_display_name}
          </span>
        </div>
      </div>
    </Link>
  );
}
