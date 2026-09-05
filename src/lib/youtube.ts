/**
 * YouTube link handling. CLAUDE.md section 5.
 *
 * The contributor pastes a URL and nothing else is manual. Parsing and the
 * duration conversion are pure and live here so they can be reasoned about on
 * their own; the Data API call is in resolveYouTubeVideo below and only ever
 * runs on the server, because the key must never reach a browser.
 */

/** An 11 character video ID, which is the only shape YouTube issues. */
const ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Pull the video ID out of any YouTube URL shape, or return null.
 *
 * Handles watch?v=, youtu.be/, /embed/, /shorts/, and /live/, with or without
 * extra query parameters, with or without a scheme, and with or without www or
 * m. A bare ID pasted on its own is accepted too, since that is what someone
 * copying from a previous FLARE entry is likely to have.
 */
export function parseYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  if (ID.test(raw)) return raw;

  // Tolerate a missing scheme so "youtu.be/abc" parses like a URL.
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^(www\.|m\.)/i, "").toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") {
    return segments[0] && ID.test(segments[0]) ? segments[0] : null;
  }

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const v = url.searchParams.get("v");
    if (v && ID.test(v)) return v;

    // /embed/<id>, /shorts/<id>, /live/<id>, /v/<id>
    if (
      segments.length >= 2 &&
      ["embed", "shorts", "live", "v"].includes(segments[0].toLowerCase()) &&
      ID.test(segments[1])
    ) {
      return segments[1];
    }
  }

  return null;
}

/**
 * ISO 8601 duration to seconds. The API returns contentDetails.duration in
 * this form, so "PT14M3S" has to become 843.
 *
 * Days appear on nothing we would host but cost nothing to support. A live
 * stream returns "P0D", which yields 0 and is treated as unknown by the caller.
 */
export function parseIso8601Duration(value: string): number | null {
  const match =
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
      value.trim(),
    );
  if (!match) return null;

  const [, d, h, m, s] = match;
  if (!d && !h && !m && !s) return null;

  const seconds =
    Number(d ?? 0) * 86400 +
    Number(h ?? 0) * 3600 +
    Number(m ?? 0) * 60 +
    Math.round(Number(s ?? 0));

  return seconds > 0 ? seconds : null;
}

/** mm:ss, or h:mm:ss past an hour. For the library card and the video page. */
export function formatDuration(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null;

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * The thumbnail we store at submit time, per section 5.
 *
 * hqdefault exists for every video, which maxresdefault does not, so this
 * never 404s. Stored rather than derived at render time so the library does
 * not depend on a URL shape YouTube could change.
 */
export function thumbnailUrl(youtubeId: string): string {
  return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
}

/** The nocookie player, per section 5. Never mounted until the poster is clicked. */
export function embedUrl(youtubeId: string): string {
  const params = new URLSearchParams({
    autoplay: "1",
    rel: "0",
    modestbranding: "1",
  });
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?${params}`;
}

export type ResolvedVideo = {
  youtubeId: string;
  title: string;
  thumbnailUrl: string;
  durationS: number | null;
};

/**
 * The four things that can go wrong, each with the message section 5 specifies.
 * Kept as a union so the route and the server action return identical wording
 * rather than each inventing its own.
 */
export type ResolveFailure =
  | "unparseable"
  | "not_found"
  | "private"
  | "not_embeddable"
  | "no_key"
  | "api_error";

export const RESOLVE_MESSAGES: Record<ResolveFailure, string> = {
  unparseable:
    "That does not look like a YouTube link. Copy the address from the browser or the Share button.",
  not_found: "We couldn't find that video. Check the link.",
  private:
    "Private videos can't be embedded. Set it to Unlisted or Public.",
  not_embeddable:
    "Embedding is turned off for this video. Turn it on in YouTube Studio.",
  no_key:
    "We can't check YouTube links right now. Tell an officer, and try again later.",
  api_error:
    "We couldn't reach YouTube to check that link. Try again in a moment.",
};

export type ResolveResult =
  | { ok: true; video: ResolvedVideo }
  | { ok: false; reason: ResolveFailure; message: string };

function fail(reason: ResolveFailure): ResolveResult {
  return { ok: false, reason, message: RESOLVE_MESSAGES[reason] };
}

/**
 * Resolve a pasted URL against the Data API. Server only: this reads
 * YOUTUBE_API_KEY.
 *
 * part=snippet,contentDetails,status is one unit of the 10,000 per day quota,
 * so an upload costs 1 whether it succeeds or fails.
 */
export async function resolveYouTubeVideo(
  input: string,
): Promise<ResolveResult> {
  const id = parseYouTubeId(input);
  if (!id) return fail("unparseable");

  const key = process.env.YOUTUBE_API_KEY;

  // The keyless fallback from section 5. oembed needs no key and no quota, but
  // returns no duration, so it is a degraded path for local development rather
  // than the intended one.
  if (!key) return resolveViaOembed(id);

  const endpoint = new URL("https://www.googleapis.com/youtube/v3/videos");
  endpoint.searchParams.set("part", "snippet,contentDetails,status");
  endpoint.searchParams.set("id", id);
  endpoint.searchParams.set("key", key);

  let payload: {
    items?: {
      snippet?: { title?: string };
      contentDetails?: { duration?: string };
      status?: { privacyStatus?: string; embeddable?: boolean };
    }[];
  };

  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) return fail("api_error");
    payload = await response.json();
  } catch {
    return fail("api_error");
  }

  const item = payload.items?.[0];

  // An unknown or deleted ID comes back as an empty items array rather than a
  // 404, so this is the "doesn't exist" case.
  if (!item) return fail("not_found");

  if (item.status?.privacyStatus === "private") return fail("private");
  if (item.status?.embeddable === false) return fail("not_embeddable");

  const title = item.snippet?.title?.trim();
  if (!title) return fail("not_found");

  return {
    ok: true,
    video: {
      youtubeId: id,
      title,
      thumbnailUrl: thumbnailUrl(id),
      durationS: item.contentDetails?.duration
        ? parseIso8601Duration(item.contentDetails.duration)
        : null,
    },
  };
}

/**
 * No key: title and thumbnail only.
 *
 * oembed answers 401 for a private video and 404 for one that does not exist,
 * which covers two of the four checks. It says nothing about embeddability, so
 * that one goes unchecked on this path and the player simply refuses to play.
 * This is why the Data API is the default.
 */
async function resolveViaOembed(id: string): Promise<ResolveResult> {
  const endpoint = new URL("https://www.youtube.com/oembed");
  endpoint.searchParams.set("url", `https://www.youtube.com/watch?v=${id}`);
  endpoint.searchParams.set("format", "json");

  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (response.status === 401) return fail("private");
    if (!response.ok) return fail("not_found");

    const data = (await response.json()) as { title?: string };
    const title = data.title?.trim();
    if (!title) return fail("not_found");

    return {
      ok: true,
      video: {
        youtubeId: id,
        title,
        thumbnailUrl: thumbnailUrl(id),
        durationS: null,
      },
    };
  } catch {
    return fail("api_error");
  }
}
