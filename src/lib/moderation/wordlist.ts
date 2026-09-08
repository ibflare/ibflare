/**
 * The two-tier wordlist. CLAUDE.md section 4.
 *
 * Kept as two plain arrays in its own file so it can be edited without
 * touching the matching logic, and so the logic can be read without wading
 * through this.
 *
 * MATCHING IS WHOLE-TOKEN, NOT SUBSTRING. An entry here matches only when it
 * is the entire word, so "class" does not hit "ass" and "Scunthorpe" does not
 * hit anything. That is why the entries are base words: adding "ass" is safe,
 * adding "as" would not be.
 *
 * Neither list is exhaustive and neither can be. Section 4 is explicit that
 * this stops careless posts rather than determined ones, and that the real
 * mechanism is a named account at one school with officers who know the
 * person. Do not escalate to substring matching to catch more: the false
 * positives cost more than the misses.
 */

/**
 * Tier one. Refused on submit, nothing stored, nothing logged.
 *
 * The bar for this list is "a teacher would ask them to rephrase it", not
 * "this word is impolite". Words that are ordinary in a sentence about money
 * or tax are deliberately absent.
 */
export const PROFANITY: readonly string[] = [
  "arse",
  "arsehole",
  "ass",
  "asses",
  "asshat",
  "asshole",
  "assholes",
  "bastard",
  "bastards",
  "bitch",
  "bitches",
  "bitching",
  "bollocks",
  "bullshit",
  "cock",
  "crap",
  "cunt",
  "cunts",
  "dick",
  "dickhead",
  "dildo",
  "douche",
  "douchebag",
  "dumbass",
  "fuck",
  "fucked",
  "fucker",
  "fuckers",
  "fucking",
  "fucks",
  "goddamn",
  "handjob",
  "horseshit",
  "jackass",
  "jerkoff",
  "motherfucker",
  "motherfucking",
  "nutsack",
  "piss",
  "pissed",
  "prick",
  "pussy",
  "shit",
  "shite",
  "shithead",
  "shitty",
  "slut",
  "sluts",
  "twat",
  "wank",
  "wanker",
  "whore",
  "whores",
];

/**
 * Tier two. Refused, and an `audit_log` row is written and flagged for
 * officers so repeat attempts from one account surface in the admin panel.
 *
 * Slurs and targeted harassment. The separation from tier one is not about
 * severity of language, it is about what an officer needs to know: somebody
 * swearing needs a nudge, somebody aiming a slur at a classmate needs a
 * conversation with an adult, and the second one has to be visible even
 * though the comment never posted.
 */
export const SLURS: readonly string[] = [
  "chink",
  "chinks",
  "coon",
  "coons",
  "dyke",
  "dykes",
  "fag",
  "faggot",
  "faggots",
  "fags",
  "gook",
  "gooks",
  "kike",
  "kikes",
  "nigga",
  "niggas",
  "nigger",
  "niggers",
  "paki",
  "pakis",
  "raghead",
  "retard",
  "retarded",
  "retards",
  "spic",
  "spics",
  "tranny",
  "trannies",
  "wetback",
  "wetbacks",
];
