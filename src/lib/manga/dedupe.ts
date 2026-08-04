import type { MangaSummary } from "./model";

export type GroupedMangaSummary = MangaSummary & { variantIds: string[] };

export function mangaTitleKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}\p{Z}\s]+/gu, "");
}

function titleKeys(item: MangaSummary): string[] {
  const keys = [mangaTitleKey(item.title)];
  if (item.altTitle) keys.push(mangaTitleKey(item.altTitle));
  return [...new Set(keys.filter(Boolean))];
}

export function collapseMangaDuplicates(items: MangaSummary[]): GroupedMangaSummary[] {
  const grouped: GroupedMangaSummary[] = [];
  const groupByTitle = new Map<string, number>();

  for (const item of items) {
    const keys = titleKeys(item);
    const existing = keys
      .map((key) => groupByTitle.get(key))
      .find((index): index is number => index != null);
    const variants =
      "variantIds" in item && Array.isArray(item.variantIds) ? item.variantIds : [item.id];

    if (existing == null) {
      const index = grouped.length;
      grouped.push({ ...item, variantIds: [...new Set(variants)] });
      for (const key of keys) groupByTitle.set(key, index);
      continue;
    }

    const current = grouped[existing];
    current.variantIds = [...new Set([...current.variantIds, ...variants])];
    for (const key of keys) groupByTitle.set(key, existing);
  }

  return grouped;
}
