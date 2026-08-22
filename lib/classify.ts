import { Severity } from "./types";

const HIGH_SIGNALS = [
  "shooting", "shooter", "gunman", "gunfire", "killed", "dead", "fatal",
  "stabbing", "bomb", "explosive", "hostage", "active shooter",
  "mass casualty", "ransomware", "data breach", "exploited", "critical vulnerability",
  "arson", "terror", "armed", "hijack",
];

const MEDIUM_SIGNALS = [
  "threat", "threatened", "arrested", "vandalism", "vandalized", "assault",
  "hate crime", "swatting", "bomb threat", "phishing", "breach", "hacked",
  "compromised", "extremist", "white supremacist", "propaganda", "intimidation",
  "burglary", "break-in", "robbery", "robbed", "theft", "stolen", "evacuated",
  "lockdown", "intruder", "fraud", "scam", "disrupted",
];

const LOW_SIGNALS = [
  "warning", "advisory", "guidance", "awareness", "patch", "update",
  "investigation", "charged", "sentenced", "training", "drill",
];

export function scoreSeverity(text: string): Severity {
  const t = text.toLowerCase();
  if (HIGH_SIGNALS.some((s) => t.includes(s))) return "high";
  if (MEDIUM_SIGNALS.some((s) => t.includes(s))) return "medium";
  if (LOW_SIGNALS.some((s) => t.includes(s))) return "low";
  return "medium"; // default to medium so nothing gets buried
}
