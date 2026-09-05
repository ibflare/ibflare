import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveYouTubeVideo } from "@/lib/youtube";

/**
 * Resolve a pasted YouTube URL for the upload form.
 *
 * A route handler rather than a server action because the form calls it on
 * paste, before anything is submitted, and needs the answer back to prefill
 * the title and show the thumbnail. Section 5: this call happens on the server
 * so YOUTUBE_API_KEY is never exposed.
 *
 * Gated on can_post even though it only reads YouTube. The quota is 10,000
 * units a day and this endpoint spends one per call, so leaving it open to
 * anyone would hand a stranger the ability to exhaust it. The gate is the same
 * one the upload form itself has.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("can_post, suspended_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.can_post || profile.suspended_at) {
    return NextResponse.json(
      { error: "Posting is not enabled for your account." },
      { status: 403 },
    );
  }

  let url: unknown;
  try {
    ({ url } = await request.json());
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  if (typeof url !== "string" || !url.trim()) {
    return NextResponse.json({ error: "Paste a link first." }, { status: 400 });
  }

  const result = await resolveYouTubeVideo(url);

  if (!result.ok) {
    // 200 with a message, not an error status: these are all "the link is not
    // usable" answers the form renders inline, not transport failures.
    return NextResponse.json({ ok: false, message: result.message });
  }

  return NextResponse.json({ ok: true, video: result.video });
}
