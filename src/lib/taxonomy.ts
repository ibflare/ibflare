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
    audience: "Ages 11 to 14",
    assumes:
      "No prior knowledge. Introduces earnings, wages, and the function of a bank.",
  },
  {
    level: 2,
    name: "Ember",
    audience: "Ages 14 to 16",
    assumes:
      "Presumes employment or imminent employment. Covers pay statements, straightforward returns, and credit.",
  },
  {
    level: 3,
    name: "Blaze",
    audience: "Ages 16 to 18",
    assumes:
      "Presumes discretionary income. Covers index funds, Form 1099, and applications for financial aid.",
  },
  {
    level: 4,
    name: "Torch",
    audience: "Ages 18 and over",
    assumes:
      "Undergraduate level. Covers macroeconomic policy, corporate filings, and valuation.",
  },
  {
    level: 5,
    name: "Flare",
    audience: "Undergraduate and above",
    assumes:
      "Research depth. A single specialized question, treated at approximately twenty minutes.",
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
