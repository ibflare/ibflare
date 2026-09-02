import { DIFFICULTY_LEVELS, difficultyAccent } from "@/lib/taxonomy";

/**
 * How to post a video. CLAUDE.md section 5.
 *
 * Static and public: no data, no auth check, and the proxy leaves it reachable
 * signed out in both gate configurations. Someone deciding whether to join
 * should be able to read what posting involves before making an account.
 *
 * Long on purpose. Section 8 bans padded copy and explaining the UI, but names
 * teaching copy as the exception, and this page is written for someone who has
 * never uploaded anything to YouTube.
 */
export const metadata = {
  title: "Contribute",
  description:
    "How to upload a video to YouTube, submit it to FLARE, and what makes a good FLARE video.",
};

const STEPS = [
  {
    heading: "Upload it to YouTube",
    body: [
      "Any account works, including a personal one. FLARE never holds the file. We store the link, the video stays on your channel, and you keep control of it. Take it down on YouTube and it stops playing here.",
    ],
  },
  {
    heading: "Set the visibility to Unlisted",
    body: [
      "You can do this on the upload screen, or afterwards under Visibility in YouTube Studio.",
      "Unlisted means the video does not show up in search, on your channel, or in anyone's recommendations, and that anyone holding the link can watch it. FLARE is the only place we put that link. Public works as well, if you would rather the video be findable on its own.",
    ],
  },
  {
    heading: "Check that embedding is allowed",
    body: [
      "In YouTube Studio, open the video, expand Show more under the details, and look for Allow embedding. It is on by default, so usually there is nothing to change.",
      "If it is off, FLARE cannot play the video and the form will say so when you paste the link.",
    ],
  },
  {
    heading: "Copy the link",
    body: [
      "From the address bar or the Share button, whichever is quicker. A watch link, a youtu.be link, and a Shorts link all work, and extra text on the end of the URL is fine.",
    ],
  },
  {
    heading: "Paste it into the upload form",
    body: [
      "FLARE reads the title, the thumbnail, and the length straight from YouTube. You fill in a description, a difficulty level, a topic, and anyone you made it with. Check the thumbnail preview is the right video before you publish.",
      "Posting is switched on per account by a sponsor. The upload form opens along with the library.",
    ],
  },
];

const STANDARDS = [
  {
    heading: "Cite what you claim, on screen",
    body: "If a number comes from the IRS, a bank's fee schedule, or a news article, put the source on screen while you say it. A viewer who wants to check you should not have to ask you where it came from.",
  },
  {
    heading: "Teach how it works, not what to buy",
    body: "Explain how a credit score is calculated. Do not tell anyone which card to open. The line is whether a viewer could act on your video by understanding something, or only by buying something.",
  },
  {
    heading: "No sponsors, no referral codes, no affiliate links",
    body: "Not in the video, not in the description, not read out at the end. FLARE takes no sponsorship and nobody is paid for what they publish, and that is only true if it is true of every video in the library.",
  },
  {
    heading: "Say so when you are not sure",
    body: "“I could not find a clear answer on this” is a good sentence and you should use it. Confident guessing is the failure mode that costs a viewer money.",
  },
  {
    heading: "Answer one question",
    body: "A video that explains what a W-4 is will be watched to the end. One that covers all of payroll will not. If your outline has two halves, that is two videos.",
  },
  {
    heading: "Stay inside the level you picked",
    body: "Use a term a viewer at your level would not know and you have either got to define it or move the video up. This is the whole point of the ladder: someone else can take the harder version.",
  },
];

