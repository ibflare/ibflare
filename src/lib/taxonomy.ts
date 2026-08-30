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
 * Accent rule from CLAUDE.md §8: ember is reserved for difficulty 4–5 markers
 * (and focus states), hot for difficulty 5 alone. Everything below 4 is drawn
 * in ink. Keep this the single place that decision lives.
 */
export function difficultyAccent(level: number): string {
  if (level >= 5) return "var(--color-hot)";
  if (level >= 4) return "var(--color-ember)";
  return "var(--color-ink)";
}
