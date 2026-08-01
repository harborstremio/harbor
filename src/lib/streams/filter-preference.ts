import { isFilterEmpty, matchesCustomFilter, type CustomStreamFilter } from "./custom-filters.ts";
import type { ParsedStream } from "./types.ts";

export function resolveActiveStreamFilter(
  filters: readonly CustomStreamFilter[],
  activeId: string | null,
): CustomStreamFilter | null {
  if (!activeId) return null;
  const filter = filters.find((candidate) => candidate.id === activeId) ?? null;
  return filter && !isFilterEmpty(filter) ? filter : null;
}

export function applyActiveStreamFilterPreference<T extends ParsedStream>(
  streams: readonly T[],
  filter: CustomStreamFilter | null,
  bypass = false,
): { all: T[]; allRaw: T[]; fellBack: boolean } {
  const allRaw = [...streams];
  if (!filter || bypass) return { all: allRaw, allRaw, fellBack: false };
  const matched = allRaw.filter((stream) => matchesCustomFilter(stream, filter));
  return {
    all: matched.length > 0 ? matched : allRaw,
    allRaw,
    fellBack: matched.length === 0,
  };
}
