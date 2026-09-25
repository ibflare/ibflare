"use client";

import { useEffect, useId, useRef, useState } from "react";
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

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-ink/10 pt-6">
        <Dropdown
          key={`difficulty-${difficulty}`}
          name="difficulty"
          label="Level"
          value={difficulty}
          allLabel="All levels"
          options={DIFFICULTY_LEVELS.map((l) => ({
            value: String(l.level),
            label: `${l.level}. ${l.name}`,
          }))}
        />

        <Dropdown
          key={`topic-${topic}`}
          name="topic"
          label="Topic"
          value={topic}
          allLabel="All topics"
          options={TOPICS.map((t) => ({ value: t, label: TOPIC_LABELS[t] }))}
        />

        <Dropdown
          key={`type-${type}`}
          name="type"
          label="Type"
          value={type}
          allLabel="All types"
          options={[
            { value: "video", label: "Videos" },
            { value: "article", label: "Articles" },
          ]}
        />
      </div>
    </form>
  );
}

type Option = { value: string; label: string };

/**
 * A listbox, not a `select`.
 *
 * A native select's open list is drawn by the operating system: its colours
 * can be set on the option elements and nothing else can, so it arrives as a
 * hard-cornered white box under a rounded pill. Rounding it means owning it.
 *
 * What that costs, and why it is paid here rather than worked around:
 *
 * - **The filters no longer work with JavaScript off.** Search still does. A
 *   half-measure that keeps a hidden native select alive for that case means
 *   two controls announcing themselves for one filter, which is worse for a
 *   screen reader than the thing it fixes.
 * - **The keyboard behaviour is now ours to get right**, so it is written out
 *   in full below rather than assumed. This follows the ARIA select-only
 *   combobox pattern: focus stays on the button the whole time and
 *   `aria-activedescendant` is what moves, so there is one tab stop per filter
 *   exactly as there was with a select.
 *
 * The form still submits a real value, through a hidden input, so everything
 * above this component is unchanged.
 */
function Dropdown({
  name,
  label,
  value,
  allLabel,
  options,
}: {
  name: string;
  label: string;
  value: string;
  allLabel: string;
  options: Option[];
}) {
  const all: Option[] = [{ value: "", label: allLabel }, ...options];
  const selected = Math.max(
    0,
    all.findIndex((o) => o.value === value),
  );

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selected);
  // Held separately from `value` so the button reads the new label during the
  // navigation the choice kicks off, rather than the old one.
  const [chosen, setChosen] = useState(selected);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const optionId = (i: number) => `${listId}-${i}`;

  const applied = all[chosen].value !== "";

  const choose = (i: number) => {
    setChosen(i);
    setOpen(false);
    if (!inputRef.current) return;
    // Set imperatively so the value is in the DOM before requestSubmit reads
    // it. Waiting for the render would be a race with the navigation.
    inputRef.current.value = all[i].value;
    buttonRef.current?.form?.requestSubmit();
  };

  // Clicking anywhere else closes it, which is the one behaviour people expect
  // from a dropdown and the one a button alone does not give you.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Keep the active option in view when the arrow keys walk past the edge of a
  // list long enough to scroll.
  useEffect(() => {
    if (!open) return;
    document
      .getElementById(optionId(active))
      ?.scrollIntoView({ block: "nearest" });
    // optionId is derived from a stable useId, so it is not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  /*
   * Type-ahead. Typing "cr" jumps to Credit, the way a native select does.
   * Without it a ten-item topic list is ten arrow presses, and losing a
   * behaviour people already have is the usual way a custom control turns out
   * worse than the one it replaced.
   */
  const typed = useRef({ buffer: "", at: 0 });
  const typeAhead = (key: string) => {
    const now = Date.now();
    typed.current.buffer = now - typed.current.at > 700 ? key : typed.current.buffer + key;
    typed.current.at = now;

    const buffer = typed.current.buffer;
    const match = all.findIndex((o) => o.label.toLowerCase().startsWith(buffer));
    if (match >= 0) setActive(match);
    return match >= 0;
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const { key } = event;

    if (!open) {
      if (key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === " ") {
        event.preventDefault();
        setActive(chosen);
        setOpen(true);
      }
      return;
    }

    if (key === "Escape") {
      event.preventDefault();
      setOpen(false);
    } else if (key === "Tab") {
      // Not prevented: Tab should still move on, it just should not leave an
      // open list behind it.
      setOpen(false);
    } else if (key === "Enter" || key === " ") {
      event.preventDefault();
      choose(active);
    } else if (key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, all.length - 1));
    } else if (key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (key === "End") {
      event.preventDefault();
      setActive(all.length - 1);
    } else if (key.length === 1 && key !== " ") {
      if (typeAhead(key.toLowerCase())) event.preventDefault();
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <input ref={inputRef} type="hidden" name={name} defaultValue={value} />

      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-label={label}
        aria-controls={listId}
        aria-expanded={open}
        aria-activedescendant={open ? optionId(active) : undefined}
        onClick={() => {
          setActive(chosen);
          setOpen((o) => !o);
        }}
        onKeyDown={onKeyDown}
        className={`label flex cursor-pointer items-center gap-2.5 rounded-2xl border py-2.5 pr-3.5 pl-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/15 ${
          applied
            ? "border-ink bg-ink text-mist"
            : "border-ink/20 bg-paper text-ink/70 hover:border-ink/50 hover:text-ink"
        }`}
      >
        {all[chosen].label}
        <svg
          aria-hidden="true"
          viewBox="0 0 10 6"
          className={`size-2.5 transition-transform ${open ? "rotate-180" : ""} ${
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
      </button>

      {open && (
        /*
         * `w-max` with `min-w-full` so the panel is as wide as its longest
         * option rather than as wide as the button, which is what makes
         * "Corporate finance" readable under a button reading "All topics".
         *
         * Nothing else in the app casts a shadow: the design language is
         * borders. A floating layer is the one case that needs more than a
         * border to sit above the page, so the shadow is ink at low opacity
         * rather than a generic black, and stays inside the palette.
         */
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          /*
           * The max height is set above the longest list rather than below it.
           * Topics is ten entries and clears it, so nothing scrolls today and
           * no scrollbar is drawn down the inside of a rounded panel. It is
           * here as a floor under a list that grows, not as a size.
           */
          className="absolute top-full left-0 z-30 mt-2 max-h-[28rem] w-max min-w-full overflow-y-auto rounded-2xl border border-ink/20 bg-paper p-1.5 shadow-[0_10px_28px_-8px_rgba(4,27,17,0.28)]"
        >
          {all.map((option, i) => {
            const isChosen = i === chosen;
            return (
              <li
                key={option.value || "all"}
                id={optionId(i)}
                role="option"
                aria-selected={isChosen}
                data-active={i === active}
                onClick={() => choose(i)}
                onMouseMove={() => setActive(i)}
                className={`label cursor-pointer rounded-xl px-3.5 py-2.5 whitespace-nowrap transition-colors ${
                  isChosen
                    ? "bg-ink text-mist"
                    : i === active
                      ? "bg-ink/8 text-ink"
                      : "text-ink/70"
                }`}
              >
                {option.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
