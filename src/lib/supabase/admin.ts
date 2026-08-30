import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service role client. Bypasses RLS entirely.
 *
 * The `server-only` import above turns any attempt to pull this into a client
 * component into a build error rather than a leaked key. Nothing here may be
 * imported from a component that ships to the browser.
 *
 * There is exactly one caller: deleting the account of someone who fails the
 * age screen. Deleting an auth.users row is an admin operation and cannot be
 * done with the anon key. If a second caller ever appears, think hard about
 * whether it genuinely needs to bypass every policy in section 6.
 */
function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  }

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Removes the account and everything hanging off it.
 *
 * profiles.id references auth.users on delete cascade, so the profile row goes
 * with it. Returns whether the delete succeeded, since the caller has to sign
 * the person out either way.
 */
export async function deleteAuthUser(userId: string): Promise<boolean> {
  const { error } = await admin().auth.admin.deleteUser(userId);
  return !error;
}
