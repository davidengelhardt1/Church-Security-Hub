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
    category: "physical",
    query:
      '(church OR synagogue OR mosque OR "house of worship" OR "place of worship" OR temple OR cathedral OR chapel OR parish) (shooting OR gunman OR stabbing OR "bomb threat" OR attack OR shooter OR burglary OR "break-in" OR robbery OR theft OR stolen OR vandalism OR arson OR threat OR evacuated OR lockdown OR intruder)',
  },
  {
    category: "extremism",
    query:
      '("hate crime" OR extremist OR "white supremacist" OR antisemitic OR islamophobic OR "domestic terrorism" OR "neo-nazi") (church OR synagogue OR mosque OR "religious site" OR congregation OR temple OR gurdwara)',
  },
  {
    category: "cyber",
    query:
      '(church OR synagogue OR mosque OR parish OR diocese OR congregation OR "religious organization" OR nonprofit OR charity OR ministry) (cyberattack OR ransomware OR "data breach" OR hacked OR phishing OR fraud OR scam OR "wire fraud" OR breach OR cybercrime)',
  },
];

// GDELT's query parser doesn't reliably respect the AND-of-OR-groups we send
// (in practice it can drift toward generic trending news - Prince Harry
// stories were showing up under "cyber"). Rather than trust it, we treat
// GDELT as a rough candidate pool and re-verify relevance ourselves: each
// title must contain both a religious-site term AND a matching incident term.
const RELIGIOUS_CONTEXT =
  /church|synagogue|mosque|temple|gurdwara|parish|congregation|diocese|clergy|pastor|rabbi|imam|priest|worship|cathedral|chapel|ministry|faith community/i;

// Deliberately broad - this covers anything a security team would want on
// their radar, not just life-threatening violence: break-ins, theft, and
// vandalism are common and worth planning around too.
const PHYSICAL_TERMS =
  /shooting|shooter|gunman|gunfire|stabbing|stabbed|attack|bomb|explosive|arson|hostage|killed|fatal|assault|break-?in|burglar|robbery|robbed|theft|stolen|vandal|threat|weapon|gun|knife|evacuat|lockdown|intruder|disrupt|protest/i;

const EXTREMISM_ACTION =
  /attack|vandal|threat|plot|arrest|charged|stabbing|assault|bomb|shooting|arson|desecrat/i;
const EXTREMISM_BIAS =
  /hate crime|antisemit|islamophob|white supremac|neo-nazi|extremist|domestic terrorism|far-right|swastika/i;

// Cyber stays scoped to attacks/fraud that specifically target churches or
// religious nonprofits - not general vendor CVEs (that's what the dedicated
// advisory feed in feeds.ts is for).
const CYBER_TERMS =
  /cyberattack|ransomware|data breach|hacked|hacking|phishing|breach|fraud|scam|cybercrime|compromised|spoofed|business email compromise/i;

function isRelevant(category: Category, title: string): boolean {
  switch (category) {
    case "physical":
      return RELIGIOUS_CONTEXT.test(title) && PHYSICAL_TERMS.test(title);
    case "extremism":
      return EXTREMISM_ACTION.test(title) && EXTREMISM_BIAS.test(title);
    case "cyber":
      return RELIGIOUS_CONTEXT.test(title) && CYBER_TERMS.test(title);
  }
}

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
  timespan?: string,
  maxrecords = 75
): Promise<Incident[]> {
  const params = new URLSearchParams({
    query,
    mode: "artlist",
    format: "json",
    maxrecords: String(maxrecords),
    sort: "datedesc",
  });
  // Omit timespan entirely rather than pass a custom value - GDELT's own
  // documented default (last 3 months) is reliable; a hand-rolled value
  // like "90d" isn't guaranteed to parse the way we'd expect.
  if (timespan) params.set("timespan", timespan);

  const res = await fetch(`${GDELT_ENDPOINT}?${params.toString()}`, {
    headers: { "User-Agent": "church-security-watch/0.1" },
    // GDELT can be slow over a 3-month window; give it room but don't hang the whole ingest
    signal: AbortSignal.timeout(25000),
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
  return articles
    .filter((a) => isRelevant(category, a.title))
    .map((a) => {
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
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      incidents.push(...r.value);
    } else {
      // Log which category failed and why, instead of silently returning
      // nothing - a single bad query shouldn't be a mystery to debug later.
      console.error(`GDELT query failed for category "${QUERIES[i].category}":`, r.reason);
    }
  }
  return incidents;
}
