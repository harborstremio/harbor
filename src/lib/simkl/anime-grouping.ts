import type { SimklCacheItem } from "./activities";
import { simklRequest } from "./client";

export interface AnimeFranchise {
  key: string;
  name: string;
  simklIds: number[];
  items: SimklCacheItem[];
  bestTitle: string;
  yearStart: number | null;
  yearEnd: number | null;
  averageRating: number | null;
}

const SEASON_PATTERNS: RegExp[] = [
  /[.°'`:!?,_\-(\)[\]{}#]+$/,
  /\s+season\s*\d+$/i,
  /\s+s\d+$/i,
  /\s+\d+(st|nd|rd|th)\s+season$/i,
  /\s+part\s*\d+$/i,
  /\s+cour\s*\d+$/i,
  /\s+(ii|iii|iv|v|vi|vii|viii|ix|x)$/i,
  /\s+\d+(st|nd|rd|th)$/i,
  /\s+\d{4}$/,
  /\s+final\s+season$/i,
  /\s+the\s+final$/i,
  /\s+final$/i,
  /\s+shippuden$/i,
  /\s+gaiden$/i,
  /\s+side\s+story$/i,
  /\s+r\d?$/i,
  /\s+tv$/i,
  /\s+porori\s+hen$/i,
  /\s+enchousen$/i,
  /\s+hen$/i,
  /\s+season$/i,
  /\s*\(tv\)$/i,
  /\s*\(movie\)$/i,
  /\s*\(ova\)$/i,
  /\s*\[tv\]$/i,
  /\s*\[movie\]$/i,
  /\s*\[ova\]$/i,
];

export function normalizeAnimeTitle(title: string): string {
  let normalized = title.trim().toLowerCase().replace(/\s+/g, " ").trim();

  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of SEASON_PATTERNS) {
      if (pattern.test(normalized)) {
        normalized = normalized.replace(pattern, "").trim();
        changed = true;
      }
    }
  }

  if (normalized.includes(":")) {
    normalized = normalized.split(":")[0].trim();
  }

  return normalized.replace(/[^a-z0-9]/g, "");
}

interface SimklRelation {
  title?: string;
  en_title?: string | null;
  year?: number;
  anime_type?: string;
  relation_type?: string;
  is_direct?: boolean;
  ids?: {
    simkl_id?: number;
  };
}

interface SimklAnimeDetail {
  relations?: SimklRelation[];
}

const relationsCache = new Map<number, Set<number>>();
const relationsInFlight = new Map<number, Promise<Set<number>>>();

async function fetchRelations(
  simklId: number,
  type: "movie" | "show" | "anime",
): Promise<Set<number>> {
  if (relationsCache.has(simklId)) {
    return relationsCache.get(simklId)!;
  }
  if (relationsInFlight.has(simklId)) {
    return relationsInFlight.get(simklId)!;
  }

  const promise = (async () => {
    try {
      const endpoint = type === "movie" ? `/movies/${simklId}` : `/anime/${simklId}`;
      const detail = await simklRequest<SimklAnimeDetail>(endpoint, {
        method: "GET",
        authed: false,
      });
      const related = new Set<number>();
      if (detail.relations && Array.isArray(detail.relations)) {
        for (const rel of detail.relations) {
          if (rel.ids?.simkl_id && rel.is_direct !== false) {
            related.add(rel.ids.simkl_id);
          }
        }
      }
      relationsCache.set(simklId, related);
      return related;
    } catch {
      relationsCache.set(simklId, new Set());
      return new Set<number>();
    } finally {
      relationsInFlight.delete(simklId);
    }
  })();

  relationsInFlight.set(simklId, promise);
  return promise;
}

