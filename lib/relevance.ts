import { Category } from "./types";

// Shared relevance verification for ALL news sources.
//
// Both GDELT and Google News return loosely-matched results - a search for
// "church shooting" will happily return school shootings and unrelated road
// accidents. Upstream results are therefore treated as a candidate pool
// only: every title must independently match both a religious-context term
// AND a category-appropriate incident term before it reaches the board.
//
// This lives in its own module so a source can't silently skip the check.

export const RELIGIOUS_CONTEXT =
  /church|synagogue|mosque|temple|gurdwara|parish|congregation|diocese|clergy|pastor|rabbi|imam|priest|worship|cathedral|chapel|ministry|basilica|abbey|christian|catholic|jewish|muslim|islamic|faith community/i;

// Deliberately broad - a security team wants break-ins and vandalism on
// their radar, not only life-threatening violence.
export const PHYSICAL_TERMS =
  /shooting|shooter|gunman|gunfire|stabbing|stabbed|attack|bomb|explosive|arson|hostage|killed|fatal|assault|break-?in|burglar|robbery|robbed|theft|stolen|vandal|threat|weapon|gun|knife|evacuat|lockdown|intruder|abduct|kidnap|desecrat|fire/i;

export const EXTREMISM_ACTION =
  /attack|vandal|threat|plot|arrest|charged|stabbing|assault|bomb|shooting|arson|desecrat|graffiti|target/i;

export const EXTREMISM_BIAS =
  /hate crime|hate|antisemit|anti-jewish|islamophob|anti-muslim|white supremac|neo-nazi|extremist|domestic terrorism|terrorist|far-right|swastika|bigotry/i;

// Cyber stays scoped to churches/faith nonprofits, not general vendor CVEs -
// the CIS/MS-ISAC advisory feed covers those separately.
export const CYBER_TERMS =
  /cyberattack|cyber attack|ransomware|data breach|hacked|hacking|phishing|breach|fraud|scam|cybercrime|compromised|spoofed|business email compromise|embezzl/i;

// Titles that match a topic keyword but clearly aren't house-of-worship
// incidents. Checked first, so these are rejected regardless of category.
const EXCLUSIONS =
  /school shooting|university shooting|college shooting|road (crash|accident)|car crash|traffic collision|movie|film review|box office|album|concert review|obituary/i;

export function isRelevant(category: Category, title: string): boolean {
  if (!title) return false;
  if (EXCLUSIONS.test(title)) return false;

  switch (category) {
    case "physical":
      return RELIGIOUS_CONTEXT.test(title) && PHYSICAL_TERMS.test(title);
    case "extremism":
      // Extremism additionally requires religious context so that generic
      // hate-crime coverage doesn't flood a church security board.
      return (
        RELIGIOUS_CONTEXT.test(title) &&
        EXTREMISM_BIAS.test(title) &&
        EXTREMISM_ACTION.test(title)
      );
    case "cyber":
      return RELIGIOUS_CONTEXT.test(title) && CYBER_TERMS.test(title);
  }
}
