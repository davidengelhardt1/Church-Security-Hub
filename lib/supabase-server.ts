import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Static references, matching lib/supabase-browser.ts - this file only
// runs server-side today (dynamic process.env[name] lookup would actually
// work fine here), but keeping the pattern consistent means nobody
// re-introduces the browser bug if this ever gets imported somewhere
// unexpected.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Server-side client that reads the user's session from cookies. Used in
 * server components and route handlers to check "who is signed in?" -
 * distinct from lib/supabase.ts, which uses the secret key and has no
 * concept of an individual user (it's the app's own service identity).
 */
export async function createServerSupabaseClient() {
  if (!url || !anonKey) {
    throw new Error("Supabase server client requires NEXT_PUBLIC_SUPABASE_URL and an anon key.");
  }
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component that can't set cookies - safe to
          // ignore as long as middleware.ts is refreshing sessions, which it is.
        }
      },
    },
  });
}
