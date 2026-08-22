import { Incident, Category } from "./types";
import { scoreSeverity } from "./classify";

const GDELT_ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc";

interface GdeltArticle {
  url: string;
  title: string;
  seendate: string; // e.g. 20260821T120000Z
  domain: string;
  sourcecountry?: string;
}

// One query per category. Keep queries tight (GDELT's boolean syntax is picky
// about parens/quotes) so results stay relevant instead of flooding with noise.
const QUERIES: { category: Category; query: string }[] = [
  {
    category: "violence",
    query:
      '(church OR synagogue OR mosque OR "house of worship" OR "place of worship" OR temple) (shooting OR gunman OR stabbing OR "bomb threat" OR attack OR shooter)',
  },
  {
    category: "extremism",
    query:
      '("hate crime" OR extremist OR "white supremacist" OR antisemitic OR islamophobic OR "domestic terrorism") (church OR synagogue OR mosque OR "religious site" OR congregation)',
  },
  {
    category: "cyber",
    query:
      '(church OR nonprofit OR diocese OR congregation OR "religious organization") (cyberattack OR ransomware OR "data breach" OR hacked OR phishing)',
  },
];

function parseGdeltDate(seendate: string): string {
  // Format: YYYYMMDDTHHMMSSZ
  const m = seendate.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return new Date().toISOString();
  const [, y, mo, d, h, mi, s] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)).toISOString();
}

export async function fetchGdeltCategory(
  category: Category,
  query: string,
  timespan = "3d",
  maxrecords = 40
): Promise<Incident[]> {
  const params = new URLSearchParams({
    query,
    mode: "artlist",
    format: "json",
    maxrecords: String(maxrecords),
    sort: "datedesc",
    timespan,
  });

  const res = await fetch(`${GDELT_ENDPOINT}?${params.toString()}`, {
    headers: { "User-Agent": "church-security-watch/0.1" },
    // GDELT can be slow; give it room but don't hang the whole ingest
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`GDELT ${category} query failed: ${res.status}`);
  }

  const text = await res.text();
  let data: { articles?: GdeltArticle[] };
  try {
    data = JSON.parse(text);
  } catch {
    // GDELT occasionally returns HTML error pages instead of JSON
    return [];
  }

  const articles = data.articles ?? [];
  return articles.map((a) => {
    const publishedAt = parseGdeltDate(a.seendate);
    return {
      id: `gdelt-${a.url}`,
      title: a.title,
      url: a.url,
      source: a.domain,
      category,
      severity: scoreSeverity(a.title),
      country: a.sourcecountry,
      publishedAt,
    };
  });
}

export async function fetchAllGdelt(): Promise<Incident[]> {
  const results = await Promise.allSettled(
    QUERIES.map((q) => fetchGdeltCategory(q.category, q.query))
  );
  const incidents: Incident[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") incidents.push(...r.value);
  }
  return incidents;
}
