import type { Meta } from "./cinemeta";
import { releaseText, releaseYear } from "./release-info";

export type RecommendationItem = {
  title: string;
  year?: number;
  type?: "movie" | "series";
  reason?: string;
  isReleased?: boolean;
  releaseDate?: string;
  runtime?: string;
};

export function validReleaseDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value
    ? value
    : undefined;
}

export function extractRecommendations(raw: string): {
  cleanText: string;
  items: RecommendationItem[];
} {
  let cleanText = raw.trim();
  const items: RecommendationItem[] = [];
  const seen = new Set<string>();
  for (const match of raw.matchAll(/```(recommendations|json)\s*([\s\S]*?)```/gi)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(match[2]);
    } catch {
      // Hide a broken catalog handoff, but preserve unrelated JSON examples.
      if (match[1].toLowerCase() === "recommendations") cleanText = cleanText.replace(match[0], "");
      continue;
    }
    if (!Array.isArray(parsed)) continue;
    const recommendations = parsed.filter(
      (item): item is Record<string, unknown> =>
        item != null && typeof item === "object" && typeof item.title === "string",
    );
    if (match[1].toLowerCase() !== "recommendations" && !recommendations.length) continue;
    cleanText = cleanText.replace(match[0], "");
    for (const item of recommendations) {
      const title = String(item.title).trim();
      if (!title || title.length > 200 || items.length >= 30) continue;
      if (item.type !== "movie" && item.type !== "series") continue;
      if (
        typeof item.year !== "number" ||
        !Number.isInteger(item.year) ||
        item.year < 1880 ||
        item.year > 2200
      )
        continue;
      const identity = `${title.toLowerCase()}:${item.year}:${item.type}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      items.push({
        title,
        year: item.year,
        type: item.type,
        reason: typeof item.reason === "string" ? item.reason.trim().slice(0, 600) : undefined,
        isReleased: typeof item.isReleased === "boolean" ? item.isReleased : undefined,
        releaseDate: validReleaseDate(item.releaseDate),
        runtime:
          typeof item.runtime === "string" && /^\d{1,4} min$/.test(item.runtime)
            ? item.runtime
            : undefined,
      });
    }
  }
  return { cleanText: cleanText.trim(), items };
}

export type RecommendationMatch = {
  title: string;
  year?: number;
  type?: "movie" | "series";
};

export function recommendationReleaseFallback(
  item: { isReleased?: boolean; releaseDate?: string; year?: number },
  currentYear: number,
  now: number,
): boolean | undefined {
  const date = validReleaseDate(item.releaseDate?.trim());
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const timestamp = Date.parse(date);
    if (!Number.isNaN(timestamp)) return timestamp <= now;
  }
  if (item.year && item.year > currentYear) return false;
  if (item.year && item.year < currentYear) return true;

  // In the current year, the model's verdict is the fallback unless the catalog
  // provides an exact premiere date or a previous-year release.
  return item.isReleased;
}

export function normalizeRecommendationTitle(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/\s*\(\s*\d{4}\s*\)/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function titleScore(candidate: string, requested: string): number {
  const candidateName = normalizeRecommendationTitle(candidate);
  const requestedName = normalizeRecommendationTitle(requested);
  if (!candidateName || !requestedName) return 0;
  if (candidateName === requestedName) return 100;

  const shorterLength = Math.min(candidateName.length, requestedName.length);
  const longerLength = Math.max(candidateName.length, requestedName.length);
  if (
    shorterLength >= 6 &&
    shorterLength / longerLength >= 0.75 &&
    (candidateName.includes(requestedName) || requestedName.includes(candidateName))
  ) {
    return 70;
  }
  return 0;
}

function catalogYears(meta: Meta): number[] {
  const dateYear = releaseYear(meta.releaseDate);
  if (Number.isFinite(dateYear)) return [dateYear];

  const text = releaseText(meta.releaseInfo);
  const years = [...text.matchAll(/(?:19|20|21)\d{2}/g)].map((match) => Number(match[0]));
  // Series ranges describe their run, but title identity uses the premiere year.
  return years.length ? [years[0]] : [];
}

export function pickRecommendationMatch<T extends Meta>(
  pool: T[],
  suggestion: RecommendationMatch,
): T | null {
  let best: T | null = null;
  let bestScore = 0;

  for (const meta of pool) {
    if (suggestion.type && meta.type !== suggestion.type) continue;
    const score = titleScore(meta.name, suggestion.title);
    if (!score) continue;

    const years = catalogYears(meta);
    if (suggestion.year && (!years.length || !years.includes(suggestion.year))) continue;

    const total = score + (suggestion.year && years.includes(suggestion.year) ? 30 : 0);
    if (total > bestScore) {
      best = meta;
      bestScore = total;
    }
  }

  return best;
}

export function catalogReleaseVerdict(
  meta: Meta,
  now: number,
  currentYear: number,
): { isReleased?: boolean; releaseDate?: string } {
  const fullDate = validReleaseDate(
    meta.releaseDate?.trim() || releaseText(meta.releaseInfo).match(/^\d{4}-\d{2}-\d{2}/)?.[0],
  );
  if (fullDate && /^\d{4}-\d{2}-\d{2}$/.test(fullDate)) {
    const parsed = Date.parse(fullDate);
    if (!Number.isNaN(parsed)) {
      const iso = new Date(parsed).toISOString().slice(0, 10);
      return parsed <= now
        ? { isReleased: true, releaseDate: iso }
        : { isReleased: false, releaseDate: iso };
    }
  }

  const years = catalogYears(meta);
  if (years.length > 0) {
    const latestYear = Math.max(...years);
    if (latestYear < currentYear) return { isReleased: true };
    if (latestYear > currentYear) return { isReleased: false };
  }
  if (meta.inTheaters === true) return { isReleased: true };
  return {};
}

export function recommendationReleaseInfo(meta: Meta, fallbackYear?: number): string | undefined {
  const date = meta.releaseDate?.trim();
  if (date && /^\d{4}-\d{2}-\d{2}/.test(date)) return date.slice(0, 4);

  const years = catalogYears(meta);
  if (fallbackYear && years.includes(fallbackYear)) return String(fallbackYear);
  if (years.length > 0) return String(Math.max(...years));
  return fallbackYear ? String(fallbackYear) : releaseText(meta.releaseInfo) || undefined;
}
