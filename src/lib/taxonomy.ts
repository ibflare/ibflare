/**
 * The public-facing difficulty scale and topic list. CLAUDE.md §3.
 *
 * The scale is fixed and public-facing: level numbers and names are shown to
 * viewers and are referenced in video URLs and filters from phase 3 onward.
 * Do not renumber.
 */

export const DIFFICULTY_LEVELS = [
  {
    level: 1,
    name: "Spark",
    audience: "Ages 11–14",
    assumes: "Nothing. What a paycheck is, what a bank does.",
  },
  {
    level: 2,
    name: "Ember",
    audience: "Ages 14–16",
    assumes:
      "You have a job or are about to. Pay stubs, simple returns, credit.",
  },
  {
    level: 3,
    name: "Blaze",
    audience: "Ages 16–18",
    assumes: "You have money to decide about. Index funds, 1099s, FAFSA.",
  },
  {
    level: 4,
    name: "Torch",
    audience: "18+",
    assumes: "College level. Macro policy, filings, valuation.",
  },
  {
    level: 5,
    name: "Flare",
    audience: "College and up",
    assumes: "Research depth. One niche question, about twenty minutes.",
  },
] as const;

export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number]["level"];

export const TOPICS = [
  "taxes",
  "banking",
  "credit",
  "investing",
  "career",
  "macro",
  "micro",
  "corporate",
] as const;

export type Topic = (typeof TOPICS)[number];

/**
 * Accent rule from CLAUDE.md §8: ember is reserved for difficulty 4–5 markers
 * (and focus states), hot for difficulty 5 alone. Everything below 4 is drawn
 * in ink. Keep this the single place that decision lives.
 */
export function difficultyAccent(level: number): string {
  if (level >= 5) return "var(--color-hot)";
  if (level >= 4) return "var(--color-ember)";
  return "var(--color-ink)";
}
