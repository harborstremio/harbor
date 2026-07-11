import { anilistArtById, anilistArtByMalId } from "@/lib/anilist/browse";
import { anilistFranchise } from "@/lib/anilist/relations";
import { lruSet } from "@/lib/cache";
import type { Meta } from "@/lib/cinemeta";
import { registerEvictable } from "@/lib/maintenance";
import { registerCache } from "@/lib/memory-profiler";
import { animeKitsuMeta } from "@/lib/providers/anime-kitsu-addon";
import { externalToKitsu, kitsuToAnilist } from "@/lib/providers/anime-mapping";
import { stripFranchiseSuffix } from "@/lib/providers/jikan";
import { parseKitsuId } from "@/lib/providers/kitsu";
import { tmdbAnimeLogo } from "@/lib/providers/tmdb";

const CACHE_MAX = 600;
const cache = new Map<string, string | undefined>();
const inflight = new Map<string, Promise<string | undefined>>();

registerCache("anime:backdrop", () => cache.size);
registerEvictable("anime-backdrop", (aggressive) => {
  if (aggressive) cache.clear();
});

const isAnimeId = (id: string) => /^(kitsu|mal|anilist|anidb):/.test(id);

export async function resolveHeroBackdrop(tmdbKey: string, meta: Meta): Promise<string | undefined> {
  if (!isAnimeId(meta.id)) return meta.background ?? meta.poster;
  if (cache.has(meta.id)) return cache.get(meta.id);
  const existing = inflight.get(meta.id);
  if (existing) return existing;
  const p = (async () => {
    const akm = await animeKitsuMeta(meta.id).catch(() => null);
    const kind: "movie" | "tv" = meta.type === "movie" ? "movie" : "tv";
    const year = akm?.releaseInfo ?? meta.releaseInfo;
    const names = [
      ...new Set(
        [stripFranchiseSuffix(meta.name ?? ""), stripFranchiseSuffix(akm?.name ?? ""), akm?.name ?? ""].filter(Boolean),
      ),
    ];
    if (tmdbKey) {
      for (const n of names) {
        const hit = await tmdbAnimeLogo(tmdbKey, n, year, kind).catch(() => null);
        if (hit?.backdrop) return hit.backdrop;
      }
      if (names[0]) {
        const hit = await tmdbAnimeLogo(tmdbKey, names[0], undefined, kind).catch(() => null);
        if (hit?.backdrop) return hit.backdrop;
      }
    }
    const kitsuId = parseKitsuId(meta.id);
    const malId = meta.id.startsWith("mal:") ? Number(meta.id.split(":")[1]) || null : null;
    let anilistId = meta.id.startsWith("anilist:") ? Number(meta.id.split(":")[1]) || null : null;
    if (anilistId == null && kitsuId != null) {
      anilistId = await kitsuToAnilist(kitsuId).catch(() => null);
    }
    if (anilistId == null && malId != null) {
      const art = await anilistArtByMalId(malId);
      if (art.banner) return art.banner;
      anilistId = art.id ?? null;
    }
    if (anilistId != null) {
      const art = await anilistArtById(anilistId).catch(() => null);
      if (art?.banner) return art.banner;
      const fam = await anilistFranchise(anilistId).catch(() => []);
      const rooted = fam.filter((n) => !n.upcoming).sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
      const rootBanner = rooted.find((n) => n.banner)?.banner;
      if (rootBanner) return rootBanner;
      for (const n of rooted.slice(0, 2)) {
        const rootKitsu = await externalToKitsu("anilist", n.id).catch(() => null);
        if (rootKitsu == null) continue;
        const rootMeta = await animeKitsuMeta(`kitsu:${rootKitsu}`).catch(() => null);
        if (rootMeta?.background) return rootMeta.background;
      }
    }
    return meta.background ?? meta.poster;
  })().then((url) => {
    if (url && url !== meta.background && url !== meta.poster) {
      lruSet(cache, meta.id, url, CACHE_MAX);
    }
    inflight.delete(meta.id);
    return url;
  });
  inflight.set(meta.id, p);
  return p;
}
