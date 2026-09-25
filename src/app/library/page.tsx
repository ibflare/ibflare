import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { VideoCard, type VideoRow } from "@/components/VideoCard";
import { ArticleCard, type ArticleRow } from "@/components/ArticleCard";
import { LibraryFilters } from "./LibraryFilters";
// Only the validation in readParams needs these now. The labels and the
// difficulty colours moved to LibraryFilters with the controls that use them.
import { DIFFICULTY_LEVELS, TOPICS } from "@/lib/taxonomy";

export const metadata = {
  title: "Library",
  description:
    "Every FLARE video and article, sorted by difficulty. Search, or filter by level and topic.",
};

/**
 * The two things the library holds.
 *
 * The URL says `type` because that is what the filter is labelled, and the
 * library's search form is deliberately a plain GET whose URL is meant to be
 * shareable. The view's column is still `kind`: that is a schema name, not
 * something a reader sees.
 */
const TYPES = ["video", "article"] as const;

const PER_PAGE = 12;

/** Only these are read from the query string, so an odd URL cannot break a query. */
function readParams(raw: Record<string, string | string[] | undefined>) {
  const one = (key: string) => {
    const value = raw[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  };

  const difficultyRaw = one("difficulty");
  const topicRaw = one("topic");
  const typeRaw = one("type");
  const pageRaw = Number(one("page"));

  return {
    q: one("q").slice(0, 120),
    difficulty: DIFFICULTY_LEVELS.some((l) => String(l.level) === difficultyRaw)
      ? difficultyRaw
      : "",
    topic: (TOPICS as readonly string[]).includes(topicRaw) ? topicRaw : "",
    type: (TYPES as readonly string[]).includes(typeRaw) ? typeRaw : "",
    page: Number.isFinite(pageRaw) && pageRaw > 1 ? Math.floor(pageRaw) : 1,
  };
}

type Current = { q: string; difficulty: string; topic: string; type: string };

/** A link that keeps the other filters, and always resets to page one. */
function href(
  current: Current,
  change: Partial<{ difficulty: string; topic: string; type: string; page: number }>,
) {
  const params = new URLSearchParams();
  const merged = { ...current, ...change };

  if (current.q) params.set("q", current.q);
  if (merged.difficulty) params.set("difficulty", merged.difficulty);
  if (merged.topic) params.set("topic", merged.topic);
  if (merged.type) params.set("type", merged.type);
  if (change.page && change.page > 1) params.set("page", String(change.page));

  const query = params.toString();
  return query ? `/library?${query}` : "/library";
}

export default async function LibraryPage(props: PageProps<"/library">) {
  const { q, difficulty, topic, type, page } = readParams(
    await props.searchParams,
  );

  const supabase = await createClient();

  /*
   * public_library, not the two tables: it unions public_videos and
   * public_articles, already filtered to published and non-deleted, and it
   * carries the owner's public fields for the byline. See 20260923000000.
   *
   * The union is what makes search, ordering, `count` and `range` mean the
   * same thing they did when the library held one kind of row. Two queries
   * merged here would make "page 2" meaningless.
   */
  let query = supabase
    .from("public_library")
    .select(
      "kind, id, title, description, youtube_id, thumbnail_url, duration_s, difficulty, topic, published_at, owner_username, owner_display_name, owner_avatar_url, collaborators, preview, reading_minutes",
      { count: "exact" },
    );

  /*
   * websearch_to_tsquery against the generated column, per section 7. It takes
   * what someone would actually type, including quoted phrases and a leading
   * minus, and never raises on malformed input the way to_tsquery does.
   *
   * Filtering happens in Postgres, not in JS. Fetching the table and filtering
   * client-side breaks at a few hundred rows.
   */
  if (q) query = query.textSearch("search_tsv", q, { type: "websearch" });
  if (difficulty) query = query.eq("difficulty", Number(difficulty));
  if (topic) query = query.eq("topic", topic);
  // The column is `kind`; the URL parameter is `type`.
  if (type) query = query.eq("kind", type);

  const from = (page - 1) * PER_PAGE;

  const { data, count, error } = await query
    .order("published_at", { ascending: false })
    .range(from, from + PER_PAGE - 1);

  type LibraryRow = (VideoRow & ArticleRow) & { kind: "video" | "article" };
  const items = (data ?? []) as LibraryRow[];
  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));
  const filtering = Boolean(q || difficulty || topic || type);
  const current = { q, difficulty, topic, type };

  return (
    <section>
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <h1 className="font-display text-4xl leading-[1.1] font-medium text-balance sm:text-5xl">
          Library
        </h1>

        {/* The search box and the three filters are one plain GET form, so
            the URL stays shareable and the page still works with JavaScript
            off: pick a filter, press Search. It lives in a client component
            because both the auto-submit and the blank-stripping need an event
            handler. */}
        <LibraryFilters q={q} difficulty={difficulty} topic={topic} type={type} />

        {error ? (
          <p role="alert" className="mt-14 leading-relaxed text-ink/70">
            The library could not be loaded just now. Try again in a moment.
          </p>
        ) : items.length === 0 ? (
          <div className="mt-14 max-w-xl">
            <p className="font-display text-2xl leading-snug font-medium">
              {filtering ? "Nothing matches that yet" : "The library is empty"}
            </p>
            <p className="mt-4 leading-relaxed text-ink/70">
              {filtering
                ? "Try a different level or topic, or clear the filters."
                : "Videos and articles will show up here as members publish them."}
            </p>
            {filtering && (
              <Link
                href="/library"
                className="label mt-8 inline-block rounded-full border border-ink/25 px-6 py-3.5 text-ink transition-colors hover:border-ink"
              >
                Clear filters
              </Link>
            )}
          </div>
        ) : (
          <>
            <p className="label mt-12 text-ink/45">
              {total}{" "}
              {type === "video"
                ? total === 1
                  ? "video"
                  : "videos"
                : type === "article"
                  ? total === 1
                    ? "article"
                    : "articles"
                  : total === 1
                    ? "item"
                    : "items"}
            </p>

            {/*
              Real gaps on the page background, not a tinted container showing
              through 1px seams. A row is not always full, and the seam trick
              renders an empty cell as a grey rectangle.
            */}
            <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                // A grid item stretches to the row height, so the card's
                // h-full has something definite to resolve against.
                <li key={`${item.kind}-${item.id}`}>
                  {item.kind === "article" ? (
                    <ArticleCard article={item} />
                  ) : (
                    <VideoCard video={item} />
                  )}
                </li>
              ))}
            </ul>

            {lastPage > 1 && (
              <nav className="mt-12 flex items-center justify-between gap-4">
                {page > 1 ? (
                  <Link
                    href={href(current, { page: page - 1 })}
                    className="label rounded-full border border-ink/25 px-6 py-3.5 text-ink transition-colors hover:border-ink"
                  >
                    Previous
                  </Link>
                ) : (
                  <span />
                )}
                <span className="label text-ink/45">
                  Page {page} of {lastPage}
                </span>
                {page < lastPage ? (
                  <Link
                    href={href(current, { page: page + 1 })}
                    className="label rounded-full border border-ink/25 px-6 py-3.5 text-ink transition-colors hover:border-ink"
                  >
                    Next
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </section>
  );
}