export default function ContributePage() {
  return (
    <>
      {/* ------------------------------------------------------------- Intro */}
      <section className="border-b border-ink/10">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div className="max-w-2xl">
            <h1 className="font-display text-4xl leading-[1.1] font-medium text-balance sm:text-5xl">
              How to post a video
            </h1>
            <p className="mt-8 text-lg leading-relaxed text-ink/75">
              You upload to YouTube and give us the link. FLARE reads the rest
              from YouTube itself, so there is no file to send, no encoding to
              worry about, and nothing to fill in twice.
            </p>
            <p className="mt-5 leading-relaxed text-ink/75">
              If you have never uploaded to YouTube before, the five steps below
              are the whole process, in order.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- Steps */}
      <section className="border-b border-ink/10">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <h2 className="font-display text-3xl leading-tight font-medium text-balance sm:text-4xl">
            Step by step
          </h2>

          {/*
            Numerals in plain ink, not the difficulty ramp. Those five colours
            mean a difficulty level everywhere else on the site, and step 3 of
            5 is not Blaze.
          */}
          <ol className="mt-14 space-y-px overflow-hidden rounded-lg bg-ink/12">
            {STEPS.map((step, i) => (
              <li
                key={step.heading}
                className="grid gap-x-8 gap-y-4 bg-paper px-6 py-8 sm:grid-cols-[auto_1fr] sm:px-8"
              >
                <span
                  className="font-display text-3xl leading-none font-semibold tabular-nums text-ink/30"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-display text-xl leading-snug font-medium">
                    {step.heading}
                  </h3>
                  {step.body.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="mt-4 max-w-2xl leading-relaxed text-ink/70"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------ Picking a level */}
      <section className="border-b border-ink/10 bg-paper-deep">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:items-start lg:gap-20">
            <div className="lg:sticky lg:top-32">
              <h2 className="font-display text-3xl leading-tight font-medium text-balance sm:text-4xl">
                Choosing a level
              </h2>
              <p className="mt-7 leading-relaxed text-ink/75">
                The level describes what your video assumes the viewer already
                knows, not how old they are and not how hard the subject is. Ask
                what someone would need to have learned already for your
                explanation to land.
              </p>
              <p className="mt-5 leading-relaxed text-ink/75">
                Pitching low is not a lesser contribution. Level 1 is the
                hardest to write and the most watched.
              </p>
            </div>

            <ul className="space-y-px overflow-hidden rounded-lg bg-ink/12">
              {DIFFICULTY_LEVELS.map((level) => (
                <li key={level.level} className="bg-paper-deep px-6 py-6 sm:px-8">
                  <div
                    className="flex items-baseline gap-3"
                    style={{ color: difficultyAccent(level.level) }}
                  >
                    <span className="font-display text-2xl leading-none font-semibold tabular-nums">
                      {level.level}
                    </span>
                    <span className="font-display text-xl leading-none font-medium">
                      {level.name}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-ink/75">
                    {level.assumes}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- Standards */}
      <section className="border-b border-ink/10">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <h2 className="font-display max-w-3xl text-3xl leading-tight font-medium text-balance sm:text-4xl">
            What makes a good FLARE video
          </h2>
          <p className="mt-6 max-w-2xl leading-relaxed text-ink/70">
            None of this is about production quality. A phone camera and a
            whiteboard are fine.
          </p>

          <ul className="mt-14 grid gap-px overflow-hidden rounded-lg bg-ink/12 sm:grid-cols-2">
            {STANDARDS.map((standard) => (
              <li key={standard.heading} className="bg-paper p-7 sm:p-9">
                <h3 className="font-display text-xl leading-snug font-medium">
                  {standard.heading}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-ink/70">
                  {standard.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ----------------------------------------------------- Media release */}
      {/*
        Section 9.5. The upload form carries the attestation checkbox, but the
        paper releases live outside the app in a folder the officers keep, so
        the requirement has to be stated somewhere a contributor reads before
        filming rather than at the moment they publish.
      */}
      <section className="bg-paper-deep">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl leading-tight font-medium text-balance sm:text-4xl">
              Everyone in the video has to agree to be in it
            </h2>
            <p className="mt-7 leading-relaxed text-ink/75">
              Anyone who appears or speaks in your video has to know it is going
              to be posted and be willing for it to be. For anyone under 18,
              FLARE needs a signed release on file before the video goes up. The
              officers keep those on paper, so ask one of them for a form before
              you film, not after.
            </p>
            <p className="mt-5 leading-relaxed text-ink/75">
              The upload form asks you to confirm this. That checkbox is a
              record that the releases exist, not a replacement for collecting
              them.
            </p>
            <p className="mt-5 leading-relaxed text-ink/75">
              Check your screen recordings before you upload, too. Account
              numbers, balances, addresses, and other people&rsquo;s names have a
              way of sitting in the corner of a frame for the whole video.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
