"use client";

import { DIFFICULTY_LEVELS, TOPICS, TOPIC_LABELS } from "@/lib/taxonomy";

/**
 * Level, topic and type as three dropdowns.
 *
 * These were three rows of pills, which is twenty-one controls permanently on
 * screen and, once `other` joined the topics, two of those rows wrapping. The
 * filters were taking more vertical space than the results.
 *
 * NATIVE `select`, STYLED TO MATCH THE REST OF THE PAGE. The closed control
 * keeps the pills' `.label` type, border and filled-ink treatment, where the
 * fill now means "this filter is applied" rather than "this is the All
 * button". The open list is drawn by the operating system and cannot be
 * styled beyond its colours, and that is the trade: a custom listbox would
 * match on every pixel and would also mean rebuilding keyboard handling,
 * screen reader semantics and touch behaviour the native control gets right
 * for free.
 *
 * They live inside the page's GET form, so the URL stays shareable and the
 * page still works with JavaScript off: pick a filter, press Search. With
 * JavaScript on, `requestSubmit()` applies the change immediately, which is
 * what the pills did. `page` is deliberately not a field in that form, so
 * changing a filter drops you back to page one instead of asking for page 4 of
 * a result set that no longer has one.
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
   * Empty selects are removed from the submission rather than sent blank.
   *
   * A GET form serialises every named control it contains, so without this a
   * single filter produced `?q=&difficulty=&topic=&type=article`: three dead
   * parameters in a URL section 7 wants people to paste to each other.
   * Disabling a control is the standard way to keep it out of the payload,
   * and it happens after the submit is already under way, so nothing flickers.
   */
  const stripBlanks = (form: HTMLFormElement) => {
    const blanks = Array.from(form.elements).filter(
      (el): el is HTMLInputElement | HTMLSelectElement =>
        (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) &&
        el.name !== "" &&
        el.value === "",
    );
    blanks.forEach((el) => (el.disabled = true));
    // Re-enabled so the controls still work if the navigation is cancelled or
    // the browser restores this page from its back/forward cache.
    window.setTimeout(() => blanks.forEach((el) => (el.disabled = false)), 0);
  };

  /*
   * Changing a select applies immediately, which is what the pills did.
   * Submitting through requestSubmit rather than form.submit is deliberate:
   * form.submit skips the submit event, so the blanks would not be stripped.
   */
  const apply = (event: React.ChangeEvent<HTMLSelectElement>) =>
    event.currentTarget.form?.requestSubmit();

  // Both paths land here: the selects above, and the Search button, which is
  // an ordinary submit and never reaches `apply`.
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) =>
    stripBlanks(event.currentTarget);

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

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-ink/10 pt-6">
        <Select
          name="difficulty"
          label="Level"
          value={difficulty}
          allLabel="All levels"
          onChange={apply}
          options={DIFFICULTY_LEVELS.map((l) => ({
            value: String(l.level),
            label: `${l.level}. ${l.name}`,
          }))}
        />

        <Select
          name="topic"
          label="Topic"
          value={topic}
          allLabel="All topics"
          onChange={apply}
          options={TOPICS.map((t) => ({ value: t, label: TOPIC_LABELS[t] }))}
        />

        <Select
          name="type"
          label="Type"
          value={type}
          allLabel="All types"
          onChange={apply}
          options={[
            { value: "video", label: "Videos" },
            { value: "article", label: "Articles" },
          ]}
        />
      </div>
    </form>
  );
}

function Select({
  name,
  label,
  value,
  allLabel,
  options,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  allLabel: string;
  options: { value: string; label: string }[];
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  const applied = value !== "";

  return (
    <div className="relative">
      <select
        /*
         * Keyed on the value so a soft navigation remounts the control.
         *
         * The select is uncontrolled, and React does not push a changed
         * defaultValue into an input that is already mounted. After a
         * client-side navigation the DOM value and the URL could therefore
         * drift apart, and the next submit would send whatever the stale DOM
         * held. Remounting makes that impossible rather than unlikely.
         */
        key={value}
        name={name}
        aria-label={label}
        defaultValue={value}
        onChange={onChange}
        /*
         * appearance-none removes the platform chrome so the border, radius
         * and type are ours. rounded-2xl rather than a full pill: the list the
         * browser opens underneath has square corners, and a half-round
         * control reads as deliberate against it where a capsule reads as a
         * mismatch. The right padding leaves room for the chevron.
         */
        className={`label cursor-pointer appearance-none rounded-2xl border py-2.5 pr-10 pl-4 transition-colors focus:outline-none focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink/15 ${
          applied
            ? "border-ink bg-ink text-mist"
            : "border-ink/20 bg-paper text-ink/70 hover:border-ink/50 hover:text-ink"
        }`}
      >
        {/*
          The options carry their own colours. They inherit the select's
          otherwise, so an applied filter opened a black list with the
          platform's blue highlight sitting in the middle of a pale green page.
          Set here rather than in globals.css because this is the only styled
          select in the app.
        */}
        <option value="" className="bg-paper text-ink">
          {allLabel}
        </option>
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            className="bg-paper text-ink"
          >
            {option.label}
          </option>
        ))}
      </select>

      {/* Decorative, and never a click target: the select underneath owns the
          whole control. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 10 6"
        className={`pointer-events-none absolute top-1/2 right-4 size-2.5 -translate-y-1/2 ${
          applied ? "text-mist" : "text-ink/45"
        }`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 1l4 4 4-4" />
      </svg>
    </div>
  );
}
