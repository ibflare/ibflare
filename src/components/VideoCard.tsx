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
    /*
     * The card owns its own border and radius rather than being a flat panel
     * separated by a 1px gap in a tinted grid.
     *
     * The gap trick draws dividers by letting a container background show
     * through, which has two problems in a grid that is not always full: an
     * empty cell shows as a grey rectangle, and a card shorter than its row
     * leaves grey under it. Real borders and real gaps mean the page
     * background is what shows in both cases.
     *
     * h-full is what makes every card in a row the same height, since the grid
     * stretches the cell but the link inside it would otherwise size to its
     * own content and leave a gap beneath a short title.
     */
    <Link
      href={`/v/${video.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-ink/15 bg-paper transition-colors hover:border-ink/30 hover:bg-paper-deep/50"
    >
      <div className="relative aspect-video overflow-hidden border-b border-ink/10 bg-ink/8">
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
