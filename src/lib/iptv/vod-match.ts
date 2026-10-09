import { normalizeArabic } from "./rtl";

export function vodSearchText(value: string): string {
  // Fold Latin accents only; stripping every mark changes other scripts' letters.
  return normalizeArabic(value)
    .replace(/[\p{Script=Latin}][\p{M}]*/gu, (letter) =>
      letter.normalize("NFD").replace(/\p{M}/gu, ""),
    )
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .trim();
}

export function matchesVodSearch(index: string, query: string): boolean {
  return query
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => index.includes(word));
}

type TitleHit = {
  id?: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
};

/** Search ranking alone is not a title identity. Preserve provider data on ambiguity. */
export function matchVodMetadata<T extends TitleHit>(
  hits: readonly T[],
  title: string,
  year: number | null,
): T | null {
  const wanted = vodSearchText(title);
  if (!wanted) return null;
  const candidates = hits.filter((hit) => {
    if (!Number.isSafeInteger(hit.id) || !(hit.id! > 0)) return false;
    const names = [hit.title, hit.name, hit.original_title, hit.original_name];
    if (!names.some((name) => name && vodSearchText(name) === wanted)) return false;
    const date = hit.release_date || hit.first_air_date || "";
    return year == null || Number(date.slice(0, 4)) === year;
  });
  const unique = new Map(candidates.map((hit) => [hit.id, hit]));
  return unique.size === 1 ? [...unique.values()][0] : null;
}
