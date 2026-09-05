import { notFound } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { publicTag, type PublicProfile } from "@/lib/profiles";
import { Avatar } from "@/components/Avatar";
import { AvatarEditor } from "./AvatarEditor";
import { ModeratorAvatarControl } from "./ModeratorAvatarControl";

/**
 * Public profile.
 *
 * Reads public_profiles, never the base table. That view does not carry grade,
 * city, or school, so the privacy rule in section 9.1 holds structurally here:
 * there is no column to leak, not merely no markup rendering one.
 */
async function getProfile(username: string): Promise<PublicProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("public_profiles")
    .select("id, username, display_name, title, avatar_url, bio, role")
    .eq("username", username.toLowerCase())
    .maybeSingle();

  return data;
}

export async function generateMetadata({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const profile = await getProfile(username);

  if (!profile) return { title: "Profile not found" };

  const tag = publicTag(profile.role, profile.title);
  return {
    title: profile.display_name,
    description: tag
      ? `${profile.display_name}, ${tag} at FLARE.`
      : `${profile.display_name} on FLARE.`,
  };
}

export default async function ProfilePage({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const profile = await getProfile(username);

  if (!profile) notFound();

  const tag = publicTag(profile.role, profile.title);

  /*
   * Two different controls, and neither is what enforces anything: the storage
   * policies and clear_avatar() do that.
   *
   * canEdit  the owner, changing their own picture. Any onboarded account
   *          since 20260904010000, where it used to require can_post.
   * canClear a moderator, taking someone else's picture down. The counterweight
   *          to the above: opening uploads to everyone widens the moderation
   *          surface, so there has to be a way to remove an image. Section 2.
   */
  const viewer = await getCurrentProfile();
  const isOwner = viewer?.id === profile.id;
  const canEdit = isOwner && viewer?.onboarded === true;
  const canClear =
    !isOwner && viewer?.can_moderate === true && profile.avatar_url !== null;

  return (
    <section>
      <div className="mx-auto max-w-4xl px-6 py-20 sm:py-24">
        <div className="flex flex-col gap-7 sm:flex-row sm:items-start sm:gap-10">
          {canEdit ? (
            <AvatarEditor
              src={profile.avatar_url}
              displayName={profile.display_name}
            />
          ) : (
            <Avatar
              src={profile.avatar_url}
              displayName={profile.display_name}
              px={112}
              className="size-24 sm:size-28"
            />
          )}

          <div className="min-w-0">
            <h1 className="font-display text-4xl leading-tight font-medium text-balance sm:text-5xl">
              {profile.display_name}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              {tag && <span className="label text-ink/50">{tag}</span>}
              <span className="text-sm text-ink/45">@{profile.username}</span>
            </div>

            {profile.bio && (
              <p className="mt-7 max-w-xl leading-relaxed text-ink/75">
                {profile.bio}
              </p>
            )}

            {canClear && (
              <ModeratorAvatarControl
                targetId={profile.id}
                targetUsername={profile.username}
                displayName={profile.display_name}
              />
            )}
          </div>
        </div>

        {/* Videos arrive in phase 3, along with the videos table itself. */}
        <div className="mt-16 border-t border-ink/10 pt-10">
          <h2 className="label text-ink/45">Videos</h2>
          <p className="mt-5 max-w-xl leading-relaxed text-ink/60">
            Nothing here yet. Videos will show up on this page once the library
            opens.
          </p>
        </div>
      </div>
    </section>
  );
}
