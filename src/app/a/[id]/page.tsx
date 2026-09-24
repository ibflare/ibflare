import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { publicTag } from "@/lib/profiles";
import { readingMinutes } from "@/components/ArticleCard";
import {
  DIFFICULTY_LEVELS,
  TOPIC_LABELS,
  difficultyAccent,
} from "@/lib/taxonomy";
import type { Topic } from "@/lib/taxonomy";

type ArticlePage = {
  id: string;
  title: string;
  description: string | null;
  body: string;
  difficulty: number;
  topic: string;
  published_at: string | null;
  edited_at: string | null;
  owner_username: string;
  owner_display_name: string;
  owner_avatar_url: string | null;
  owner_title: string | null;
  owner_role: string;
};

async function readArticle(id: string): Promise<ArticlePage | null> {
  // A malformed id would make PostgREST raise 22P02 rather than return
  // nothing, so check the shape before asking.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("public_articles")
    .select(
      "id, title, description, body, difficulty, topic, published_at, edited_at, owner_username, owner_display_name, owner_avatar_url, owner_title, owner_role",
    )
    .eq("id", id)
    .maybeSingle();

  return (data as ArticlePage | null) ?? null;
}

export async function generateMetadata({ params }: PageProps<"/a/[id]">) {
  const { id } = await params;
  const article = await readArticle(id);
  if (!article) return { title: "Article not found" };

  return {
    title: article.title,
    description: article.description ?? article.body.slice(0, 160),
  };
}

export default async function ArticlePage({ params }: PageProps<"/a/[id]">) {
  const { id } = await params;
  const article = await readArticle(id);

  if (!article) notFound();

  const level = DIFFICULTY_LEVELS.find((l) => l.level === article.difficulty);
  const tag = publicTag(article.owner_role, article.owner_title);

  /*
   * Plain text, split on blank lines into paragraphs.
   *
   * Nothing here renders markup, and that is the design rather than a
   * shortcut: the body is arbitrary text submitted by a student, so anything
   * that turned it into HTML would be an injection surface on a site whose
   * users are minors. See 20260923000000. React escapes each paragraph, and
   * whitespace-pre-line keeps single line breaks inside one.
   */
  const paragraphs = article.body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <article className="mx-auto max-w-2xl px-6 py-16 sm:py-20">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Link
          href={`/library?difficulty=${article.difficulty}`}
          className="label transition-opacity hover:opacity-70"
          style={{ color: difficultyAccent(article.difficulty) }}
        >
          {article.difficulty}. {level?.name}
        </Link>
        <Link
          href={`/library?topic=${article.topic}`}
          className="label text-ink/40 transition-colors hover:text-ink"
        >
          {TOPIC_LABELS[article.topic as Topic] ?? article.topic}
        </Link>
        <span className="label text-ink/35">
          {readingMinutes(article.body)} min read
        </span>
      </div>

      <h1 className="font-display mt-5 text-4xl leading-[1.1] font-medium text-balance sm:text-5xl">
        {article.title}
      </h1>

      {article.description && (
        <p className="mt-5 text-lg leading-relaxed text-ink/70">
          {article.description}
        </p>
      )}

      <div className="mt-8 flex items-center gap-3 border-y border-ink/10 py-5">
        <Link href={`/u/${article.owner_username}`} className="shrink-0">
          <Avatar
            src={article.owner_avatar_url}
            displayName={article.owner_display_name}
            px={40}
            className="size-10"
          />
        </Link>
        <div className="min-w-0">
          <Link
            href={`/u/${article.owner_username}`}
            className="font-medium transition-colors hover:text-ink/70"
          >
            {article.owner_display_name}
          </Link>
          {tag && <span className="label ml-3 text-ink/40">{tag}</span>}
          {article.published_at && (
            <p className="text-sm text-ink/45">
              {new Date(article.published_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
              {article.edited_at && ", edited"}
            </p>
          )}
        </div>
      </div>

      <div className="mt-10 space-y-6">
        {paragraphs.map((paragraph, i) => (
          <p
            key={i}
            className="leading-relaxed whitespace-pre-line text-ink/85"
          >
            {paragraph}
          </p>
        ))}
      </div>

      <div className="mt-14 flex flex-wrap gap-4 border-t border-ink/10 pt-8">
        <Link
          href={`/library?difficulty=${article.difficulty}`}
          className="label rounded-full border border-ink/25 px-6 py-3.5 transition-colors hover:border-ink"
        >
          More at level {article.difficulty}
        </Link>
        <Link
          href="/library"
          className="label px-2 py-3.5 text-ink/55 transition-colors hover:text-ink"
        >
          Back to the library
        </Link>
      </div>
    </article>
  );
}
