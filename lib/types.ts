export type Category = "physical" | "extremism" | "cyber";
export type Severity = "high" | "medium" | "low";

export interface Incident {
  id: string;
  title: string;
  url: string;
  source: string;
  category: Category;
  severity: Severity;
  country?: string;
  publishedAt: string; // ISO string
  snippet?: string;
  // Populated by lib/geocode.ts matching the title against a local
  // gazetteer - see that file for why this isn't a live geocoding API call.
  locationName?: string;
  lat?: number;
  lng?: number;
}
