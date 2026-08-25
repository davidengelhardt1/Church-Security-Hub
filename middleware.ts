import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Static references. There's real ambiguity in Next.js's own community
// about whether middleware (Edge Runtime) supports genuinely dynamic
// process.env[name] lookups at runtime, or whether it's subject to the
// same build-time literal-inlining as browser code - reports differ
// across Next.js versions. Since a static reference costs nothing and
// removes the ambiguity entirely, use it here too rather than risk the
// same class of bug that broke the browser client.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

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
