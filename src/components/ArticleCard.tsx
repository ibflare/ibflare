import Link from "next/link";
import { Avatar } from "./Avatar";
import { DIFFICULTY_LEVELS, TOPIC_LABELS, difficultyAccent } from "@/lib/taxonomy";
import type { Topic } from "@/lib/taxonomy";

export type ArticleRow = {
  id: string;
  title: string;
  difficulty: number;
  topic: string;
  owner_display_name: string;
  owner_avatar_url: string | null;
  /** From public_library: the summary, or the opening of the piece. */
  preview: string | null;
  /** From public_library, computed in SQL so the body never ships here. */
  reading_minutes: number | null;
};

/** Roughly 200 words a minute, floored at one. Mirrors the SQL in public_library. */
export function readingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/**
 * One article in the library grid.
 *
 * Deliberately the same shell as VideoCard: same border, radius, h-full and
 * byline treatment, so a mixed grid reads as one library rather than two
 * things bolted together. What stands in for the thumbnail is the summary,
 * because an article with no image still has to give a reader something to
 * judge it by, and "Read" plus a minute count is what tells them at a glance
 * which kind of thing they are about to open.
 */
export function ArticleCard({ article }: { article: ArticleRow }) {
  const level = DIFFICULTY_LEVELS.find((l) => l.level === article.difficulty);
  const preview = article.preview?.trim() ?? "";

  return (
    <Link
      href={`/a/${article.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-ink/15 bg-paper transition-colors hover:border-ink/30 hover:bg-paper-deep/50"
    >
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-baseline gap-2">
          <span
            className="label"
            style={{ color: difficultyAccent(article.difficulty) }}
          >
            {article.difficulty}. {level?.name}
          </span>
          <span className="label text-ink/40">
            {TOPIC_LABELS[article.topic as Topic] ?? article.topic}
          </span>
          <span className="label ml-auto text-ink/35">Read</span>
        </div>

        <h3 className="font-display mt-3 text-lg leading-snug font-medium text-balance">
          {article.title}
        </h3>

        {preview && (
          <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-ink/60">
            {preview}
          </p>
        )}

        <div className="mt-auto flex items-center gap-2.5 pt-5">
          <Avatar
            src={article.owner_avatar_url}
            displayName={article.owner_display_name}
            px={28}
            className="size-7"
          />
          <span className="truncate text-sm text-ink/55">
            {article.owner_display_name}
          </span>
          {article.reading_minutes && (
            <span className="ml-auto shrink-0 text-sm text-ink/40 tabular-nums">
              {article.reading_minutes} min
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
