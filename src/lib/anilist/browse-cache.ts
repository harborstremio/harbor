import type { Meta } from "@/lib/cinemeta";

export type BrowseKey = "top" | "trending";

// Failed and empty responses must never become a permanent empty discovery row.
export function createBrowseCache(fetcher: (key: BrowseKey) => Promise<Meta[]>, now = Date.now) {
  const cache = new Map<BrowseKey, { metas: Meta[]; at: number }>();
  const inflight = new Map<BrowseKey, Promise<Meta[]>>();
  return {
    peek(key: BrowseKey): Meta[] { return cache.get(key)?.metas ?? []; },
    load(key: BrowseKey): Promise<Meta[]> {
      const hit = cache.get(key);
      if (hit && now() - hit.at < 5 * 60_000) return Promise.resolve(hit.metas);
      const pending = inflight.get(key);
      if (pending) return pending;
      const request = Promise.resolve().then(() => fetcher(key)).then(metas => {
        if (metas.length === 0) throw new Error(`Empty AniList ${key} response`);
        cache.set(key, { metas, at: now() });
        return metas;
      }).finally(() => inflight.delete(key));
      inflight.set(key, request);
      return request;
    },
  };
}
