import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { publicTag } from "@/lib/profiles";
import { CommentForm } from "./CommentForm";
import { CommentControls } from "./CommentControls";

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  author_id: string;
  author_username: string;
  author_display_name: string;
  author_avatar_url: string | null;
  author_title: string | null;
  author_role: string;
};

/** "3 minutes ago", down to the day, then a date. */
function ago(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const EDIT_WINDOW_MS = 5 * 60 * 1000;

/**
 * Whether the five-minute edit window is still open.
 *
 * A module-level helper rather than an inline Date.now() in the render, which
 * react-hooks/purity refuses: a render that reads the clock produces different
 * output on each run.
 *
 * Worth being clear that this is cosmetic either way. The window is enforced
 * by the update policy on comments, so a page left open past the five minutes
 * shows an Edit button that no longer works, and editComment answers that with
 * "The five minutes to edit a comment have passed." The button is a hint, not
 * a permission.
 */
function withinEditWindow(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < EDIT_WINDOW_MS;
}

/**
 * The comment section. CLAUDE.md sections 4 and 6.
 *
 * Reads public_comments, which is already limited to non-deleted comments on
 * published videos, so a soft-deleted comment disappears without this page
 * having to remember to filter.
 *
 * Everything about who sees which control is decided here from the viewer's
 * own profile row, and none of it is enforcement: the report function refuses
 * your own comment, the edit policy enforces the five minutes, and
 * soft_delete_comment checks ownership and can_moderate. This only decides
 * what to draw.
 */
export async function Comments({ videoId }: { videoId: string }) {
  const supabase = await createClient();

  const [{ data: rows }, { data: settings }, viewer] = await Promise.all([
    supabase
      .from("public_comments")
      .select(
        "id, body, created_at, edited_at, author_id, author_username, author_display_name, author_avatar_url, author_title, author_role",
      )
      .eq("video_id", videoId)
      .order("created_at", { ascending: true }),
    supabase.from("site_settings").select("comments_enabled").eq("id", 1).maybeSingle(),
    getCurrentProfile(),
  ]);

  const comments = (rows ?? []) as CommentRow[];

  /*
   * Section 4: the kill switch hides every comment UI site-wide. Existing
   * comments are hidden rather than deleted, so the whole section goes, not
   * just the form. It comes back exactly as it was when the switch is flipped.
   */
  if (settings?.comments_enabled === false) {
    return (
      <section className="mt-14 border-t border-ink/10 pt-10">
        <h2 className="label text-ink/45">Comments</h2>
        <p className="mt-5 max-w-xl leading-relaxed text-ink/60">
          Comments are turned off at the moment.
        </p>
      </section>
    );
  }

  const canComment = Boolean(
    viewer?.onboarded && !viewer.suspended_at,
  );
  const canModerate = viewer?.can_moderate === true;

  return (
    <section className="mt-14 border-t border-ink/10 pt-10">
      <h2 className="label text-ink/45">
        {comments.length === 0
          ? "Comments"
          : `${comments.length} ${comments.length === 1 ? "comment" : "comments"}`}
      </h2>

      {canComment ? (
        <CommentForm videoId={videoId} />
      ) : viewer ? (
        <p className="mt-6 max-w-xl leading-relaxed text-ink/60">
          {viewer.suspended_at
            ? "Your account is suspended, so you cannot comment."
            : "Finish setting up your account to comment."}
        </p>
      ) : (
        <p className="mt-6 leading-relaxed text-ink/60">
          <Link
            href={`/login?next=/v/${videoId}`}
            className="underline decoration-ink/25 underline-offset-4 transition-colors hover:text-ink"
          >
            Sign in
          </Link>{" "}
          to comment.
        </p>
      )}

      {comments.length > 0 && (
        <ul className="mt-10 space-y-8">
          {comments.map((comment) => {
            const mine = viewer?.id === comment.author_id;
            const tag = publicTag(comment.author_role, comment.author_title);
            const withinWindow = withinEditWindow(comment.created_at);

            return (
              <li key={comment.id} className="flex gap-3.5">
                <Link href={`/u/${comment.author_username}`} className="shrink-0">
                  <Avatar
                    src={comment.author_avatar_url}
                    displayName={comment.author_display_name}
                    px={36}
                    className="size-9"
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <Link
                      href={`/u/${comment.author_username}`}
                      className="font-medium transition-colors hover:text-ink/70"
                    >
                      {comment.author_display_name}
                    </Link>
                    {tag && <span className="label text-ink/40">{tag}</span>}
                    <span className="text-sm text-ink/40">
                      {ago(comment.created_at)}
                      {comment.edited_at && ", edited"}
                    </span>
                  </div>

                  <p className="mt-1.5 leading-relaxed whitespace-pre-line text-ink/80">
                    {comment.body}
                  </p>

                  {viewer && (
                    <CommentControls
                      commentId={comment.id}
                      videoId={videoId}
                      body={comment.body}
                      canEdit={mine && withinWindow && !viewer.suspended_at}
                      canDelete={mine || canModerate}
                      canReport={!mine && canComment}
                      moderating={!mine && canModerate}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
