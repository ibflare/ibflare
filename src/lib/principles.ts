/**
 * The three principles, from the client copy deck.
 *
 * Extracted from the landing page when /our-mission was added, so the two
 * pages render one copy of this wording rather than two that can drift. This
 * is copy deck text: edit it here, and only on the client's instruction.
 */
export const PRINCIPLES = [
  {
    heading: "Made by students",
    body: "Every video comes from a FLARE member who worked through the subject themselves. This is not a purchased curriculum, and it is not a scripted lesson.",
  },
  {
    heading: "Sorted by difficulty",
    body: "The same subject is explained more than once, at different levels. If a video assumes something you haven't learned yet, there is a simpler version of it.",
  },
  {
    heading: "Nothing to sell",
    body: "We explain how financial products and obligations work. We do not recommend them. FLARE accepts no sponsorship, affiliate arrangements, or referral payments, and no contributor is compensated for what they publish. Where a contributor is uncertain, the video says so.",
  },
] as const;
