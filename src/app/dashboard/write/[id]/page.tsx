import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { ArticleForm } from "../ArticleForm";

export const metadata = {
  title: "Edit an article",
};

/**
 * Editing an article you wrote.
 *
 * Reads the BASE table rather than public_articles, because a draft or a
 * hidden piece is exactly the thing its owner needs to be able to open, and
 * the public view filters both out by design. The owner select policy allows
 * it.
 *
 * Ownership is checked here so the page can 404 rather than render a form that
 * will refuse on submit. That is a courtesy, not the enforcement: the update
 * policy checks ownership, can_post, the suspension state and the wordlist
 * underneath, and updateArticle re-reads the affected row count because
 * PostgREST reports a zero-row update as success.
 *
 * The edit surface is deliberately the owner's alone. Moderators can still
 * update any article at the database level, matching what section 2 grants
 * them over videos, but there is no screen here for rewriting somebody else's
 * words: section 4 makes that argument about comments and it holds for prose.
 * A moderator who wants something gone takes it down, which is audited.
 */
export default async function EditArticlePage({
  params,
}: PageProps<"/dashboard/write/[id]">) {
  const { id } = await params;
  const profile = await getCurrentProfile();

  if (!profile) return null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: article } = await supabase
    .from("articles")
    .select("id, title, description, body, difficulty, topic, owner_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!article || article.owner_id !== profile.id) notFound();

  if (profile.suspended_at) {
    return (
      <div className="max-w-2xl">
        <h2 className="font-display text-2xl leading-snug font-medium">
          You cannot edit while your account is suspended
        </h2>
        <p className="mt-4 leading-relaxed text-ink/75">
          The article is still up, exactly as it was.
        </p>
        <Link
          href="/suspended"
          className="label mt-8 inline-block rounded-full border border-ink/25 px-6 py-3.5 transition-colors hover:border-ink"
        >
          What this means
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-2xl leading-snug font-medium">
        Edit article
      </h2>
      <p className="mt-4 leading-relaxed text-ink/75">
        Changes go live as soon as you save. Editing the words marks the piece
        as edited; changing the level or the topic does not.
      </p>

      <ArticleForm
        articleId={article.id}
        initial={{
          title: article.title,
          description: article.description ?? "",
          body: article.body,
          difficulty: String(article.difficulty),
          topic: article.topic,
        }}
      />

      <Link
        href="/dashboard"
        className="label mt-8 inline-block text-ink/55 transition-colors hover:text-ink"
      >
        Back to the dashboard
      </Link>
    </div>
  );
}