export function groupAnimeByFranchise(
  items: SimklCacheItem[],
  useRelationsApi = false,
): AnimeFranchise[] {
  void useRelationsApi;

  const titleGroups = new Map<string, SimklCacheItem[]>();

  for (const item of items) {
    const normalizedTitle = normalizeAnimeTitle(item.title);
    if (!normalizedTitle) continue;
    const group = titleGroups.get(normalizedTitle) ?? [];
    group.push(item);
    titleGroups.set(normalizedTitle, group);
  }

  const franchises: AnimeFranchise[] = [];

  for (const [normalizedTitle, groupItems] of titleGroups) {
    groupItems.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));

    const years = groupItems.map((i) => i.year).filter((y): y is number => y != null);
    const yearStart = years.length > 0 ? Math.min(...years) : null;
    const yearEnd = years.length > 0 ? Math.max(...years) : null;

    const bestTitle = groupItems
      .map((i) => i.title)
      .reduce((best, current) => (current.length < best.length ? current : best));

    franchises.push({
      key: normalizedTitle,
      name: bestTitle,
      simklIds: groupItems.map((i) => i.simklId),
      items: groupItems,
      bestTitle,
      yearStart,
      yearEnd,
      averageRating: null,
    });
  }

  franchises.sort((a, b) => a.name.localeCompare(b.name));

  return franchises;
}

export async function enhanceGroupsWithRelations(
  franchises: AnimeFranchise[],
  maxApiCalls = 50,
): Promise<AnimeFranchise[]> {
  if (franchises.length <= 1) return franchises;

  const simklIdToFranchise = new Map<number, number>();
  for (let i = 0; i < franchises.length; i++) {
    for (const simklId of franchises[i].simklIds) {
      simklIdToFranchise.set(simklId, i);
    }
  }

  const groupsToCheck = franchises.slice(0, maxApiCalls);
  const BATCH_SIZE = 10;
  const mergePairs: Array<[number, number]> = [];

  for (let i = 0; i < groupsToCheck.length; i += BATCH_SIZE) {
    const batch = groupsToCheck.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (franchise) => {
        const representative = franchise.items[0];
        if (!representative) return { franchise, relations: new Set<number>() };
        const relations = await fetchRelations(representative.simklId, representative.type);
        return { franchise, relations };
      }),
    );

    for (const { franchise, relations } of results) {
      const representative = franchise.items[0];
      if (!representative) continue;
      const currentIdx = simklIdToFranchise.get(representative.simklId)!;
      for (const relatedId of relations) {
        const targetIdx = simklIdToFranchise.get(relatedId);
        if (targetIdx != null && targetIdx !== currentIdx) {
          mergePairs.push([currentIdx, targetIdx]);
        }
      }
    }
  }

  if (mergePairs.length === 0) return franchises;

  const parent = franchises.map((_, i) => i);
  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }
  function union(a: number, b: number) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  for (const [a, b] of mergePairs) {
    union(a, b);
  }

  const mergedGroups = new Map<number, number[]>();
  for (let i = 0; i < franchises.length; i++) {
    const root = find(i);
    const group = mergedGroups.get(root) ?? [];
    group.push(i);
    mergedGroups.set(root, group);
  }

  const result: AnimeFranchise[] = [];
  for (const indices of mergedGroups.values()) {
    if (indices.length === 1) {
      result.push(franchises[indices[0]]);
      continue;
    }

    const allItems: SimklCacheItem[] = [];
    for (const idx of indices) {
      allItems.push(...franchises[idx].items);
    }
    allItems.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));

    const years = allItems.map((i) => i.year).filter((y): y is number => y != null);
    const yearStart = years.length > 0 ? Math.min(...years) : null;
    const yearEnd = years.length > 0 ? Math.max(...years) : null;

    const bestTitle = allItems
      .map((i) => i.title)
      .reduce((best, current) => (current.length < best.length ? current : best));

    result.push({
      key: franchises[indices[0]].key,
      name: bestTitle,
      simklIds: allItems.map((i) => i.simklId),
      items: allItems,
      bestTitle,
      yearStart,
      yearEnd,
      averageRating: null,
    });
  }

  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

export function computeFranchiseAverageRating(
  franchise: AnimeFranchise,
  getRating: (simklId: number) => number | null,
): number | null {
  const ratings = franchise.simklIds
    .map((id) => getRating(id))
    .filter((r): r is number => r != null && r > 0);

  if (ratings.length === 0) return null;
  return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
}

export function formatYearRange(start: number | null, end: number | null): string {
  if (start == null && end == null) return "";
  if (start === end) return start != null ? String(start) : "";
  if (start != null && end != null) return `${start}-${end}`;
  return start != null ? String(start) : String(end);
}

export function clearAnimeGroupingCache() {
  relationsCache.clear();
  relationsInFlight.clear();
}
