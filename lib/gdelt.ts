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
// IMPORTANT: GDELT rejects queries past a certain length with a bare
// "Your query was too short or too long" HTML page (not JSON), which reads
// downstream as "zero results." An earlier version of this file used long
// OR-lists here and silently returned nothing. Keep these SHORT.
const QUERIES: { category: Category; query: string }[] = [
  {
    category: "physical",
    query: '(church OR synagogue OR mosque) (shooting OR attack OR stabbing)',
  },
  {
    category: "extremism",
    query: '(church OR synagogue OR mosque) ("hate crime" OR extremist)',
  },
  {
    category: "cyber",
    query: '(church OR diocese OR nonprofit) (ransomware OR "data breach")',
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
  maxrecords = 50
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
    // GDELT appears to rate-limit or reject requests with non-browser
    // User-Agent strings (a custom identifier like the one this app used
    // before triggered empty/blocked responses in testing). A standard
    // browser UA avoids that.
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    },
    // GDELT can be slow over a 3-month window; give it room but don't hang the whole ingest
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    const bodySnippet = await res.text().catch(() => "");
    throw new Error(
      `GDELT ${category} query failed: ${res.status} ${res.statusText} — ${bodySnippet.slice(0, 200)}`
    );
  }

  const text = await res.text();
  let data: { articles?: GdeltArticle[] };
  try {
    data = JSON.parse(text);
  } catch {
    // GDELT occasionally returns HTML (error pages, rate-limit notices)
    // instead of JSON. Surface a snippet so this is diagnosable from logs
    // instead of silently looking like "zero relevant articles."
    console.error(
      `GDELT ${category} returned non-JSON response (likely rate-limited or errored): ${text.slice(0, 300)}`
    );
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
  // Stagger requests slightly rather than firing all 3 at once - gentler on
  // GDELT's rate limits, which matters more now that ingestion can be
  // triggered by both page loads and the cron job.
  const results = await Promise.allSettled(
    QUERIES.map(
      (q, i) =>
        new Promise<Incident[]>((resolve, reject) => {
          setTimeout(() => {
            fetchGdeltCategory(q.category, q.query).then(resolve, reject);
          }, i * 400);
        })
    )
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
