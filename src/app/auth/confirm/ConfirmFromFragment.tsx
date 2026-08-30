"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const EXPIRED =
  "That link has expired or was already used. Sign in to get a new one.";

/**
 * Last resort for the implicit flow, where Supabase returns the session in the
 * URL fragment. A fragment is never sent to the server, so this is the only
 * place it can be read.
 *
 * Holds no state on purpose: every path ends in a navigation, so there is
 * nothing to render differently and no setState to run inside the effect.
 */
export function ConfirmFromFragment() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const error = params.get("error_description") ?? params.get("error");

    if (error) {
      router.replace(`/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (!accessToken || !refreshToken) {
      router.replace(`/login?error=${encodeURIComponent(EXPIRED)}`);
      return;
    }

    const supabase = createClient();
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error: setError }) => {
        if (setError) {
          router.replace(`/login?error=${encodeURIComponent(EXPIRED)}`);
          return;
        }
        // Clear the tokens out of the address bar before moving on.
        window.history.replaceState(null, "", window.location.pathname);
        router.replace("/onboarding");
      });
  }, [router]);

  return null;
}
