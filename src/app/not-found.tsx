import Link from "next/link";

/**
 * Renders inside the root layout, so it keeps the header and footer — someone
 * who lands here by a bad link should be able to navigate straight out.
 *
 * Voice per CLAUDE.md §8: say what happened and how to fix it. No jokes, no
 * "oops", and no blaming the visitor.
 */
export const metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <p className="label text-ink/45">Error 404</p>

        <h1 className="font-display mt-6 max-w-3xl text-4xl leading-[1.1] font-medium text-balance sm:text-5xl">
          We could not find that page.
        </h1>

        <p className="mt-8 max-w-xl text-lg leading-relaxed text-ink/75">
          The address may be mistyped, or the page may have moved since the link
          was made. Nothing is wrong on your end.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/"
            className="label rounded-full bg-ink px-7 py-4 text-mist transition-opacity hover:opacity-90"
          >
            Go to the homepage
          </Link>
          <Link
            href="/library"
            className="label rounded-full border border-ink/25 px-7 py-4 text-ink transition-colors hover:border-ink"
          >
            Browse the library
          </Link>
        </div>
      </div>
    </section>
  );
}
