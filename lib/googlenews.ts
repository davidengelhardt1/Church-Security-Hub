import { XMLParser } from "fast-xml-parser";
import { Incident, Category } from "./types";
import { scoreSeverity } from "./classify";
import { isRelevant } from "./relevance";

// Google News exposes a keyless RSS search endpoint. Unlike GDELT it has no
// fragile boolean syntax and no query-length ceiling - each search is short
// and specific, and we run several per category. This is the primary source
// for physical/extremism incidents; GDELT is kept as a supplement.
const BASE = "https://news.google.com/rss/search";

const parser = new XMLParser({ ignoreAttributes: false });

// Keep each query SHORT and specific. Many small queries beat one giant one.
const SEARCHES: { category: Category; q: string }[] = [
  // Physical security - violence
  { category: "physical", q: "church shooting" },
  { category: "physical", q: "church stabbing" },
  { category: "physical", q: "synagogue attack" },
  { category: "physical", q: "mosque attack" },
  { category: "physical", q: "\"house of worship\" attack" },
  { category: "physical", q: "church bomb threat" },
  // Physical security - property crime / disruption
  { category: "physical", q: "church burglary" },
  { category: "physical", q: "church vandalism" },
  { category: "physical", q: "church arson" },
  { category: "physical", q: "church robbery" },
  { category: "physical", q: "church intruder" },
  // Extremism
  { category: "extremism", q: "church hate crime" },
  { category: "extremism", q: "synagogue antisemitic incident" },
  { category: "extremism", q: "mosque hate crime" },
  { category: "extremism", q: "religious site extremist threat" },
  // Cyber - scoped to churches/faith nonprofits, not generic CVEs
  { category: "cyber", q: "church ransomware" },
  { category: "cyber", q: "church data breach" },
  { category: "cyber", q: "diocese cyberattack" },
  { category: "cyber", q: "megachurch fraud scam" },
  { category: "cyber", q: "nonprofit ransomware attack" },
];

function toArray<T>(x: T | T[] | undefined): T[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

// Google News titles arrive as "Headline text - Publisher Name".
// Split the publisher off so it can be shown in the source column.
function splitTitle(raw: string): { title: string; publisher?: string } {
  const idx = raw.lastIndexOf(" - ");
  if (idx === -1) return { title: raw };
  return { title: raw.slice(0, idx).trim(), publisher: raw.slice(idx + 3).trim() };
}

async function runSearch(category: Category, q: string): Promise<Incident[]> {
  // when:90d limits to the last 90 days, matching the RSS advisory window.
  const params = new URLSearchParams({
    q: `${q} when:90d`,
    hl: "en-US",
    gl: "US",
    ceid: "US:en",
  });

  try {
    const res = await fetch(`${BASE}?${params.toString()}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      console.error(`Google News search failed [${q}]: ${res.status}`);
      return [];
    }

    const xml = await res.text();
    const parsed = parser.parse(xml);
    const items = toArray(parsed?.rss?.channel?.item);

    return items
      .map((item: any) => {
        const { title, publisher } = splitTitle(String(item.title ?? ""));
        const link = String(item.link ?? "");
        const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
        const sourceName =
          (typeof item.source === "object" ? item.source?.["#text"] : item.source) ??
          publisher ??
          "Google News";

        return {
          // Key on the article link so the same story found by two different
          // searches collapses into one entry.
          id: `gnews-${link}`,
          title,
          url: link,
          source: String(sourceName),
          category,
          severity: scoreSeverity(title),
          publishedAt: pubDate.toISOString(),
        };
      })
      // Google News matches loosely - a "church shooting" search returns
      // school shootings and unrelated road accidents. Same verification
      // the GDELT path uses.
      .filter((inc) => isRelevant(inc.category, inc.title));
  } catch (err) {
    console.error(`Google News search errored [${q}]:`, err);
    return [];
  }
}

export async function fetchAllGoogleNews(): Promise<Incident[]> {
  const results = await Promise.allSettled(
    SEARCHES.map(
      (s, i) =>
        new Promise<Incident[]>((resolve) => {
          // Light stagger so we're not firing 20 requests simultaneously.
          setTimeout(() => runSearch(s.category, s.q).then(resolve), i * 120);
        })
    )
  );

  const incidents: Incident[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") incidents.push(...r.value);
  }
  return incidents;
}
