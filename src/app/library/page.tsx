import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { VideoCard, type VideoRow } from "@/components/VideoCard";
import { DIFFICULTY_LEVELS, TOPICS, TOPIC_LABELS, difficultyAccent } from "@/lib/taxonomy";

export const metadata = {
  title: "Library",
  description:
    "Every FLARE video, sorted by difficulty. Search, or filter by level and topic.",
};

const PER_PAGE = 12;

/** Only these are read from the query string, so an odd URL cannot break a query. */
function readParams(raw: Record<string, string | string[] | undefined>) {
  const one = (key: string) => {
    const value = raw[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  };

  const difficultyRaw = one("difficulty");
  const topicRaw = one("topic");
  const pageRaw = Number(one("page"));

  return {
    q: one("q").slice(0, 120),
    difficulty: DIFFICULTY_LEVELS.some((l) => String(l.level) === difficultyRaw)
      ? difficultyRaw
      : "",
    topic: (TOPICS as readonly string[]).includes(topicRaw) ? topicRaw : "",
    page: Number.isFinite(pageRaw) && pageRaw > 1 ? Math.floor(pageRaw) : 1,
  };
}

/** A link that keeps the other filters, and always resets to page one. */
function href(
  current: { q: string; difficulty: string; topic: string },
  change: Partial<{ difficulty: string; topic: string; page: number }>,
) {
  const params = new URLSearchParams();
  const merged = { ...current, ...change };

  if (current.q) params.set("q", current.q);
  if (merged.difficulty) params.set("difficulty", merged.difficulty);
  if (merged.topic) params.set("topic", merged.topic);
  if (change.page && change.page > 1) params.set("page", String(change.page));

  const query = params.toString();
  return query ? `/library?${query}` : "/library";
}

export default async function LibraryPage(props: PageProps<"/library">) {
  const { q, difficulty, topic, page } = readParams(await props.searchParams);

  const supabase = await createClient();

  /*
   * public_videos, not the videos table: it carries the owner's public fields
   * for the byline, and it already filters to published and non-deleted rows.
   * See 20260904000000.
   */
  let query = supabase
    .from("public_videos")
    .select(
      "id, title, description, youtube_id, thumbnail_url, duration_s, difficulty, topic, published_at, owner_username, owner_display_name, owner_avatar_url",
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

  const from = (page - 1) * PER_PAGE;

  const { data, count, error } = await query
    .order("published_at", { ascending: false })
    .range(from, from + PER_PAGE - 1);

  const videos = (data ?? []) as VideoRow[];
  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));
  const filtering = Boolean(q || difficulty || topic);
  const current = { q, difficulty, topic };

  return (
    <section>
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <h1 className="font-display text-4xl leading-[1.1] font-medium text-balance sm:text-5xl">
          Library
        </h1>
        <p className="mt-6 max-w-xl leading-relaxed text-ink/70">
          Every video, with the level it assumes. If one takes something for
          granted that you have not learned yet, look for a lower number on the
          same topic.
        </p>

        {/* A plain GET form, so search works with no JavaScript and the URL
            stays shareable. */}
        <form action="/library" method="get" className="mt-10 flex max-w-lg gap-3">
          {difficulty && <input type="hidden" name="difficulty" value={difficulty} />}
          {topic && <input type="hidden" name="topic" value={topic} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            aria-label="Search the library"
            placeholder="Search titles and descriptions"
            className="min-w-0 flex-1 rounded-full border border-ink/25 bg-paper px-5 py-3 text-ink"
          />
          <button
            type="submit"
            className="label shrink-0 rounded-full bg-ink px-6 py-3 text-mist transition-opacity hover:opacity-90"
          >
            Search
          </button>
        </form>

        <div className="mt-10 space-y-5 border-t border-ink/10 pt-8">
          <Filter label="Level">
            <Pill href={href(current, { difficulty: "" })} active={!difficulty}>
              All
            </Pill>
            {DIFFICULTY_LEVELS.map((level) => (
              <Pill
                key={level.level}
                href={href(current, { difficulty: String(level.level) })}
                active={difficulty === String(level.level)}
                color={difficultyAccent(level.level)}
              >
                {level.level}. {level.name}
              </Pill>
            ))}
          </Filter>

          <Filter label="Topic">
            <Pill href={href(current, { topic: "" })} active={!topic}>
              All
            </Pill>
            {TOPICS.map((t) => (
              <Pill
                key={t}
                href={href(current, { topic: t })}
                active={topic === t}
              >
                {TOPIC_LABELS[t]}
              </Pill>
            ))}
          </Filter>
        </div>

        {error ? (
          <p role="alert" className="mt-14 leading-relaxed text-ink/70">
            The library could not be loaded just now. Try again in a moment.
          </p>
        ) : videos.length === 0 ? (
          <div className="mt-14 max-w-xl">
            <p className="font-display text-2xl leading-snug font-medium">
              {filtering ? "Nothing matches that yet" : "The library is empty"}
            </p>
            <p className="mt-4 leading-relaxed text-ink/70">
              {filtering
                ? "Try a different level or topic, or clear the filters."
                : "Videos will show up here as members publish them."}
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
              {total} {total === 1 ? "video" : "videos"}
            </p>

            <ul className="mt-6 grid gap-px overflow-hidden rounded-lg bg-ink/12 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((video) => (
                <li key={video.id} className="flex">
                  <div className="flex w-full flex-col">
                    <VideoCard video={video} />
                  </div>
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

function Filter({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
      <span className="label w-16 shrink-0 text-ink/45">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Pill({
  href,
  active,
  color,
  children,
}: {
  href: string;
  active: boolean;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`label rounded-full border px-4 py-2.5 transition-colors ${
        active
          ? "border-ink bg-ink text-mist"
          : "border-ink/20 text-ink/70 hover:border-ink/50 hover:text-ink"
      }`}
      style={active || !color ? undefined : { color }}
    >
      {children}
    </Link>
  );
}
