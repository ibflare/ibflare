/**
 * Shell for the privacy policy and terms. Single column at a generous measure,
 * same display face and spacing rhythm as the rest of the site.
 *
 * The prose rules live in the .legal component class in globals.css rather
 * than as utilities on every element, since this content is written as
 * ordinary markup and there is a lot of it.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mx-auto max-w-[68ch] px-6 py-20 sm:py-24">
        <h1 className="font-display text-4xl leading-[1.1] font-medium text-balance sm:text-5xl">
          {title}
        </h1>
        <p className="label mt-6 text-ink/45">Last updated {updated}</p>

        <div className="legal mt-14">{children}</div>
      </div>
    </section>
  );
}

/** Contact block. Kept out of the flow of .legal p spacing. */
export function LegalAddress() {
  return (
    <address className="mt-6">
      FLARE
      <br />
      Lamar Academy
      <br />
      1009 N 10th St
      <br />
      McAllen, TX 78501
      <br />
      <a href="mailto:ibflarergv@gmail.com">ibflarergv@gmail.com</a>
    </address>
  );
}

/** Wide content has to scroll inside itself, not push the page sideways. */
export function LegalTable({ children }: { children: React.ReactNode }) {
  return <div className="mb-5 overflow-x-auto">{children}</div>;
}
