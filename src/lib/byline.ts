/**
 * Byline formatting. CLAUDE.md section 3.
 *
 * Three forms, and the spec names all three:
 *
 *   owner only          Maya R.
 *   one collaborator    Maya R. and Andre L.
 *   more than one       Maya R. + 2 others
 *
 * The owner is always first and always named. Collaborators past the first are
 * counted rather than listed, because a byline that grows without bound stops
 * being a byline and starts being a cast list, and the video page has room to
 * show them all properly.
 */

export type Collaborator = {
  username: string;
  display_name: string;
};

/**
 * Parse the jsonb array that public_videos carries.
 *
 * Defensive because the column comes back as whatever PostgREST decoded: a
 * real array in the normal case, but a null or a stray shape would otherwise
 * throw inside a server component and take the whole page down for a
 * cosmetic field.
 */
export function readCollaborators(value: unknown): Collaborator[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const { username, display_name } = entry as Record<string, unknown>;
    if (typeof username !== "string" || typeof display_name !== "string") {
      return [];
    }
    return [{ username, display_name }];
  });
}

export function formatByline(
  ownerDisplayName: string,
  collaborators: Collaborator[],
): string {
  if (collaborators.length === 0) return ownerDisplayName;
  if (collaborators.length === 1) {
    return `${ownerDisplayName} and ${collaborators[0].display_name}`;
  }
  return `${ownerDisplayName} + ${collaborators.length} others`;
}
