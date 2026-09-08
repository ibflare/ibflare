import { PROFANITY, SLURS } from "./wordlist";

/**
 * The comment filter. CLAUDE.md section 4.
 *
 * Normalize, then match whole tokens against the wordlist, then answer with a
 * tier. Three steps, in that order, and the order is the whole design: the
 * normalising is what catches "fuuuck" and "sh!t", and the tokenising is what
 * keeps "class" and "Scunthorpe" and "assassin" out of the results.
 *
 * Section 4 is worth re-reading before changing any of this. Word matching
 * stops careless posts, not determined ones. Spacing, homoglyphs and creative
 * spelling all walk through it, and that is accepted deliberately, because
 * every step taken to catch more of them costs legitimate words. Do not
 * escalate to substring matching.
 */

const PROFANITY_SET = new Set(PROFANITY);
const SLUR_SET = new Set(SLURS);

/**
 * Characters people substitute for letters. Section 4 names these five.
 *
 * Applied after lowercasing and before tokenising, so "sh!t" and "$hit" and
 * "b0llocks" all land on their base form.
 */
const SUBSTITUTIONS: Record<string, string> = {
  "@": "a",
  "4": "a",
  "1": "i",
  "!": "i",
  "|": "i",
  "0": "o",
  $: "s",
  "5": "s",
  "3": "e",
  "7": "t",
};

/**
 * Zero-width and other invisible characters used to break a word up.
 *
 * Written as escapes rather than as the characters themselves, deliberately.
 * The first version of this line carried the literal codepoints, which no
 * editor renders and tsc would not parse: "Unterminated regular expression
 * literal", then a run of "Invalid character". A fair warning about pasting
 * invisible characters into source, in a file whose whole job is stripping
 * them out of somebody else's input.
 *
 * Soft hyphen, Mongolian vowel separator, the zero-width and directional
 * marks, the bidi overrides, the word joiner and invisible operators, and the
 * byte order mark.
 */
const INVISIBLE =
  /[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;

/**
 * Collapse a run of three or more identical characters down to one.
 *
 * Three, not two, and this matters more than it looks. Collapsing every
 * repeat turns "book" into "bok" and "pass" into "pas", so a rule that
 * flattens doubles quietly mangles ordinary English. Real doubled letters are
 * almost always exactly two; a run of three or more is somebody leaning on a
 * key.
 */
function collapseRuns(token: string): string {
  return token.replace(/(.)\1{2,}/g, "$1");
}

/**
 * Lowercase, strip invisibles, apply the substitutions, and split into word
 * tokens on anything that is not a letter or a digit.
 *
 * Splitting on non-letters is what makes the match a word-boundary match
 * without a single regex boundary: a token either is a listed word or it is
 * not, and "classic" is one token that happens to contain three letters of
 * another word.
 */
export function normalize(input: string): string[] {
  const flattened = input
    .toLowerCase()
    .replace(INVISIBLE, "")
    .split("")
    .map((char) => SUBSTITUTIONS[char] ?? char)
    .join("");

  return flattened.split(/[^a-z0-9]+/).filter(Boolean);
}

export type ModerationResult =
  | { ok: true }
  | { ok: false; tier: "profanity" | "slur"; matched: string; message: string };

/**
 * The two messages come from section 4. The profanity one is quoted there
 * verbatim; the slur one deliberately does not repeat the word back, and does
 * not say that an officer has been notified either. Telling somebody their
 * attempt was logged invites them to test what else is logged, and the log is
 * for the officers rather than for them.
 */
const MESSAGES = {
  profanity:
    "That comment contains language we don't allow. Edit it and try again.",
  slur: "That comment contains language we don't allow. Edit it and try again.",
} as const;

/**
 * Check a comment body.
 *
 * Slurs are tested first, so a comment carrying both tiers is reported as the
 * one that matters. Each token is checked as written and again with its runs
 * collapsed, so "fuck" and "fuuuuck" both land without collapsing being
 * applied to text that did not need it.
 */
export function checkComment(body: string): ModerationResult {
  const tokens = normalize(body);

  for (const token of tokens) {
    const variants = new Set([token, collapseRuns(token)]);

    for (const variant of variants) {
      // Two characters cannot be a listed word and can be a false positive.
      if (variant.length < 3) continue;

      if (SLUR_SET.has(variant)) {
        return {
          ok: false,
          tier: "slur",
          matched: variant,
          message: MESSAGES.slur,
        };
      }
    }
  }

  for (const token of tokens) {
    const variants = new Set([token, collapseRuns(token)]);

    for (const variant of variants) {
      if (variant.length < 3) continue;

      if (PROFANITY_SET.has(variant)) {
        return {
          ok: false,
          tier: "profanity",
          matched: variant,
          message: MESSAGES.profanity,
        };
      }
    }
  }

  return { ok: true };
}
