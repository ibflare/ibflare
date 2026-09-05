import Link from "next/link";
import { PRINCIPLES } from "@/lib/principles";

export const metadata = {
  title: "Our mission",
  description:
    "Why FLARE exists: a free financial education library for the Rio Grande Valley, made by students at Lamar Academy.",
};

/**
 * Our mission.
 *
 * THE COPY HERE IS A PLACEHOLDER, and a deliberate kind of one: every word is
 * lifted verbatim from the landing page's mission block and the principles
 * list, both of which are client copy deck wording that has already been
 * approved. Nothing on this page was written fresh.
 *
 * That is so the nav link resolves to something real rather than an empty page
 * while the client's own mission copy is being written. Replace the body when
 * it arrives; the landing page keeps its own shorter version.
 */
export default function OurMissionPage() {
  return (
    <>
      <section className="border-b border-ink/10">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div className="max-w-2xl">
            <h1 className="font-display text-4xl leading-[1.1] font-medium text-balance sm:text-5xl">
              We publish what we learn.
            </h1>
            <p className="mt-8 text-lg leading-relaxed text-ink/75">
              FLARE is a student organization at Lamar Academy in the Rio Grande
              Valley. Members pick something they had to work out for
              themselves, such as how tax withholding works, what moves a credit
              score, or why rent went up, and make a short video explaining it.
            </p>
            <p className="mt-5 leading-relaxed text-ink/75">
              Every video gets a difficulty level and a topic, then joins the
              library alongside other explanations of the same subject. Answer a
              question once, and the next person doesn&rsquo;t have to start from
              nothing.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-ink/10 bg-paper-deep">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <h2 className="font-display max-w-3xl text-3xl leading-tight font-medium text-balance sm:text-4xl">
            What we hold to
          </h2>

          <ul className="mt-14 grid gap-px overflow-hidden rounded-lg bg-ink/12 sm:grid-cols-2">
            {PRINCIPLES.map((principle) => (
              <li key={principle.heading} className="bg-paper-deep p-7 sm:p-9">
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
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl leading-tight font-medium text-balance sm:text-4xl">
              Watching is free and needs no account
            </h2>
            <p className="mt-7 leading-relaxed text-ink/75">
              The whole library is open. An account is only needed in order to
              publish a video or leave a comment, and the club decides who
              contributes.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/library"
                className="label rounded-full bg-ink px-7 py-4 text-mist transition-opacity hover:opacity-90"
              >
                Browse the library
              </Link>
              <Link
                href="/contribute"
                className="label rounded-full border border-ink/25 px-7 py-4 text-ink transition-colors hover:border-ink"
              >
                How to post a video
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
