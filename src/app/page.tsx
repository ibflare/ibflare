import Link from "next/link";
import { DIFFICULTY_LEVELS, difficultyAccent } from "@/lib/taxonomy";

const PRINCIPLES = [
  {
    heading: "Produced by students",
    body: "Every video is produced by a FLARE member who worked through the subject themselves before explaining it. The library is not a purchased curriculum, and it is not instructional material delivered from a script.",
  },
  {
    heading: "Organized by difficulty",
    body: "A subject is explained more than once, at different levels. Where a video presumes knowledge a viewer does not yet hold, a lower-level treatment of the same subject is available. Material is not deprioritized on the basis of age.",
  },
  {
    heading: "No commercial interest",
    body: "The library explains how financial instruments and obligations function; it does not recommend products. FLARE accepts no sponsorship, affiliate arrangement, or referral compensation. Where a contributor is uncertain, the video states as much explicitly.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      {/*
        Background video at public/videos/hero.mp4, encoded from the 4K master
        in media-src/ (which is gitignored) down to 1080p / 24fps / no audio,
        4.7MB. Re-encode rather than committing a master: anything over 100MB
        is rejected outright by GitHub, and the element is muted so an audio
        track is pure waste. The filename must stay lowercase, since Vercel
        serves from a case-sensitive filesystem.

        If the file is absent the ink background shows through, which is a
        valid state. Nothing here depends on the footage existing.
      */}
      <section className="relative isolate overflow-hidden bg-ink text-mist">
        <video
          className="absolute inset-0 size-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/images/hero-poster.jpg"
          aria-hidden
          tabIndex={-1}
        >
          <source src="/videos/hero.mp4" type="video/mp4" />
        </video>

        {/* Scrim. Holds the text contrast whatever the footage is doing. */}
        <div className="hero-scrim absolute inset-0" aria-hidden />

        <div className="relative mx-auto max-w-6xl px-6 py-28 sm:py-36 lg:py-44">
          <h1 className="font-display max-w-4xl text-4xl leading-[1.08] font-medium text-balance sm:text-5xl lg:text-6xl">
            Learn about money at your own level.
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-mist/80">
            FLARE maintains a video library on financial literacy, taxation, and
            economics, produced by student contributors. Each video is assigned
            one of five difficulty levels, ranging from introductory material on
            income and banking through the analysis of corporate filings, so
            that viewers may select the treatment appropriate to their existing
            knowledge.
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
              Submit a video
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
                An organization that publishes what its members learn.
              </h2>
              <p className="mt-7 leading-relaxed text-ink/75">
                FLARE operates at Lamar Academy in the Rio Grande Valley.
                Members identify a subject they have had to resolve for
                themselves, such as the mechanics of tax withholding, the
                components of a credit score, or the drivers of an increase in
                rent, and produce a concise video explaining it.
              </p>
              <p className="mt-5 leading-relaxed text-ink/75">
                Each submission is assigned a difficulty level and a topic, then
                published to the library alongside other treatments of the same
                subject. That is the organization&rsquo;s function: resolve a
                question, then document the answer for those who encounter it
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
            Levels correspond to prior knowledge rather than to age.
          </h2>
          <p className="mt-6 max-w-2xl leading-relaxed text-ink/70">
            The age ranges below are indicative only. The operative distinction
            between levels is what each one presumes the viewer has already
            encountered.
          </p>

          <ol className="mt-14 space-y-px overflow-hidden rounded-lg bg-ink/12">
            {DIFFICULTY_LEVELS.map((level) => (
              <li
                key={level.level}
                className="grid gap-x-8 gap-y-3 bg-paper-deep px-6 py-7 sm:grid-cols-[auto_1fr_1.4fr] sm:items-baseline sm:px-8"
              >
                <div className="flex items-baseline gap-4">
                  {/*
                    The numeral is real content, not decoration. The list has
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

      {/* ------------------------------------------------------------ CTA band */}
      <section className="bg-ink text-mist">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-end">
            <div>
              <h2 className="font-display max-w-2xl text-3xl leading-tight font-medium text-balance sm:text-4xl">
                Contribute to the library.
              </h2>
              <p className="mt-6 max-w-xl leading-relaxed text-mist/70">
                Contributors upload their video to YouTube as an unlisted entry,
                submit the link, and assign a difficulty level and topic.
                Submission is open to FLARE members and to approved outside
                contributors.
              </p>
            </div>
            <div className="flex flex-wrap gap-4 lg:justify-end">
              <Link
                href="/contribute"
                className="label rounded-full bg-mist px-7 py-4 text-ink transition-opacity hover:opacity-90"
              >
                Contribution guidelines
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
