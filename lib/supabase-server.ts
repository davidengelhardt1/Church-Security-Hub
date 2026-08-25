import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function firstSet(...names: string[]): string | undefined {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim() !== "") return v;
  }
  return undefined;
}

const url = firstSet("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = firstSet(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
);

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
