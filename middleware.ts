import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
 * Supabase's auth session is a short-lived token that needs refreshing.
 * Without this middleware, sessions would silently expire mid-use instead
 * of refreshing transparently - this runs on every request and keeps the
 * cookie current before it ever gets stale enough to matter.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!url || !anonKey) return response; // auth not configured - no-op

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Touching getUser() is what actually triggers the refresh-if-needed logic.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets and image optimization files -
     * those never need an auth session.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
