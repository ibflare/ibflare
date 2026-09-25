"use client";

import { Select } from "@/components/Select";
import { DIFFICULTY_LEVELS, TOPICS, TOPIC_LABELS } from "@/lib/taxonomy";

/**
 * Level, topic and type as three dropdowns.
 *
 * These were three rows of pills, which is twenty-one controls permanently on
 * screen and, once `other` joined the topics, two of those rows wrapping. The
 * filters were taking more vertical space than the results.
 *
 * They live inside a plain GET form, so the URL stays shareable. `page` is
 * deliberately not a field in it, so changing a filter drops you back to page
 * one instead of asking for page 4 of a result set that no longer has one.
 *
 * The control itself is `src/components/Select.tsx`, shared with the forms.
 * The `pill` variant and `submitOnChange` are the only things specific here.
 */
export function LibraryFilters({
  q,
  difficulty,
  topic,
  type,
}: {
  q: string;
  difficulty: string;
  topic: string;
  type: string;
}) {
  /*
   * Empty controls are removed from the submission rather than sent blank.
   *
   * A GET form serialises every named control it contains, so without this a
   * single filter produced `?q=&difficulty=&topic=&type=article`: three dead
   * parameters in a URL section 7 wants people to paste to each other.
   * Disabling a control is the standard way to keep it out of the payload,
   * and it happens after the submit is already under way, so nothing flickers.
   *
   * Both submit paths reach this: the dropdowns through requestSubmit, which
   * fires the submit event where form.submit() would skip it, and the Search
   * button natively.
   */
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const blanks = Array.from(event.currentTarget.elements).filter(
      (el): el is HTMLInputElement =>
        el instanceof HTMLInputElement && el.name !== "" && el.value === "",
    );
    blanks.forEach((el) => (el.disabled = true));
    // Re-enabled so the controls still work if the navigation is cancelled or
    // the browser restores this page from its back/forward cache.
    window.setTimeout(() => blanks.forEach((el) => (el.disabled = false)), 0);
  };

  return (
    <form action="/library" method="get" onSubmit={onSubmit} className="mt-8">
      <div className="flex max-w-lg gap-3">
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
      </div>

      {/*
        Keyed on the value so a soft navigation resets the control. Its idea of
        what is chosen is React state, and "Clear filters" and the pagination
        links are Links rather than form submits, so without the key the
        buttons keep their old labels on a page that no longer has those
        filters.
      */}
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-ink/10 pt-6">
        <Select
          key={`difficulty-${difficulty}`}
          variant="pill"
          submitOnChange
          name="difficulty"
          label="Level"
          defaultValue={difficulty}
          placeholder="All levels"
          options={DIFFICULTY_LEVELS.map((l) => ({
            value: String(l.level),
            label: `${l.level}. ${l.name}`,
          }))}
        />

        <Select
          key={`topic-${topic}`}
          variant="pill"
          submitOnChange
          name="topic"
          label="Topic"
          defaultValue={topic}
          placeholder="All topics"
          options={TOPICS.map((t) => ({ value: t, label: TOPIC_LABELS[t] }))}
        />

        <Select
          key={`type-${type}`}
          variant="pill"
          submitOnChange
          name="type"
          label="Type"
          defaultValue={type}
          placeholder="All types"
          options={[
            { value: "video", label: "Videos" },
            { value: "article", label: "Articles" },
          ]}
        />
      </div>
    </form>
  );
}
