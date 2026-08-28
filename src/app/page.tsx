import Link from "next/link";
import { DIFFICULTY_LEVELS, difficultyAccent } from "@/lib/taxonomy";

const PRINCIPLES = [
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
            FLARE is a student-run video library covering personal finance,
            taxes, and economics. Each video is assigned one of five difficulty
            levels, from introductory topics like income and banking to advanced
            material on corporate filings, so you can start with the version
            that fits what you already know.
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
                We publish what we learn.
              </h2>
              <p className="mt-7 leading-relaxed text-ink/75">
                FLARE is a student organization at Lamar Academy in the Rio
                Grande Valley. Members pick something they had to work out for
                themselves, such as how tax withholding works, what moves a
                credit score, or why rent went up, and make a short video
                explaining it.
              </p>
              <p className="mt-5 leading-relaxed text-ink/75">
                Every video gets a difficulty level and a topic, then joins the
                library alongside other explanations of the same subject. Answer
                a question once, and the next person doesn&rsquo;t have to start
                from nothing.
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
          {/*
            No eyebrow here. The copy deck names this section "The five levels"
            and also gives it that heading, so an eyebrow would just repeat the
            h2 word for word.
          */}
          <h2 className="font-display max-w-3xl text-3xl leading-tight font-medium text-balance sm:text-4xl">
            The five levels
          </h2>
          <p className="mt-6 max-w-2xl leading-relaxed text-ink/70">
            Levels describe what a video assumes you already know, not how old
            you are. The age ranges are a rough guide.
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
                Add to the library.
              </h2>
              <p className="mt-6 max-w-xl leading-relaxed text-mist/70">
                Upload your video to YouTube as unlisted, paste the link here,
                and pick a difficulty level and topic. Open to FLARE members and
                approved outside contributors.
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
