import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client. Only ever uses the anon key, which is public by design: it
 * is the key the RLS policies in CLAUDE.md section 6 are written against, so
 * it grants exactly what those policies allow and nothing else.
 *
 * The service role key must never appear in a file that reaches the browser.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
