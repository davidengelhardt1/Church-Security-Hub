import { XMLParser } from "fast-xml-parser";
import { Incident } from "./types";
import { scoreSeverity } from "./classify";

// CISA retired its dedicated KEV/alert RSS in May 2025, but the consolidated
// advisories feed and MS-ISAC's feed are still live as of this writing.
// If a feed goes dark, drop it here rather than letting it break ingestion.
const CYBER_FEEDS = [
  {
    name: "CISA Cybersecurity Advisories",
    url: "https://www.cisa.gov/cybersecurity-advisories/all.xml",
  },
  {
    name: "CIS / MS-ISAC Advisories",
    url: "https://www.cisecurity.org/feed/advisories",
  },
];

const parser = new XMLParser({ ignoreAttributes: false });

function toArray<T>(x: T | T[] | undefined): T[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

// These feeds publish every vendor patch bulletin going back months, which
// buries the handful of items a small org actually needs to see. Keep it to
// a recent window and a sane cap so it doesn't drown out everything else.
const MAX_AGE_DAYS = 90;
const MAX_ITEMS_PER_FEED = 20;

async function fetchOneFeed(name: string, url: string): Promise<Incident[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "church-security-watch/0.1" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const parsed = parser.parse(xml);

    const items = toArray(parsed?.rss?.channel?.item);
    const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;

    const mapped = items.map((item: any) => {
      const title = String(item.title ?? "Untitled advisory");
      const link = String(item.link ?? url);
      const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
      return {
        id: `feed-${name}-${link}`,
        title,
        url: link,
        source: name,
        category: "cyber" as const,
        severity: scoreSeverity(title),
        publishedAt: pubDate.toISOString(),
        snippet: item.description ? String(item.description).slice(0, 240) : undefined,
        _ts: pubDate.getTime(),
      };
    });

    return mapped
      .filter((i) => i._ts >= cutoff)
      .sort((a, b) => b._ts - a._ts)
      .slice(0, MAX_ITEMS_PER_FEED)
      .map(({ _ts, ...rest }) => rest);
  } catch {
    // A single dead/slow feed shouldn't take down the whole dashboard
    return [];
  }
}

export async function fetchAllCyberFeeds(): Promise<Incident[]> {
  const results = await Promise.allSettled(
    CYBER_FEEDS.map((f) => fetchOneFeed(f.name, f.url))
  );
  const incidents: Incident[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") incidents.push(...r.value);
  }
  return incidents;
}
