import { createBrowserClient } from "@supabase/ssr";

// IMPORTANT: these must be static, literal `process.env.X` references.
// Next.js inlines NEXT_PUBLIC_ variables into the browser bundle by
// scanning source code at build time for exactly this pattern - it cannot
// resolve a dynamic process.env[name] lookup, which silently evaluates to
// undefined in the browser regardless of what's actually set in Vercel.
// (The equivalent dynamic-lookup helper in lib/supabase.ts is fine - that
// file only ever runs server-side, where a real process.env exists.)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const authConfigured = Boolean(url && anonKey);

export function createClient() {
  if (!url || !anonKey) {
    throw new Error(
      "Supabase browser client requires NEXT_PUBLIC_SUPABASE_URL and an anon/publishable key env var."
    );
  }
  return createBrowserClient(url, anonKey);
}
