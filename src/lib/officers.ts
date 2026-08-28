/**
 * PLACEHOLDER — replace before launch.
 *
 * Officer cards on the landing page. Names, titles, and bios here are filler so
 * the layout can be judged at the right length; nothing in this file is real.
 *
 * From phase 2 this list comes from `profiles` where role = 'officer' or
 * 'sponsor', and this file gets deleted. Until then it is the only source.
 * See CLAUDE.md §2 (titles) and §10 (build order).
 */

export type Officer = {
  /** Placeholder. Real cards use display_name — first name + last initial. */
  name: string;
  /** Free text, sponsor-set. CLAUDE.md §2. */
  title: string;
  /** Two or three sentences. What they cover, not a résumé. */
  bio: string;
  /** Initials for the monogram tile until photos exist. */
  monogram: string;
};

export const OFFICERS: Officer[] = [
  {
    name: "First L.",
    title: "President",
    bio: "Placeholder bio. Two or three sentences about what this officer covers and why they started making videos — the kind of thing that reads like a person wrote it, not a résumé line.",
    monogram: "FL",
  },
  {
    name: "First L.",
    title: "Vice President",
    bio: "Placeholder bio. Two or three sentences about what this officer covers and why they started making videos — the kind of thing that reads like a person wrote it, not a résumé line.",
    monogram: "FL",
  },
  {
    name: "First L.",
    title: "Treasurer",
    bio: "Placeholder bio. Two or three sentences about what this officer covers and why they started making videos — the kind of thing that reads like a person wrote it, not a résumé line.",
    monogram: "FL",
  },
  {
    name: "First L.",
    title: "Secretary",
    bio: "Placeholder bio. Two or three sentences about what this officer covers and why they started making videos — the kind of thing that reads like a person wrote it, not a résumé line.",
    monogram: "FL",
  },
  {
    name: "First L.",
    title: "Outreach Lead",
    bio: "Placeholder bio. Two or three sentences about what this officer covers and why they started making videos — the kind of thing that reads like a person wrote it, not a résumé line.",
    monogram: "FL",
  },
  {
    name: "First Last",
    title: "Faculty Sponsor",
    bio: "Placeholder bio. Two or three sentences about what this officer covers and why they started making videos — the kind of thing that reads like a person wrote it, not a résumé line.",
    monogram: "FL",
  },
];
