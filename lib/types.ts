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
}
