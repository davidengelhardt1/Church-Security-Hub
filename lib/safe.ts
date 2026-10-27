import type { Incident } from "./types";

const MAX_URL_LENGTH = 2048;

/**
 * Returns the URL only if it is a plain http(s) link, otherwise null.
 *
 * Article links come from outside feeds. Without this check a value like
 * `javascript:...` would run script when someone clicks it, and escaping
 * HTML does not help because the problem is the URL scheme, not the markup.
 */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > MAX_URL_LENGTH) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.username || u.password) return null; // no credentials embedded in links
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Accepts only a same-site path for post-login redirects. Anything else
 * (another host, `//host`, `/\host`, `@host`, a scheme) falls back.
 */
export function safeInternalPath(value: string | null | undefined, fallback = "/preferences"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const base = "https://app.invalid";
    const u = new URL(value, base);
    if (u.origin !== base) return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}

/** Drops incidents whose link is not a safe http(s) URL, and normalizes the rest. */
export function cleanIncidents(incidents: Incident[]): Incident[] {
  const out: Incident[] = [];
  for (const inc of incidents) {
    const url = safeHttpUrl(inc.url);
    if (!url) continue;
    out.push(url === inc.url ? inc : { ...inc, url });
  }
  return out;
}
