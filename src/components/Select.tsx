"use client";

import { useEffect, useId, useRef, useState } from "react";

export type SelectOption = { value: string; label: string };

/**
 * The one dropdown on the site. A listbox, not a `select`.
 *
 * A native select's open list is drawn by the operating system. Its colours
 * can be set on the option elements and nothing else can, so it arrives as a
 * hard-cornered white box under a rounded control, and no CSS on the select
 * changes that. Rounding it means owning it.
 *
 * What that costs, and why it is paid here rather than worked around:
 *
 * - **A dropdown no longer works with JavaScript off.** The rest of each form
 *   still does, and every field this replaces is also validated on the server,
 *   so nothing is enforced only here.
 * - **The keyboard behaviour is ours to get right**, so it is written out in
 *   full below rather than assumed. This follows the ARIA select-only combobox
 *   pattern: focus stays on the button the whole time and
 *   `aria-activedescendant` is what moves, so there is one tab stop per
 *   dropdown, exactly as a select had.
 *
 * The form still submits a real value, through a hidden input, so nothing
 * above this component changes.
 */
export function Select({
  id,
  name,
  label,
  options,
  defaultValue = "",
  placeholder,
  required = false,
  requiredMessage,
  error,
  variant = "field",
  submitOnChange = false,
  className = "",
}: {
  /** Only needed when a visible `<label htmlFor>` points at this control. */
  id?: string;
  name: string;
  /** Names the control for a screen reader, and the fallback error wording. */
  label: string;
  options: SelectOption[];
  defaultValue?: string;
  /** The leading entry, whose value is "". "Choose one", "All topics". */
  placeholder?: string;
  required?: boolean;
  /** Match the server's wording for the same field, so one field says one thing. */
  requiredMessage?: string;
  /** A server-side error for this field. Takes precedence over the local one. */
  error?: string;
  variant?: "field" | "pill";
  /** Filters apply on change. A field inside a larger form must not. */
  submitOnChange?: boolean;
  className?: string;
}) {
  const all: SelectOption[] = placeholder
    ? [{ value: "", label: placeholder }, ...options]
    : options;

  const initial = Math.max(
    0,
    all.findIndex((o) => o.value === defaultValue),
  );

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(initial);
  const [chosen, setChosen] = useState(initial);
  const [missing, setMissing] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const uid = useId();
  const listId = `${uid}-list`;
  const errorId = `${uid}-error`;
  const optionId = (i: number) => `${uid}-opt-${i}`;

  const value = all[chosen].value;
  const isPlaceholder = value === "";
  const shownError = error ?? (missing ? requiredMessage ?? `Choose a ${label.toLowerCase()}.` : undefined);

  // Set by `choose`, read by the effect below. A ref rather than state,
  // because it exists to carry one fact across a single render and should not
  // cause one of its own.
  const submitAfterRender = useRef(false);

  const choose = (i: number) => {
    setOpen(false);
    setMissing(false);
    if (i === chosen) return;
    if (submitOnChange) submitAfterRender.current = true;
    setChosen(i);
  };

  /*
   * The submit waits a render, because the value has to be in the DOM before
   * the browser serialises the form.
   *
   * Writing it to the input imperatively and submitting in the same tick does
   * work, and it worked for a while: the library filters navigate away
   * immediately, so nothing ever re-rendered to undo it. In a form that stays
   * put, React's next render restores the input from its props and the write
   * is gone, so the button read "12th grade" over an empty value and the form
   * refused to submit with no visible reason. An effect runs after the commit,
   * which is the only point at which both are true.
   */
  useEffect(() => {
    if (!submitAfterRender.current) return;
    submitAfterRender.current = false;
    buttonRef.current?.form?.requestSubmit();
  }, [chosen]);

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
    document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
    // optionId is derived from a stable useId, so it is not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  /*
   * `required` on the hidden input would be a trap rather than a shortcut: the
   * browser refuses to submit, tries to focus the offending control to show
   * its message, cannot focus something hidden, and gives up silently. So the
   * check is done here, in the capture phase, which runs before React's own
   * listener at the root and therefore before the server action fires.
   *
   * The server validates this field too. This is the fast path, not the rule.
   */
  useEffect(() => {
    if (!required) return;
    const form = buttonRef.current?.form;
    if (!form) return;

    const onSubmit = (event: SubmitEvent) => {
      if (inputRef.current?.value !== "") return;
      // An earlier empty dropdown on the same form already claimed the focus.
      const first = !event.defaultPrevented;
      event.preventDefault();
      event.stopPropagation();
      setMissing(true);
      if (first) buttonRef.current?.focus();
    };

    form.addEventListener("submit", onSubmit, true);
    return () => form.removeEventListener("submit", onSubmit, true);
  }, [required]);

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

  /*
   * Type-ahead. Typing "cr" jumps to Credit, the way a native select does.
   * Without it a ten-item topic list is ten arrow presses, and quietly losing
   * a behaviour people already have is the usual way a custom control turns
   * out worse than the one it replaced.
   */
  const typed = useRef({ buffer: "", at: 0 });
  function typeAhead(key: string) {
    const now = Date.now();
    typed.current.buffer = now - typed.current.at > 700 ? key : typed.current.buffer + key;
    typed.current.at = now;

    const match = all.findIndex((o) =>
      o.label.toLowerCase().startsWith(typed.current.buffer),
    );
    if (match >= 0) setActive(match);
    return match >= 0;
  }

  const pill = variant === "pill";

  return (
    <div ref={wrapRef} className={`relative ${pill ? "" : "w-full"} ${className}`}>
      {/*
        Controlled, not uncontrolled. React restores an uncontrolled input from
        its props on every render, so the chosen value has to be the prop.
      */}
      <input ref={inputRef} type="hidden" name={name} value={value} readOnly />

      <button
        ref={buttonRef}
        id={id}
        type="button"
        role="combobox"
        aria-label={id ? undefined : label}
        aria-controls={listId}
        aria-expanded={open}
        aria-activedescendant={open ? optionId(active) : undefined}
        aria-describedby={shownError ? errorId : undefined}
        aria-invalid={shownError ? true : undefined}
        onClick={() => {
          setActive(chosen);
          setOpen((o) => !o);
        }}
        onKeyDown={onKeyDown}
        className={
          pill
            ? `label flex cursor-pointer items-center gap-2.5 rounded-2xl border py-2.5 pr-3.5 pl-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/15 ${
                isPlaceholder
                  ? "border-ink/20 bg-paper text-ink/70 hover:border-ink/50 hover:text-ink"
                  : "border-ink bg-ink text-mist"
              }`
            : `flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border bg-paper px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/15 ${
                shownError ? "border-hot" : "border-ink/25 hover:border-ink/50"
              } ${isPlaceholder ? "text-ink/50" : "text-ink"}`
        }
      >
        <span className={pill ? "" : "min-w-0 truncate"}>{all[chosen].label}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 10 6"
          className={`shrink-0 transition-transform ${pill ? "size-2.5" : "size-3"} ${
            open ? "rotate-180" : ""
          } ${pill && !isPlaceholder ? "text-mist" : "text-ink/45"}`}
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
         * A pill sizes to its longest option, which is what makes "Corporate
         * finance" readable under a button reading "All topics". A field is
         * already as wide as its row, so it matches the control instead.
         *
         * The max height is set above the longest list rather than below it,
         * so nothing scrolls today and no scrollbar is drawn down the inside
         * of a rounded panel. It is a floor under a list that grows.
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
          className={`absolute top-full left-0 z-30 mt-2 max-h-[28rem] overflow-y-auto rounded-2xl border border-ink/20 bg-paper p-1.5 shadow-[0_10px_28px_-8px_rgba(4,27,17,0.28)] ${
            pill ? "w-max min-w-full" : "w-full"
          }`}
        >
          {all.map((option, i) => {
            const isChosen = i === chosen;
            return (
              <li
                key={option.value || "__placeholder"}
                id={optionId(i)}
                role="option"
                aria-selected={isChosen}
                onClick={() => choose(i)}
                onMouseMove={() => setActive(i)}
                className={`cursor-pointer rounded-xl px-3.5 py-2.5 transition-colors ${
                  pill ? "label whitespace-nowrap" : ""
                } ${
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

      {shownError && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-hot">
          {shownError}
        </p>
      )}
    </div>
  );
}
