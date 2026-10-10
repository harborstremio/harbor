import { UNIFIED_SOURCES, type UnifiedLibraryFilters } from "./unified-library";
import { LIBRARY_PLAYTIME_FILTERS } from "./library-playtime";
import { LIBRARY_STATUS_FILTERS } from "./library-status";

export type CollectionRules = Omit<UnifiedLibraryFilters, "sort">;
export const defaultCollectionRules = (): CollectionRules => ({query:"",source:"all",availability:"all",visibility:"visible",playtime:"all",playStatus:"all"});

/** Fail closed: a malformed saved rule must never expand into the whole library. */
export function parseCollectionRules(value: unknown): CollectionRules {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("collections_rules");
  const v = value as Record<string, unknown>;
  if (typeof v.query !== "string" || v.query.length > 200 ||
    !["all",...UNIFIED_SOURCES].includes(v.source as string) ||
    !["all","ready","notInstalled","attention"].includes(v.availability as string) ||
    !["visible","pinned","hidden"].includes(v.visibility as string) ||
    v.playtime !== undefined && !LIBRARY_PLAYTIME_FILTERS.includes(v.playtime as typeof LIBRARY_PLAYTIME_FILTERS[number]) ||
    v.playStatus !== undefined && !LIBRARY_STATUS_FILTERS.includes(v.playStatus as typeof LIBRARY_STATUS_FILTERS[number])) throw Error("collections_rules");
  return {query:v.query.trim(),source:v.source,availability:v.availability,visibility:v.visibility,playtime:v.playtime??"all",playStatus:v.playStatus??"all"} as CollectionRules;
}
