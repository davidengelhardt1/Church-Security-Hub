// Run with:  npm run test:alerts
// Bundles the real TypeScript module so this tests shipping code, not a copy.
import { isAlertWorthy, dedupeEvents } from '../.test-build/alertFilter.mjs';

const titles = [
"Ohio Jewish Caucus Statement on Deadly Attack at San Diego Mosque",
"Scores of people kidnapped from a mosque as armed groups attacked multiple villages in Nigeria - ABC News",
"Discovery Church to offer counseling Aug. 26 for students after Independence HS shooting",
"Shiloh Baptist Church carnival brings East End community together after mass shooting",
"Inside the bedroom of a little boy killed in the Minneapolis Annunciation church shooting",
"Arson investigation underway by Amarillo Fire Marshal following Thursday church fire",
"Law enforcement responds to overnight shooting at church in Black Jack",
"St Joseph's Church stabbing: Priest's attacker jailed 4 years, 3 months and caned, Singapore News",
"Birmingham church bombing wasn\u2019t an isolated act of terrorism \u2013 there were dozens of attacks on Black houses of worship during the Civil Rights Movement",
"Twin teen brothers both struck in Kearns church shooting \u2014 one killed, the other hospitalized, family says",
"Man arrested for attempted murder after stabbing outside Putney church",
"Why police tipped off of potential 'problems' before shooting didn't notify church leaders",
"Suspect charged in drive-by shooting outside northeast Columbus church",
"Father arrested after allegedly providing gun to teen during Kearns church shooting",
"Court documents reveal possible link to shooting outside east Columbus church",
"Video from inside church shows panic, chaos after deadly funeral shooting",
"Records: Man possibly connected to shooting outside Columbus church arrested after fleeing traffic stop",
"Charges dropped against Hudson man in St. Croix County church bomb threat case",
"One dead, two injured in shooting outside LDS church in Kearns",
"Police investigate possible gang connection in deadly shooting outside church funeral in Kearns",
"One person killed, two critically injured after shooting outside funeral at Kearns church",
"Police: 2 injured following drive-by shooting outside northeast Columbus church during funeral",
"1 killed, 2 injured in Kearns church funeral shooting",
"Jennings Community Church provides support after Missaukee County shooting",
"North Texans remember dedicated church volunteer killed in Fort Worth road rage shooting",
"Society News | Former Teacher Arrested Over Bomb Threat to Florida Megachurch",
"Church to hold prayer vigil for victims of Winfield shooting",
"Woman accused of shooting at car leaving Mississippi church",
"Former teacher arrested after sending bomb threat to Coral Ridge Presbyterian Church",
"Venice teen arrested after FDLE says he planned mass shooting, hostage-taking at local church",
"Data breach causes alarm for charities and churches",
"Venice man planned mass shooting at church, wanted to attack mosque: FDLE",
"Former teacher and choir member accused of emailing bomb threat to Broward church, police say - CBS Miami",
"Ex-choir member accused of emailing bomb threat to Broward church",
"Ex-teacher accused of threatening to bomb church in Fort Lauderdale",
"Ex-Choir Member Accused of Threatening to Bomb Fort Lauderdale Church",
"African American Church Council hosts unity event after Ruiz shooting",
"16th Street Baptist Church bombing",
"Federal charges filed against suspected arsonist in Brooklyn church fire",
"Brooklyn church arson suspect kept journal filled with violent threats, prosecutors say in call for detention",
"Church Point police seek suspect after shooting, armed robbery attempt",
"Brooklyn man arrested in arson that burned down South Bushwick Reformed Church",
"Brooklyn man charged with arson in destructive blaze at historic Bushwick church",
"Las Cruces man accused of shooting at Catholic church faces federal charge",
"Charleston church shooting | Mother Emanuel, Dylann Roof, White Supremacy, & Hate Crimes",
];

// Titles below are real headlines pulled from the live database.
// They cover the failure modes this filter exists to prevent:
//   - churches responding to shootings elsewhere (counseling, vigils)
//   - historical/reference entries
//   - court follow-ups
//   - many headlines about a single incident (Kearns x7, Columbus x4)

const worthy = titles.filter(isAlertWorthy);
console.log(`STEP 1 alert-worthy: ${worthy.length}/${titles.length}\n`);
console.log("REJECTED:");
titles.filter(t=>!isAlertWorthy(t)).forEach(t=>console.log("  x " + t.slice(0,86)));

const incidents = worthy.map((t,i)=>({id:String(i), title:t, category:'physical'}));
const final = dedupeEvents(incidents);
console.log(`\nSTEP 2 after event dedupe: ${final.length} (from ${worthy.length})\n`);
console.log("WOULD ALERT (top 8 = one cron run):");
final.slice(0,8).forEach(x=>console.log("  > " + x.title.slice(0,86)));
console.log("\n-- remaining after top 8 --");
final.slice(8).forEach(x=>console.log("    " + x.title.slice(0,86)));


// --- assertions ---------------------------------------------------------
let failures = 0;
function check(label, condition) {
  if (!condition) { console.error(`FAIL: ${label}`); failures++; }
  else console.log(`pass: ${label}`);
}

console.log("\n--- assertions ---");
const finalTitles = final.map(x => x.title);

check("aftermath (counseling for HS shooting) excluded",
  !worthy.some(t => t.includes("offer counseling")));
check("community carnival excluded",
  !worthy.some(t => t.includes("carnival")));
check("prayer vigil excluded",
  !worthy.some(t => t.includes("prayer vigil")));
check("court follow-up (charges dropped) excluded",
  !worthy.some(t => t.includes("Charges dropped")));
check("historical reference (16th Street) excluded",
  !worthy.some(t => t.startsWith("16th Street")));
check("Kearns funeral shooting collapses to one alert",
  finalTitles.filter(t => t.includes("Kearns")).length === 1);
check("Columbus church shooting collapses to one alert",
  finalTitles.filter(t => t.includes("Columbus")).length === 1);
check("genuine incident (Nigeria mosque kidnapping) retained",
  finalTitles.some(t => t.includes("kidnapped from a mosque")));
check("genuine incident (Amarillo church arson) retained",
  finalTitles.some(t => t.includes("Amarillo")));
check("active police response retained",
  finalTitles.some(t => t.includes("Black Jack")));

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 1 && 0 : 1);
