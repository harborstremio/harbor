import type { Meta } from "@/lib/cinemeta";

/** Pagination state for one catalog row. */
export type RowPageState = { page: number; hasMore: boolean };

/** Merge a fetched page into a row, dropping duplicate ids and capping length. */
export function mergeRowPage(current: Meta[], more: Meta[], maxPerRow: number): Meta[] {
  const ids = new Set(current.map((m) => m.id));
  const fresh = more.filter((m) => !ids.has(m.id));
  if (fresh.length === 0) return current;
  const combined = [...current, ...fresh];
  return combined.length > maxPerRow ? combined.slice(0, maxPerRow) : combined;
}

/**
 * Advance a row after a successful fetch: page numbers must really advance
 * (a row stuck reporting page 1 refetches page 2 forever).
 */
export function advanceRowPage(
  prev: RowPageState | undefined,
  fetchedCount: number,
  mergedCount: number,
  minVisible: number,
  maxPerRow: number,
): RowPageState {
  return {
    page: (prev?.page ?? 1) + 1,
    hasMore: fetchedCount >= minVisible && mergedCount < maxPerRow,
  };
}
