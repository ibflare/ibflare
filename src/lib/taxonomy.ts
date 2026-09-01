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
    // 13, not 11: an account is required to watch and the age screen blocks
    // under-13 signups, so nobody younger can reach this level. Section 9.4.
    audience: "Ages 13–14",
    assumes:
      "Assumes nothing. What a paycheck is, what a bank does with your money.",
  },
  {
    level: 2,
    name: "Ember",
    audience: "Ages 14–16",
    assumes:
      "You have a job or you're about to. Pay stubs, simple tax returns, how credit works.",
  },
  {
    level: 3,
    name: "Blaze",
    audience: "Ages 16–18",
    assumes:
      "You have money to make decisions about. Index funds, 1099 work, FAFSA and student loans.",
  },
  {
    level: 4,
    name: "Torch",
    audience: "18 and up",
    assumes: "College level. Macroeconomic policy, company filings, valuation.",
  },
  {
    level: 5,
    name: "Flare",
    audience: "College and up",
    assumes:
      "A single question examined in depth. Assumes coursework in economics or finance.",
  },
] as const;

export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number]["level"];

/**
 * Onboarding's grade options. PRIVATE data: stored on profiles.grade and never
 * rendered on a public page. CLAUDE.md sections 3 and 9.1.
 *
 * Must stay in step with the profiles_grade_valid check constraint in
 * supabase/migrations/20260829000000_profiles_and_auth.sql.
 */
export const GRADES = [
  { value: "9", label: "9th grade" },
  { value: "10", label: "10th grade" },
  { value: "11", label: "11th grade" },
  { value: "12", label: "12th grade" },
  { value: "college", label: "College" },
  { value: "educator", label: "Educator" },
  { value: "other", label: "Other" },
] as const;

export type Grade = (typeof GRADES)[number]["value"];

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
 * The colour for a difficulty level. CLAUDE.md §8.
 *
 * One hue per level, cool to hot, so the ladder reads as novice to advanced
 * without relying on the numbers. This replaced an earlier rule that reserved
 * the accents for levels 4 and 5 and drew everything below in ink, which left
 * Spark, Ember and Blaze looking identical.
 *
 * Keep this the single place that decision lives; the tokens are defined in
 * globals.css.
 */
export function difficultyAccent(level: number): string {
  const clamped = Math.min(Math.max(Math.round(level), 1), 5);
  return `var(--color-level-${clamped})`;
}
