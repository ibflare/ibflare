import { notFound } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { PersonEditor, type Person } from "./PersonEditor";

export const metadata = { title: "People" };

/**
 * The sponsor's page. Section 7: it must work without anyone opening Supabase.
 *
 * A plain GET form, so the search survives a reload, is shareable, and works
 * with no JavaScript. The query goes to `search_people`, a definer function,
 * because matching on email means reading auth.users, which no client role
 * can do.
 *
 * An empty query lists everyone, since a club of a few hundred accounts is a
 * scrollable list and a sponsor opening this page usually wants to see who is
 * there rather than to search for a name they already know.
 */
export default async function PeoplePage(
  props: PageProps<"/dashboard/admin/people">,
) {
  const profile = await getCurrentProfile();
  if (!profile?.can_manage_users) notFound();

  const params = await props.searchParams;
  const raw = params.q;
  const q = ((Array.isArray(raw) ? raw[0] : raw) ?? "").trim().slice(0, 80);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_people", { p_query: q });

  const people = (data ?? []) as Person[];

  return (
    <div>
      <h2 className="font-display text-2xl leading-snug font-medium">People</h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink/70">
        Search by name, username, or email address. Click a person to change
        their title, role, and what they are allowed to do.
      </p>

      <form
        action="/dashboard/admin/people"
        method="get"
        className="mt-8 flex max-w-lg gap-3"
      >
        <input
          type="search"
          name="q"
          defaultValue={q}
          aria-label="Search people"
          placeholder="Name, username, or email"
          className="min-w-0 flex-1 rounded-full border border-ink/25 bg-paper px-5 py-3"
        />
        <button
          type="submit"
          className="label shrink-0 rounded-full bg-ink px-6 py-3 text-mist transition-opacity hover:opacity-90"
        >
          Search
        </button>
      </form>

      {error ? (
        <p role="alert" className="mt-10 leading-relaxed text-ink/70">
          {error.message}
        </p>
      ) : people.length === 0 ? (
        <p className="mt-10 leading-relaxed text-ink/70">
          {q
            ? `No account matches "${q}". Try part of a name, or their email address.`
            : "No accounts yet."}
        </p>
      ) : (
        <>
          <p className="label mt-10 text-ink/45">
            {people.length === 50
              ? "First 50 matches"
              : `${people.length} ${people.length === 1 ? "account" : "accounts"}`}
          </p>
          <ul className="mt-5 space-y-3">
            {people.map((person) => (
              <PersonEditor key={person.id} person={person} />
            ))}
          </ul>
        </>
      )}

      {/*
        Section 2's last-sponsor guard lives in set_user_permissions and
        surfaces as the error above. Stating it here as well means a sponsor
        reads it before they try, rather than after.
      */}
      <p className="mt-12 max-w-xl border-t border-ink/10 pt-6 text-sm leading-relaxed text-ink/55">
        FLARE needs at least one account that can manage people. A change that
        would leave none is refused.
      </p>
    </div>
  );
}
