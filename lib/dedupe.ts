import { Incident } from "./types";

/**
 * Storage-level dedupe.
 *
 * Google News returns one URL per outlet, so a single wire story arrives as
 * dozens of rows with different ids and urls but the same headline. The CIS
 * advisory feed also re-publishes an advisory under a new number with an
 * identical title. Keying on id/url (as ingestion originally did) can't see
 * any of that, so we key on the normalized headline instead.
 *
 * titleKey() MUST stay in sync with the `title_key` generated column in
 * supabase/schema.sql - the database computes the stored value and this
 * function computes the candidate's, and they are compared directly.
 */
export function titleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const DAY_MS = 86400000;

/**
 * How close in time two same-headline items must be to count as one story.
 *
 * News syndication is bursty but can trail for a couple of weeks. CIS/CISA
 * advisories are the opposite: they reuse a title ("Multiple Vulnerabilities
 * in Google Chrome ...") for genuinely different bulletins days apart, so a
 * wide window would hide real new advisories. A re-published duplicate keeps
 * the same publish timestamp, which a 1-day window still catches.
 */
export function dedupeWindowMs(category: Incident["category"]): number {
  return category === "cyber" ? DAY_MS : 14 * DAY_MS;
}

export interface KnownIncident {
  category: Incident["category"];
  titleKey: string;
  publishedAt: string;
}

/**
 * Returns only the incidents that are not copies of something already stored
 * (or of an earlier item in the same batch). Earliest-published copy wins, so
 * the first outlet to report a story is the one we keep and alert on.
 */
export function selectNewIncidents(
  candidates: Incident[],
  known: KnownIncident[]
): { fresh: Incident[]; skipped: number } {
  // category|titleKey -> publish timestamps already seen
  const seen = new Map<string, number[]>();
  const keyOf = (category: string, key: string) => `${category}|${key}`;

  for (const k of known) {
    const mapKey = keyOf(k.category, k.titleKey);
    const list = seen.get(mapKey) ?? [];
    list.push(new Date(k.publishedAt).getTime());
    seen.set(mapKey, list);
  }

  const ordered = [...candidates].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
  );

  const fresh: Incident[] = [];
  let skipped = 0;

  for (const inc of ordered) {
    const key = titleKey(inc.title);
    // An empty key (title made only of symbols) can't be compared safely.
    if (!key) {
      fresh.push(inc);
      continue;
    }
    const mapKey = keyOf(inc.category, key);
    const ts = new Date(inc.publishedAt).getTime();
    const window = dedupeWindowMs(inc.category);
    const list = seen.get(mapKey) ?? [];

    if (list.some((t) => Math.abs(t - ts) <= window)) {
      skipped++;
      continue;
    }

    fresh.push(inc);
    list.push(ts);
    seen.set(mapKey, list);
  }

  return { fresh, skipped };
}
