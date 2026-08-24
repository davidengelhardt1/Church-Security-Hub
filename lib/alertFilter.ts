import { Incident } from "./types";

/**
 * Alerting uses a STRICTER bar than the dashboard.
 *
 * The board can afford loose relevance - a human scans it and ignores what
 * doesn't apply. An alert interrupts someone, so a false alarm is expensive.
 * Two filters run here that deliberately do not run on the board:
 *
 *   1. isAlertWorthy()  - drops aftermath coverage, commentary, historical
 *                         references, and court follow-ups.
 *   2. dedupeEvents()   - collapses many headlines about ONE incident. A
 *                         single church shooting can produce a dozen wire
 *                         and local stories; the team needs one alert.
 */

// Community response and remembrance. The church is the subject, but no
// incident occurred there - e.g. "Church to offer counseling after HS
// shooting", "carnival brings community together after mass shooting".
const AFTERMATH =
  /\b(counsel|vigil|memorial|tribute|mourn|remembers?|remembrance|honou?rs?|healing|unity event|carnival|fundrais|benefit concert|prayer service|comes together|support after|reflects? on|anniversary|years (later|ago)|legacy)\b/i;

// "Church responds to..." is aftermath; "Police respond to..." is an active
// incident. Only the former should be filtered out.
const CONGREGATION_RESPONSE =
  /\b(church|congregation|parish|community|leaders?|pastor|diocese)\s+\w*\s*responds?\b/i;

// Opinion, explainer, and reference material rather than incident reporting.
const COMMENTARY =
  /(\b(statement on|opinion|editorial|commentary|analysis|explainer|what we know|what to know|timeline|wasn't an isolated|op-?ed|column|review)\b|^(why|how|inside|remembering|revisiting)\b)/i;

// Court and prosecution follow-ups. Relevant history, not an active threat.
// Note: "arrested" is deliberately NOT here - an arrest for a *planned*
// attack is exactly what a security team wants to know about.
const JUDICIAL =
  /\b(jailed|sentenc|convict|pleads?|plea deal|charges dropped|acquitt|trial begins|lawsuit|sues?|appeal|parole|verdict)\b/i;

// The incident happened at a school/campus; a church is mentioned only
// incidentally (as a counseling site, venue, or neighbour).
const SCHOOL_CONTEXT =
  /\b(high school|middle school|elementary|\bHS\b|university|college|campus|students?)\b/i;

// Wikipedia-style reference entries, e.g. "Charleston church shooting |
// Mother Emanuel, Dylann Roof, White Supremacy, & Hate Crimes".
const REFERENCE_ENTRY = /\|.*(,|&)/;

// Bare historical entries with no reported action - "16th Street Baptist
// Church bombing". Real incident reporting names a place, a victim count,
// or an actor; a naked noun phrase is almost always an archive page.
const BARE_REFERENCE =
  /^[\w\s'-]{0,60}(bombing|shooting|massacre|attack|riot)s?$/i;

// Repackaged footage rather than new reporting.
const FOOTAGE = /\b(video|footage|watch|photos|images|caught on camera)\b/i;

// Headlines arrive with typographic quotes and dashes; normalize so the
// patterns above match regardless of which the publisher used.
function normalize(title: string): string {
  return title
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-");
}

export function isAlertWorthy(raw: string): boolean {
  if (!raw) return false;
  const title = normalize(raw);
  if (AFTERMATH.test(title)) return false;
  if (CONGREGATION_RESPONSE.test(title)) return false;
  if (COMMENTARY.test(title)) return false;
  if (JUDICIAL.test(title)) return false;
  if (SCHOOL_CONTEXT.test(title)) return false;
  if (REFERENCE_ENTRY.test(title)) return false;
  if (BARE_REFERENCE.test(title.trim())) return false;
  if (FOOTAGE.test(title)) return false;
  return true;
}

// Words too common to identify an event.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "in", "at", "on", "to", "for", "after",
  "before", "with", "from", "by", "as", "is", "was", "are", "were", "be",
  "been", "man", "woman", "men", "police", "say", "says", "said", "new", "one",
  "two", "three", "news", "report", "reports", "official", "officials", "video",
  "photos", "update", "updated", "live", "breaking", "local", "amid", "over",
  "into", "out", "near", "during", "who", "what", "when", "where", "why", "how",
  "church", "churches", "mosque", "synagogue", "temple", "shooting", "attack",
]);

function signatureTokens(title: string): Set<string> {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
  return new Set(words);
}

// Capitalized words that aren't sentence-initial and aren't generic - these
// are usually place or congregation names (Kearns, Columbus, Broward,
// Bushwick) and are the strongest signal that two headlines describe the
// same incident.
const GENERIC_CAPS = new Set([
  "Church", "Churches", "Mosque", "Synagogue", "Temple", "Police", "Man",
  "Woman", "Video", "Records", "Court", "News", "Former", "Ex", "Federal",
  "Baptist", "Catholic", "Presbyterian", "Christian", "Jewish", "Muslim",
  "Society", "Community", "Council", "American", "African", "Street",
  "County", "City", "State", "Fire", "Marshal", "Law", "Suspect", "Father",
  "Twin", "One", "Two", "Three", "Charges", "Data", "Inside", "Scores",
]);

function properNouns(title: string): Set<string> {
  const words = title.split(/\s+/);
  const found = new Set<string>();
  // Skip index 0 - the first word is capitalized by convention.
  for (let i = 1; i < words.length; i++) {
    const w = words[i].replace(/[^A-Za-z]/g, "");
    if (w.length > 3 && /^[A-Z][a-z]+$/.test(w) && !GENERIC_CAPS.has(w)) {
      found.add(w.toLowerCase());
    }
  }
  return found;
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  // Compare against the smaller set: a short headline and a long one about
  // the same event should still register as similar.
  return shared / Math.min(a.size, b.size);
}

function sharesPlace(a: Set<string>, b: Set<string>): boolean {
  for (const w of a) if (b.has(w)) return true;
  return false;
}

/**
 * Collapses multiple headlines covering the same incident.
 *
 * Two headlines are treated as one event if they either share enough
 * distinctive vocabulary OR name the same place. The place check does the
 * heavy lifting: seven stories about the Kearns church funeral shooting
 * share little wording but all say "Kearns".
 *
 * This errs toward over-merging. For alerting that's the right trade - the
 * team gets one notification and can open the board for the full picture,
 * which is much better than seven texts about one shooting.
 */
export function dedupeEvents(incidents: Incident[], threshold = 0.4): Incident[] {
  const kept: { incident: Incident; tokens: Set<string>; places: Set<string> }[] = [];

  for (const inc of incidents) {
    const tokens = signatureTokens(inc.title);
    const places = properNouns(inc.title);

    const duplicate = kept.some(
      (k) =>
        k.incident.category === inc.category &&
        (overlap(tokens, k.tokens) >= threshold || sharesPlace(places, k.places))
    );

    if (!duplicate) kept.push({ incident: inc, tokens, places });
  }

  return kept.map((k) => k.incident);
}
