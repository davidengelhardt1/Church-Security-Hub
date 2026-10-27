import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { safeInternalPath } from "@/lib/safe";

export const dynamic = "force-dynamic";

/**
 * The magic link in the sign-in email points here with a one-time code.
 * Exchanging it for a session is what actually signs the user in - up to
 * this point they've only proven they clicked a link, not that they're
 * authenticated.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Only same-site paths are allowed. A raw value like "@evil.com" would otherwise
  // turn `${origin}${next}` into a link to another host.
  const next = safeInternalPath(searchParams.get("next"), "/preferences");

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
