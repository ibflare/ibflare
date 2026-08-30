import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server client for server components, server actions, and route handlers.
 *
 * Still the anon key. Reads and writes are governed by RLS exactly as they are
 * in the browser; the difference is only that the session comes from the
 * cookie store rather than from browser storage.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server components cannot set cookies. That is fine: proxy.ts
            // refreshes the session on every request, so the write here is
            // redundant rather than load-bearing.
          }
        },
      },
    },
  );
}

/**
 * The signed-in user's own profile row, or null.
 *
 * Reads the base table rather than public_profiles, so it includes the private
 * columns and the capability flags. Only ever returns the caller's own row:
 * the "owner reads own row" policy sees to that.
 */
export async function getCurrentProfile() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return data;
}
