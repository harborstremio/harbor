import { lruGet, lruSet } from "@/lib/cache";

const TTL_MS = 5 * 60_000;
const MAX_CATALOG_PAGES = 128;

// Only public catalog pages: never account, session, search, or personalized state.
export function isCatalogPath(path: string): boolean {
  return /^(discover\/(movie|tv)|trending\/(movie|tv|all)\/(day|week)|(movie|tv)\/(popular|top_rated|now_playing|upcoming|on_the_air|airing_today))$/.test(
    path,
  );
}

export function createCatalogCache(now: () => number = Date.now) {
  const pages = new Map<string, { expires: number; data: unknown }>();
  return {
    get<T>(key: string): T | undefined {
      const entry = lruGet(pages, key);
      if (!entry) return undefined;
      if (entry.expires <= now()) {
        pages.delete(key);
        return undefined;
      }
      // Callers enrich metadata; never let that mutate a later caller's page.
      return structuredClone(entry.data) as T;
    },
    set(key: string, data: unknown): void {
      if (data == null) return;
      lruSet(
        pages,
        key,
        { expires: now() + TTL_MS, data: structuredClone(data) },
        MAX_CATALOG_PAGES,
      );
    },
  };
}
