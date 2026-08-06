import { lruSet } from "@/lib/cache";
import { meta as fetchCinemeta, narrowMediaType, type Meta } from "@/lib/cinemeta";
import { ensureCuratedLogos, peekCuratedLogo } from "@/lib/curated-logos";
import { registerEvictable } from "@/lib/maintenance";
import { registerCache } from "@/lib/memory-profiler";
import { animeKitsuMeta } from "@/lib/providers/anime-kitsu-addon";
import { isDerivedAnimeFormat } from "@/lib/providers/anime-format";
import { externalToKitsu } from "@/lib/providers/anime-mapping";
import { parseKitsuId } from "@/lib/providers/kitsu";
import { fetchTvdbArtwork } from "@/lib/providers/tvdb-proxy";
import { tmdbAnimeLogo, tmdbIdFromImdb, tmdbImdbId, tmdbLogo } from "@/lib/providers/tmdb";
import { shouldLocalizePosters } from "@/lib/providers/tmdb/tmdb-image-lang";
import { getTitleLogo } from "@/lib/title-logo";
import { loadStoredSettings } from "@/lib/settings/load";
const CACHE_MAX = 1200;
const cache = new Map<string, string | undefined>();
const inflight = new Map<string, Promise<string | undefined>>();

registerCache("logo:url", () => cache.size);
registerCache("logo:inflight", () => inflight.size);

registerEvictable("logo", () => {
  inflight.clear();
});


const isAnimeLogoId = (id: string) => /^(kitsu|mal|anilist|anidb):/.test(id);

function preferTmdbLogo(tmdbKey: string, meta: Meta): boolean {
  if (!tmdbKey || !shouldLocalizePosters()) return false;
  const settings = loadStoredSettings();
  if (!settings.heroLocalizedMetadata) return false;
  return meta.id.startsWith("tt") || meta.id.startsWith("tmdb:");
}

export async function resolveLogo(
  tmdbKey: string,
  meta: Meta,
  opts?: { preferOwn?: boolean },
): Promise<string | undefined> {
  const pinned = getTitleLogo(meta.id);
  if (pinned) return pinned;
  await ensureCuratedLogos();
  const curated = peekCuratedLogo(meta.id);
  if (curated) return curated;
  const preferOwn = opts?.preferOwn === true && isAnimeLogoId(meta.id);
  if (meta.logo && !preferOwn && !preferTmdbLogo(tmdbKey, meta)) return meta.logo;
  const cacheKey = `${meta.id}::${tmdbKey ? "k" : "n"}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const existing = inflight.get(cacheKey);
  if (existing) return existing;
  const p = doResolve(tmdbKey, meta).then((url) => {
    if (url) lruSet(cache, cacheKey, url, CACHE_MAX);
    inflight.delete(cacheKey);
    return url ?? meta.logo;
  });
  inflight.set(cacheKey, p);
  return p;
}

export function peekCachedLogo(
  tmdbKey: string,
  meta: Meta,
  opts?: { preferOwn?: boolean },
): string | undefined {
  const pinned = getTitleLogo(meta.id);
  if (pinned) return pinned;
  const curated = peekCuratedLogo(meta.id);
  if (curated) return curated;
  const preferOwn = opts?.preferOwn === true && isAnimeLogoId(meta.id);
  const cacheKey = `${meta.id}::${tmdbKey ? "k" : "n"}`;
  if (preferOwn || preferTmdbLogo(tmdbKey, meta)) return cache.get(cacheKey);
  if (meta.logo) return meta.logo;
  return cache.get(cacheKey);
}

async function doResolve(tmdbKey: string, m: Meta): Promise<string | undefined> {
  if (m.id.startsWith("tt")) {
    if (preferTmdbLogo(tmdbKey, m)) {
      const tmdbId = await tmdbIdFromImdb(tmdbKey, m.id, narrowMediaType(m.type));
      if (tmdbId) {
        const localized = await tmdbLogo(tmdbKey, tmdbId, m.originalLanguage);
        if (localized) return localized;
      }
    }
    const full = await fetchCinemeta(narrowMediaType(m.type),m.id);
    return full?.logo;
  }
  if (m.id.startsWith("tmdb:")) {
    if (tmdbKey) {
      const tt = await tmdbImdbId(tmdbKey, m.id);
      if (tt) {
        const curated = peekCuratedLogo(tt);
        if (curated) return curated;
      }
      const fromTmdb = await tmdbLogo(tmdbKey, m.id, m.originalLanguage);
      if (fromTmdb) return fromTmdb;
      if (tt) {
        const full = await fetchCinemeta(narrowMediaType(m.type),tt);
        if (full?.logo) return full.logo;
      }
    }
    return undefined;
  }
  if (
    m.id.startsWith("kitsu:") ||
    m.id.startsWith("mal:") ||
    m.id.startsWith("anilist:") ||
    m.id.startsWith("anidb:")
  ) {
    const kind = m.type === "movie" ? "movie" : "tv";
    let kitsuId = parseKitsuId(m.id);
    if (kitsuId == null) {
      const ext = m.id.match(/^(mal|anilist|anidb):(\d+)/);
      if (ext) {
        const src = ext[1] === "mal" ? "myanimelist" : ext[1];
        const idNum = Number(ext[2]);
        if (Number.isFinite(idNum)) kitsuId = await externalToKitsu(src, idNum).catch(() => null);
      }
    }
    const canonicalId = kitsuId != null ? `kitsu:${kitsuId}` : m.id;
    const akm = await animeKitsuMeta(canonicalId).catch(() => null);
    const year = akm?.releaseInfo ?? m.releaseInfo;
    if (akm?.logo) return akm.logo;
    if (isDerivedAnimeFormat(m.animeFormat)) {
      if (tmdbKey && m.name) {
        const hit = await tmdbAnimeLogo(tmdbKey, m.name, year, kind, { exact: true });
        if (hit?.logo) return hit.logo;
      }
      return undefined;
    }
    if (kitsuId != null) {
      const art = await fetchTvdbArtwork({ kitsuId }).catch(() => null);
      if (art?.clearLogos[0]) return art.clearLogos[0];
    }
    if (tmdbKey && m.name) {
      const hit = await tmdbAnimeLogo(tmdbKey, akm?.name ?? m.name, year, kind);
      if (hit?.logo) return hit.logo;
    }
    return undefined;
  }
  return undefined;
}
