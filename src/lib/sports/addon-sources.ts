import { addonAccepts, fetchAddonMeta, type Addon } from "../addons";
import type { SportsGame } from "./espn-types";
import { leagueByTag } from "@/lib/sports/espn-leagues";
import { allowDirectHost, safeFetch } from "../safe-fetch";
import { fetchAddonStreams } from "../streams/addons";
import type { Stream } from "../streams/types";
import {
  mergeSportsAddonListings,
  sportsAddonCatalogs,
  sportsAddonCatalogUrl,
  sportsAddonListings,
  sportsAddonRequests,
  type SportsAddonListing,
} from "./addon-sources-model";

const cache = new Map<string, { at: number; rows: unknown[] }>();
const manifests = new Map<string, { at: number; manifest: Addon["manifest"] }>();
export function clearSportsAddonCatalogCache() {
  cache.clear();
  manifests.clear();
}
// Older saved manifests omitted search/genre options. Refresh only relevant providers,
// briefly caching the full declaration so existing installations recover too.
export async function refreshSportsAddonManifests(addons: Addon[], signal: AbortSignal) {
  const result = [...addons];
  let next = 0,
    failed = 0;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  const deadline = setTimeout(abort, 12_000);
  try {
    await Promise.all(
      Array.from({ length: Math.min(4, addons.length) }, async () => {
        while (next < addons.length && !controller.signal.aborted) {
          const index = next++,
            addon = addons[index];
          if (!sportsAddonCatalogs(addon).length) continue;
          const cached = manifests.get(addon.transportUrl);
          if (cached && Date.now() - cached.at < 300_000) {
            result[index] = { ...addon, manifest: cached.manifest };
            continue;
          }
          try {
            allowDirectHost(addon.transportUrl);
            const response = await safeFetch(addon.transportUrl, {
              signal: controller.signal,
              headers: { Accept: "application/json" },
            });
            if (!response.ok) throw new Error("addon-manifest-unavailable");
            const manifest = await response.json();
            if (!manifest || typeof manifest.id !== "string" || !Array.isArray(manifest.catalogs))
              throw new Error("addon-manifest-invalid");
            if (controller.signal.aborted) break;
            manifests.set(addon.transportUrl, { at: Date.now(), manifest });
            while (manifests.size > 48) manifests.delete(manifests.keys().next().value!);
            result[index] = { ...addon, manifest };
          } catch {
            if (!signal.aborted) failed++;
          }
        }
      }),
    );
  } finally {
    clearTimeout(deadline);
    signal.removeEventListener("abort", abort);
  }
  return { addons: result, failed };
}
export async function loadSportsAddonListings(
  addons: Addon[],
  game: SportsGame,
  signal: AbortSignal,
  onPartial: (rows: SportsAddonListing[]) => void,
  fetcher = safeFetch,
) {
  const requests = sportsAddonRequests(addons, game, leagueByTag(game.league)?.group);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  const timer = setTimeout(cancel, 24_000);
  let next = 0,
    failed = 0;
  const rows: SportsAddonListing[] = [];
  const worker = async () => {
    while (next < requests.length && !controller.signal.aborted) {
      const request = requests[next++];
      const skipSupported =
        request.catalog.extra?.some((e) => e.name === "skip") ||
        request.catalog.extraSupported?.includes("skip");
      let skip = 0;
      for (let page = 0; page < (skipSupported ? 3 : 1) && !controller.signal.aborted; page++) {
        const url = sportsAddonCatalogUrl(request, skip);
        const cached = cache.get(url);
        let raw: unknown[];
        if (cached && Date.now() - cached.at < 45_000) raw = cached.rows;
        else {
          const ac = new AbortController();
          const abort = () => ac.abort();
          controller.signal.addEventListener("abort", abort, { once: true });
          const deadline = setTimeout(abort, 8000);
          try {
            allowDirectHost(url);
            const response = await fetcher(url, {
              signal: ac.signal,
              headers: { Accept: "application/json" },
            });
            if (!response.ok) throw new Error("addon-catalog-unavailable");
            const data = await response.json();
            if (!Array.isArray(data.metas)) throw new Error("addon-catalog-invalid");
            raw = data.metas.slice(0, 1500);
            if (controller.signal.aborted) break;
            cache.set(url, { at: Date.now(), rows: raw });
            while (cache.size > 96) cache.delete(cache.keys().next().value!);
          } catch {
            if (!signal.aborted) failed++;
            break;
          } finally {
            clearTimeout(deadline);
            controller.signal.removeEventListener("abort", abort);
          }
        }
        if (controller.signal.aborted) break;
        const found = sportsAddonListings(request.addon, request.catalog, raw, game);
        const previous = new Set(rows.map((r) => r.key));
        rows.push(...found);
        onPartial(mergeSportsAddonListings(rows));
        if (
          !raw.length ||
          found.every((r) => previous.has(r.key)) ||
          found.some((r) => r.match === "event")
        )
          break;
        skip += raw.length;
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(4, requests.length) }, worker));
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
  return {
    rows: mergeSportsAddonListings(rows),
    failed: failed + (controller.signal.aborted && !signal.aborted ? 1 : 0),
    total: requests.length,
  };
}

export async function loadSportsAddonStreams(
  listing: SportsAddonListing,
  signal: AbortSignal,
  installed: Addon[] = [listing.addon],
): Promise<Stream[]> {
  const { addon } = listing;
  const base = addon.transportUrl.replace(/\/manifest\.json$/, "");
  let meta = listing.meta;
  const embedded = () => {
    const video =
      meta.videos?.find((v) => v.id === (meta.behaviorHints?.defaultVideoId || meta.id)) ??
      (meta.videos?.length === 1 ? meta.videos[0] : undefined);
    return (video?.streams ?? []).map(
      (s) =>
        ({
          ...s,
          addonId: addon.manifest.id,
          addonName: addon.manifest.name,
          addonUrl: addon.transportUrl,
        }) as Stream,
    );
  };
  const query = async (id: string) => {
    const others = installed.filter(
      (a) => a.transportUrl !== addon.transportUrl && addonAccepts(a, "stream", meta.type, id),
    );
    const results: Stream[] = [];
    const targets = [addon, ...others];
    const deadline = new AbortController();
    const abort = () => deadline.abort();
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    const timer = setTimeout(abort, 24_000);
    let next = 0;
    try {
      await Promise.all(
        Array.from({ length: Math.min(3, targets.length) }, async () => {
          while (next < targets.length && !deadline.signal.aborted) {
            const provider = targets[next++];
            results.push(
              ...(await fetchAddonStreams(
                [provider],
                { type: meta.type, ids: [id] },
                deadline.signal,
                undefined,
                undefined,
                8000,
              )),
            );
          }
        }),
      );
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    }
    return results;
  };
  const firstId = meta.behaviorHints?.defaultVideoId || meta.id;
  const inline = embedded();
  if (inline.length) return inline;
  const streams = await query(firstId);
  if (streams.length || signal.aborted) return streams;
  if (addonAccepts(addon, "meta", meta.type, meta.id)) {
    const detail = await fetchAddonMeta(base, meta.type, meta.id);
    if (signal.aborted) return [];
    if (detail) {
      meta = { ...meta, ...detail, addonOrigin: listing.meta.addonOrigin };
      const inline = embedded();
      if (inline.length) return inline;
      const videoId =
        meta.behaviorHints?.defaultVideoId ||
        (meta.videos?.length === 1 ? meta.videos[0].id : undefined);
      if (videoId && videoId !== firstId) return query(videoId);
    }
  }
  return [];
}
