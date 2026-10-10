import { lruSet } from "@/lib/cache";
import type { Meta } from "@/lib/cinemeta";
import { registerCache } from "@/lib/memory-profiler";
import { registerEvictable } from "@/lib/maintenance";
import { anilistArtById, anilistArtByMalId } from "@/lib/anilist/browse";
import { anilistFranchise } from "@/lib/anilist/relations";
import { animeKitsuMeta } from "@/lib/providers/anime-kitsu-addon";
import { isDerivedAnimeFormat } from "@/lib/providers/anime-format";
import { externalToKitsu, kitsuToAnilist } from "@/lib/providers/anime-mapping";
import { stripFranchiseSuffix } from "@/lib/providers/jikan";
import { kitsuCoverImage, parseKitsuId } from "@/lib/providers/kitsu";
import { staticHeroArt } from "@/lib/providers/anime-hero-art-static";
import { tmdbAnimeLogo } from "@/lib/providers/tmdb";
import { fetchTvdbArtwork } from "@/lib/providers/tvdb-proxy";

const CACHE_MAX = 600;

export type HeroArt = { background?: string; logo?: string };

const cache = new Map<string, HeroArt>();
const inflight = new Map<string, Promise<HeroArt>>();

registerCache("anime:heroart", () => cache.size);
registerEvictable("anime-heroart", (aggressive) => {
  if (aggressive) cache.clear();
});

const isAnimeId = (id: string) => /^(kitsu|mal|anilist|anidb):/.test(id);

export async function resolveHeroArt(tmdbKey: string, meta: Meta): Promise<HeroArt> {
  if (!isAnimeId(meta.id)) return { background: meta.background ?? meta.poster, logo: meta.logo };
  const hit = cache.get(meta.id);
  if (hit) return hit;
  const existing = inflight.get(meta.id);
  if (existing) return existing;
  const p = (async (): Promise<HeroArt> => {
    const stat = await staticHeroArt(meta.id).catch(() => undefined);
    const art: HeroArt = stat?.bg
      ? { background: stat.bg, logo: stat.logo ?? meta.logo }
      : await computeArt(tmdbKey, meta).then((c) => ({
          background: c.background,
          logo: stat?.logo ?? c.logo,
        }));
    lruSet(cache, meta.id, art, CACHE_MAX);
    inflight.delete(meta.id);
    return art;
  })();
  inflight.set(meta.id, p);
  return p;
}

export async function resolveHeroBackdrop(tmdbKey: string, meta: Meta): Promise<string | undefined> {
  return (await resolveHeroArt(tmdbKey, meta)).background;
}

async function computeArt(tmdbKey: string, meta: Meta): Promise<HeroArt> {
  const akm = await animeKitsuMeta(meta.id).catch(() => null);
  const kind: "movie" | "tv" = meta.type === "movie" ? "movie" : "tv";
  const year = akm?.releaseInfo ?? meta.releaseInfo;
  const names = [
    ...new Set(
      [stripFranchiseSuffix(meta.name ?? ""), stripFranchiseSuffix(akm?.name ?? ""), akm?.name ?? ""].filter(
        Boolean,
      ),
    ),
  ];
  const malId = meta.id.startsWith("mal:") ? Number(meta.id.split(":")[1]) || null : (meta.malId ?? null);
  let kitsuId = parseKitsuId(meta.id);
  if (kitsuId == null && malId != null) {
    kitsuId = await externalToKitsu("myanimelist", malId).catch(() => null);
  }

  const derived = isDerivedAnimeFormat(meta.animeFormat);
  const tvdbArt = await fetchTvdbArtwork({ kitsuId }).catch(() => null);
  let logo = derived ? undefined : (tvdbArt?.clearLogos[0] ?? akm?.logo ?? undefined);

  const background = await (async (): Promise<string | undefined> => {
    if (tvdbArt?.backgrounds[0]) return tvdbArt.backgrounds[0];
    if (tmdbKey) {
      for (const n of names) {
        const hit = await tmdbAnimeLogo(tmdbKey, n, year, kind).catch(() => null);
        if (hit?.backdrop) {
          if (!logo && !derived && hit.logo) logo = hit.logo;
          return hit.backdrop;
        }
      }
      if (names[0]) {
        const hit = await tmdbAnimeLogo(tmdbKey, names[0], undefined, kind).catch(() => null);
        if (hit?.backdrop) {
          if (!logo && !derived && hit.logo) logo = hit.logo;
          return hit.backdrop;
        }
      }
    }
    if (kitsuId != null) {
      const cover = await kitsuCoverImage(kitsuId).catch(() => null);
      if (cover) return cover;
    }
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
  })();

  if (!logo && tmdbKey && (akm?.name || names[0])) {
    const hit = derived
      ? await tmdbAnimeLogo(tmdbKey, meta.name, year, kind, { exact: true }).catch(() => null)
      : await tmdbAnimeLogo(tmdbKey, akm?.name ?? names[0], year, kind).catch(() => null);
    if (hit?.logo) logo = hit.logo;
  }

  return { background, logo };
}
