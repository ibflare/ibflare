/**
 * The public tag shown beside a person's name, per CLAUDE.md section 2.
 *
 *   viewer  -> nothing
 *   member  -> "Member"
 *   officer -> their title
 *   sponsor -> "Sponsor"
 *
 * An officer with no title set falls back to "Officer" rather than rendering
 * an empty tag. Note this reads `role`, which is display only: anything that
 * grants or withholds access must check a capability flag instead.
 */
export type PublicProfile = {
  id: string;
  username: string;
  display_name: string;
  title: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string;
};

export function publicTag(
  role: string,
  title: string | null,
): string | null {
  switch (role) {
    case "sponsor":
      return title?.trim() || "Sponsor";
    case "officer":
      return title?.trim() || "Officer";
    case "member":
      return title?.trim() || "Member";
    default:
      return title?.trim() || null;
  }
}

/** Initials for the avatar fallback. */
export function initials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
