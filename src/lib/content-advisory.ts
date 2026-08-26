import type { ParentalCategory } from "@/lib/providers/harbor-imdb";

export type AdvisorySeverity = "Mild" | "Moderate" | "Severe";

export type NormalizedAdvisory = ParentalCategory & {
  severity: AdvisorySeverity;
};

const SEVERITY_RANK: Record<AdvisorySeverity, number> = {
  Mild: 1,
  Moderate: 2,
  Severe: 3,
};

const NORMALIZED_SEVERITIES: Record<string, AdvisorySeverity | undefined> = {
  mild: "Mild",
  moderate: "Moderate",
  severe: "Severe",
};

export function normalizeAdvisorySeverity(value: string): AdvisorySeverity | null {
  return NORMALIZED_SEVERITIES[value.trim().toLowerCase()] ?? null;
}

export function advisorySeverityRank(value: string): number {
  const severity = normalizeAdvisorySeverity(value);
  return severity ? SEVERITY_RANK[severity] : 0;
}

export function normalizeContentAdvisories(categories: ParentalCategory[]): NormalizedAdvisory[] {
  return categories
    .map((category) => {
      const severity = normalizeAdvisorySeverity(category.severity);
      return severity ? { ...category, severity } : null;
    })
    .filter((category): category is NormalizedAdvisory => category !== null)
    .sort((a, b) => advisorySeverityRank(b.severity) - advisorySeverityRank(a.severity));
}

export function advisoryCategoryLabel(category: string): string {
  const normalized = category.trim().toLowerCase();
  if (normalized.includes("sex") || normalized.includes("nudity")) return "Sex & Nudity";
  if (normalized.includes("violence") || normalized.includes("gore")) return "Violence";
  if (normalized.includes("profanity")) return "Profanity";
  if (normalized.includes("alcohol") || normalized.includes("drug") || normalized.includes("smoking")) {
    return "Alcohol & Drugs";
  }
  if (normalized.includes("frighten") || normalized.includes("intense")) return "Frightening";
  return category;
}

export function parseImdbParentsGuideResponse(value: unknown): ParentalCategory[] {
  if (!value || typeof value !== "object") return [];
  const data = (value as { data?: unknown }).data;
  if (!data || typeof data !== "object") return [];
  const title = (data as { title?: unknown }).title;
  if (!title || typeof title !== "object") return [];
  const guide = (title as { parentsGuide?: unknown }).parentsGuide;
  if (!guide || typeof guide !== "object") return [];
  const categories = (guide as { categories?: unknown }).categories;
  if (!Array.isArray(categories)) return [];

  const out: ParentalCategory[] = [];
  for (const item of categories) {
    if (!item || typeof item !== "object") continue;
    const categoryNode = (item as { category?: unknown }).category;
    const severityNode = (item as { severity?: unknown }).severity;
    if (!categoryNode || typeof categoryNode !== "object") continue;
    if (!severityNode || typeof severityNode !== "object") continue;
    const category = (categoryNode as { text?: unknown }).text;
    const severity = (severityNode as { text?: unknown }).text;
    if (typeof category === "string" && typeof severity === "string") {
      out.push({ category, severity });
    }
  }
  return out;
}
