// Run with:  npm run test:dedupe
// Bundles the real TypeScript modules so this tests shipping code, not a copy.
import { titleKey, selectNewIncidents, dedupeWindowMs } from '../.test-build/dedupe.mjs';
import { dedupeEvents } from '../.test-build/alertFilter.mjs';

let failures = 0;
function check(label, condition) {
  if (!condition) { console.error(`FAIL: ${label}`); failures++; }
  else console.log(`pass: ${label}`);
}

const DAY = 86400000;
const t0 = Date.parse('2026-10-01T12:00:00Z');
const at = (days) => new Date(t0 + days * DAY).toISOString();
let n = 0;
const inc = (title, days, over = {}) => ({
  id: `id-${n++}`,
  title,
  url: `https://example.com/${n}`,
  source: over.source ?? `outlet-${n}`,
  category: over.category ?? 'physical',
  severity: over.severity ?? 'high',
  publishedAt: at(days),
});

console.log('--- titleKey ---');
check('typographic and straight apostrophes match',
  titleKey("‘God is good’ – survivor of church robbery") ===
  titleKey("'God is good' - survivor of church robbery"));
check('case and spacing are normalized',
  titleKey('  Man   ARRESTED after Church burglary ') === 'man arrested after church burglary');

console.log('\n--- syndication within one batch ---');
{
  const batch = [
    inc('Winchester man facing charges after scene at church', 2, { source: 'C' }),
    inc('Winchester man facing charges after scene at church', 0, { source: 'A' }),
    inc('Winchester man facing charges after scene at church', 1, { source: 'B' }),
    inc('Unrelated church burglary in Dayton', 1),
  ];
  const { fresh, skipped } = selectNewIncidents(batch, []);
  check('three outlets collapse to one row', fresh.filter(i => i.title.startsWith('Winchester')).length === 1);
  check('earliest-published copy is the one kept',
    fresh.find(i => i.title.startsWith('Winchester')).source === 'A');
  check('unrelated story untouched', fresh.some(i => i.title.includes('Dayton')));
  check('skipped count reported', skipped === 2);
}

console.log('\n--- against already-stored rows ---');
{
  const known = [{ category: 'physical', titleKey: 'church arson in dayton', publishedAt: at(0) }];
  check('same headline 3 days later is a copy',
    selectNewIncidents([inc('Church arson in Dayton', 3)], known).fresh.length === 0);
  check('same headline 13 days later is still a copy',
    selectNewIncidents([inc('Church arson in Dayton', 13)], known).fresh.length === 0);
  check('same headline 20 days later is a new event',
    selectNewIncidents([inc('Church arson in Dayton', 20)], known).fresh.length === 1);
  check('same headline in another category is not a copy',
    selectNewIncidents([inc('Church arson in Dayton', 1, { category: 'extremism' })], known).fresh.length === 1);
}

console.log('\n--- cyber advisories reuse titles for different bulletins ---');
{
  check('news window is 14 days, cyber window is 1 day',
    dedupeWindowMs('physical') === 14 * DAY && dedupeWindowMs('cyber') === DAY);
  const known = [{ category: 'cyber', titleKey: 'multiple vulnerabilities in google chrome', publishedAt: at(0) }];
  const title = 'Multiple Vulnerabilities in Google Chrome';
  check('republished advisory with identical timestamp is a copy',
    selectNewIncidents([inc(title, 0, { category: 'cyber' })], known).fresh.length === 0);
  check('genuinely new advisory days later is kept',
    selectNewIncidents([inc(title, 5, { category: 'cyber' })], known).fresh.length === 1);
}

console.log('\n--- cross-run alert dedupe ---');
{
  const sent = [inc('Twin teen brothers struck in Kearns church shooting', -1)];
  const todays = [
    inc('One dead, two injured in shooting outside LDS church in Kearns', 0),
    inc('Arson investigation underway after church fire in Amarillo', 0),
  ];
  const out = dedupeEvents(todays, 0.4, sent);
  check('re-report of an already-alerted event is suppressed', !out.some(i => i.title.includes('Kearns')));
  check('unrelated incident still alerts', out.some(i => i.title.includes('Amarillo')));
  check('prior alerts are never returned as new', out.length === 1);
  check('without prior context behavior is unchanged (both kept)', dedupeEvents(todays).length === 2);
  check('a different category is not suppressed by a prior alert',
    dedupeEvents([inc('Kearns church ransomware', 0, { category: 'cyber' })], 0.4, sent).length === 1);
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
