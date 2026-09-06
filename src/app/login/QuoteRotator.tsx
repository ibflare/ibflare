"use client";

import { useEffect, useState } from "react";

/**
 * The rotating quote over the sign-in panel's footage.
 *
 * All five are rendered stacked in one grid cell, and only the active one is
 * at full opacity. That is what keeps the panel still: the cell sizes itself
 * to the tallest quote once, so a shorter one does not let the block collapse
 * and shove the lockup and the footer line around every seven seconds.
 *
 * The fade is sequential rather than a crossfade. Two different sentences
 * dissolving through each other in the same spot reads as a smudge, so the
 * outgoing quote reaches zero before the next one starts.
 */

const QUOTES = [
  {
    text: "Tell me and I forget. Teach me and I remember. Involve me and I learn.",
    who: "Benjamin Franklin",
  },
  {
    text: "Answer a question once, and the next person doesn’t have to start from nothing.",
    who: "Unknown",
  },
  {
    text: "The mind is not a vessel to be filled, but a fire to be kindled.",
    who: "Plutarch",
  },
  {
    text: "For the things we have to learn before we can do them, we learn by doing them.",
    who: "Aristotle",
  },
  {
    text: "A candle loses nothing by lighting another candle.",
    who: "James Keller",
  },
];

/** Seven seconds on screen per quote, fade included. */
const CYCLE_MS = 7000;
const FADE_MS = 700;

export function QuoteRotator() {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(true);

  useEffect(() => {
    /*
     * Reduced motion stops the rotation outright rather than hard-cutting
     * between quotes. The globals.css clamp already flattens the transition to
     * nothing, so rotating anyway would replace a fade with a jump, which is
     * the opposite of what was asked for. The first quote just stays put.
     */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let swap: ReturnType<typeof setTimeout>;

    const cycle = setInterval(() => {
      setShown(false);
      swap = setTimeout(() => {
        if (cancelled) return;
        setIndex((n) => (n + 1) % QUOTES.length);
        setShown(true);
      }, FADE_MS);
    }, CYCLE_MS);

    return () => {
      cancelled = true;
      clearInterval(cycle);
      clearTimeout(swap);
    };
  }, []);

  return (
    <figure className="grid max-w-md">
      {QUOTES.map((quote, n) => {
        const active = n === index && shown;
        return (
          <blockquote
            key={quote.who}
            // Every quote sits in the same cell, so the tallest sets the height.
            className={`col-start-1 row-start-1 transition-opacity ${
              active ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            style={{ transitionDuration: `${FADE_MS}ms` }}
            // Without this a screen reader would read all five in a row.
            aria-hidden={n !== index}
          >
            {/*
              The marks are added here rather than baked into the strings
              above, so QUOTES stays plain sentences: easier to re-punctuate,
              and the text is still usable anywhere that supplies its own
              quoting. Curly, not the straight typewriter pair.
            */}
            <p className="font-display text-3xl leading-tight font-medium text-balance">
              &ldquo;{quote.text}&rdquo;
            </p>
            <footer className="label mt-5 text-mist/50">{quote.who}</footer>
          </blockquote>
        );
      })}
    </figure>
  );
}
