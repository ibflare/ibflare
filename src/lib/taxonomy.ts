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
    /*
     * The bracket originally read 13 rather than 11 because an account was
     * required to watch and the age screen blocks under-13 signups, so nobody
     * younger could reach this level. That gate is gone: viewing is public as
     * of 20260903000000, and a 12-year-old can watch Spark.
     *
     * The label is kept anyway, on the client's instruction. It is copy deck
     * wording, and it now describes who the level is pitched at rather than
     * who is allowed in, which is what the whole column means everywhere else.
     */
    audience: "Ages 13–14",
    assumes:
      "Assumes nothing. What a paycheck is, what a bank does with your money.",
  },
  {
    level: 2,
    name: "Ember",
    audience: "Ages 14–16",
    assumes:
      "Assumes a first job. Pay stubs, a simple return, how credit is scored.",
  },
  {
    level: 3,
    name: "Blaze",
    audience: "Ages 16–18",
    assumes:
      "Assumes earned income. Index funds, 1099 work, student loans, and aid.",
  },
  {
    level: 4,
    name: "Torch",
    audience: "18 and up",
    assumes:
      "Assumes introductory coursework. Monetary policy, filings, valuations.",
  },
  {
    level: 5,
    name: "Flare",
    audience: "College and up",
    assumes: "Assumes study in the field. One narrow question, examined at length.",
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
 * Display names for the topics. The stored values are lowercase single words
 * because they go in a check constraint and a query string; these are what a
 * reader sees. Keep every key in TOPICS present here, or a filter renders as a
 * blank pill.
 */
export const TOPIC_LABELS: Record<Topic, string> = {
  taxes: "Taxes",
  banking: "Banking",
  credit: "Credit",
  investing: "Investing",
  career: "Career",
  macro: "Macroeconomics",
  micro: "Microeconomics",
  corporate: "Corporate finance",
};

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
