import { createBrowserClient } from "@supabase/ssr";

// Uses the PUBLIC anon/publishable key, not the secret key that
// lib/supabase.ts uses server-side. This key is safe in browser code by
// design - it can only do what RLS policies allow, which for this project
// means: read/write your own subscription row, nothing else.
//
// Reads whichever name the Supabase-Vercel integration or manual setup
// provided, same fallback pattern as the server-side client in
// lib/supabase.ts.
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

export const authConfigured = Boolean(url && anonKey);

export function createClient() {
  if (!url || !anonKey) {
    throw new Error(
      "Supabase browser client requires NEXT_PUBLIC_SUPABASE_URL and an anon/publishable key env var."
    );
  }
  return createBrowserClient(url, anonKey);
}
