import Link from "next/link";
import { DIFFICULTY_LEVELS, difficultyAccent } from "@/lib/taxonomy";
import { OFFICERS } from "@/lib/officers";

const PRINCIPLES = [
  {
    heading: "Students teach it",
    body: "Every video is made by a FLARE member who had to work the thing out themselves first — a first W-2, a FAFSA form, a lease that went up in July. Not a purchased curriculum, and not a teacher reading slides.",
  },
  {
    heading: "Sorted by difficulty, not by date",
    body: "The same topic gets explained more than once, at different levels. If a video assumes something you do not have yet, there is a lower one on the same subject. Nothing is buried because it is old.",
  },
  {
    heading: "Nobody is selling you anything",
    body: "We explain how things work, not what to buy. No sponsors, no referral codes, no affiliate links, ever. When a member is unsure about something, the video says so on camera.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      {/*
        Background video. Drop the file at public/videos/hero.mp4 and it picks
        it up with no code change. Until then the ink background shows through,
        which is a valid state — nothing here depends on the footage existing.
        Keep it short, quiet, and slow-moving; the scrim below assumes the copy
        has to stay readable over whatever is playing.
      */}
      <section className="relative isolate overflow-hidden bg-ink text-mist">
        <video
          className="absolute inset-0 size-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
          tabIndex={-1}
        >
          <source src="/videos/hero.mp4" type="video/mp4" />
        </video>

        {/* Scrim. Holds the text contrast whatever the footage is doing. */}
        <div className="absolute inset-0 bg-ink/75" aria-hidden />

        <div className="relative mx-auto max-w-6xl px-6 py-28 sm:py-36 lg:py-44">
          <h1 className="font-display max-w-4xl text-4xl leading-[1.08] font-medium text-balance sm:text-5xl lg:text-6xl">
            The same question, explained at the level you are actually at.
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-mist/80">
            FLARE is a student-run video library covering financial literacy,
            taxes, and economics. Every video carries a difficulty level, from
            what a paycheck is through reading a company&rsquo;s filings — so a
            seventh grader and a college junior can both find the version of an
            answer that makes sense to them.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/library"
              className="label rounded-full bg-mist px-7 py-4 text-ink transition-opacity hover:opacity-90"
            >
              Browse the library
            </Link>
            <Link
              href="/contribute"
              className="label rounded-full border border-mist/40 px-7 py-4 text-mist transition-colors hover:border-mist"
            >
              Post a video
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------- What FLARE does at Lamar */}
      <section className="border-b border-ink/10">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <p className="label text-ink/45">FLARE at Lamar Academy</p>

          <div className="mt-12 grid gap-14 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
            <div>
              <h2 className="font-display text-3xl leading-tight font-medium text-balance sm:text-4xl">
                A club that publishes what it learns.
              </h2>
              <p className="mt-7 leading-relaxed text-ink/75">
                FLARE meets at Lamar Academy in the Rio Grande Valley. Members
                pick something they have had to figure out — how withholding
                works, what a credit score is actually measuring, why the rent
                went up — and record a short video explaining it.
              </p>
              <p className="mt-5 leading-relaxed text-ink/75">
                The video gets a difficulty level and a topic, and goes into the
                library alongside the other explanations of the same thing. That
                is the whole club: work it out, then teach it to whoever comes
                next.
              </p>
            </div>

            <ul className="grid gap-px overflow-hidden rounded-lg bg-ink/12">
              {PRINCIPLES.map((principle) => (
                <li key={principle.heading} className="bg-paper p-7 sm:p-9">
                  <h3 className="font-display text-xl font-medium">
                    {principle.heading}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink/70">
                    {principle.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------- The difficulty ladder */}
      <section className="border-b border-ink/10 bg-paper-deep">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <p className="label text-ink/45">The five levels</p>
          <h2 className="font-display mt-6 max-w-3xl text-3xl leading-tight font-medium text-balance sm:text-4xl">
            Pick the level that matches what you already know, not your age.
          </h2>
          <p className="mt-6 max-w-2xl leading-relaxed text-ink/70">
            The ages are a rough guide. What actually separates the levels is
            what each one assumes you have already run into.
          </p>

          <ol className="mt-14 space-y-px overflow-hidden rounded-lg bg-ink/12">
            {DIFFICULTY_LEVELS.map((level) => (
              <li
                key={level.level}
                className="grid gap-x-8 gap-y-3 bg-paper-deep px-6 py-7 sm:grid-cols-[auto_1fr_1.4fr] sm:items-baseline sm:px-8"
              >
                <div className="flex items-baseline gap-4">
                  {/*
                    The numeral is real content, not decoration — the list has
                    no marker, so this is the only place the level number is
                    announced. Ember/hot colouring per CLAUDE.md §8.
                  */}
                  <span
                    className="font-display text-3xl leading-none font-semibold tabular-nums"
                    style={{ color: difficultyAccent(level.level) }}
                  >
                    {level.level}
                  </span>
                  <span className="font-display text-2xl leading-none font-medium">
                    {level.name}
                  </span>
                </div>
                <p className="label text-ink/50">{level.audience}</p>
                <p className="text-sm leading-relaxed text-ink/75">
                  {level.assumes}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------- Officers */}
      <section className="border-b border-ink/10">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <p className="label text-ink/45">Who runs it</p>
          <h2 className="font-display mt-6 max-w-3xl text-3xl leading-tight font-medium text-balance sm:text-4xl">
            The officers, and the sponsor who signs off on all of it.
          </h2>

          <ul className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {OFFICERS.map((officer, index) => (
              <li key={index}>
                <div
                  className="flex aspect-4/3 items-center justify-center rounded-lg bg-ink/8"
                  aria-hidden
                >
                  <span className="font-display text-4xl font-medium text-ink/30">
                    {officer.monogram}
                  </span>
                </div>
                <h3 className="font-display mt-5 text-xl font-medium">
                  {officer.name}
                </h3>
                <p className="label mt-2 text-ink/50">{officer.title}</p>
                <p className="mt-4 text-sm leading-relaxed text-ink/70">
                  {officer.bio}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------ CTA band */}
      <section className="bg-ink text-mist">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-end">
            <div>
              <h2 className="font-display max-w-2xl text-3xl leading-tight font-medium text-balance sm:text-4xl">
                Is there something you had to figure out the hard way?
              </h2>
              <p className="mt-6 max-w-xl leading-relaxed text-mist/70">
                That is the video worth making. You upload it to YouTube as
                unlisted, paste the link here, and pick a level. FLARE members
                and approved outside contributors can post.
              </p>
            </div>
            <div className="flex flex-wrap gap-4 lg:justify-end">
              <Link
                href="/contribute"
                className="label rounded-full bg-mist px-7 py-4 text-ink transition-opacity hover:opacity-90"
              >
                How to contribute
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
