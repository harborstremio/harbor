import { buildKitsuEpisodes, mergeAniZipEpisodes, mergeTvdbEpisodes } from "@/lib/providers/anime-episode-build";
import { aniZipByKitsuWithFallback } from "@/lib/providers/anime-mapping";
import { animeKitsuMeta } from "@/lib/providers/anime-kitsu-addon";
import { kitsuEpisodes, type KitsuEpisode } from "@/lib/providers/kitsu";
import { kitsuToTvdb, kitsuToImdb } from "@/lib/providers/anime-mapping";
import { tvdbEpisodesByType, tvdbEpisodesAbsolute, tvdbLangFromIso1 } from "@/lib/providers/tvdb";
import { enrichEpisodes } from "@/lib/providers/anime-episode-enrich";
import { harborImdbEpisodesCached } from "@/lib/providers/harbor-imdb";
import type { Settings } from "@/lib/settings";

const cache = new Map<string, Promise<{ base: KitsuEpisode[]; enrichPromise: Promise<void> }>>();

function isPlayable(ep: KitsuEpisode): boolean {
  if (ep.streamId) return true;
  return !!(ep.imdbId?.startsWith("tt") && ep.imdbSeason != null && ep.imdbEpisode != null);
}

export function fetchEntryEpisodes(kitsuId: number, settings: Settings): Promise<{ base: KitsuEpisode[]; enrichPromise: Promise<void> }> {
  const lang = tvdbLangFromIso1(settings.tmdbLanguage || settings.uiLanguage);
  const cacheKey = `${kitsuId}:${lang}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  
  const p = (async () => {
    const [addonMeta, raw, aniZip, tvdbEpsRaw] = await Promise.all([
      animeKitsuMeta(`kitsu:${kitsuId}`).catch(() => null),
      kitsuEpisodes(kitsuId, 100).catch(() => [] as KitsuEpisode[]),
      aniZipByKitsuWithFallback(kitsuId).catch(() => null),
      kitsuToTvdb(kitsuId)
        .then((tid) => {
          if (!tid) return null;
          return Promise.all([
            tvdbEpisodesByType(settings.tvdbKey ?? "", tid, "default", lang),
            tvdbEpisodesAbsolute(settings.tvdbKey ?? "", tid, lang)
          ]).then(([def, abs]) => {
            const all = [...def, ...abs];
            const unique = new Map(all.map(e => [e.id, e]));
            return Array.from(unique.values());
          });
        })
        .catch(() => null),
    ]);
    const eps = buildKitsuEpisodes(addonMeta, raw);
    mergeAniZipEpisodes(eps, aniZip);
    mergeTvdbEpisodes(eps, tvdbEpsRaw);

    let seriesImdb = aniZip?.mappings?.imdb_id ?? eps.find((e) => e.imdbId)?.imdbId ?? null;
    if (!seriesImdb) seriesImdb = await kitsuToImdb(kitsuId).catch(() => null);

    const cachedHarbor = seriesImdb ? harborImdbEpisodesCached(seriesImdb) : null;
    if (cachedHarbor && cachedHarbor.size > 0) {
      for (const ep of eps) {
        const season = ep.imdbSeason ?? ep.seasonNumber ?? 1;
        const num = ep.imdbEpisode ?? ep.number;
        let rating = cachedHarbor.get(`${season}:${num}`);
        
        if (rating == null && ep.number) {
          rating = cachedHarbor.get(`1:${ep.number}`);
        }
        if (rating == null && ep.absoluteNumber) {
          rating = cachedHarbor.get(`1:${ep.absoluteNumber}`);
        }

        if (rating != null && rating > 0) {
          if (!ep.airdate || new Date(ep.airdate).getTime() <= Date.now()) {
            ep.rating = rating;
            ep.ratingIsImdb = true;
          }
        }
      }
    }

    const sourceMetaId = `kitsu:${kitsuId}`;
    const base: KitsuEpisode[] = [];
    for (const ep of eps) {
      if (!isPlayable(ep)) continue;
      base.push({ ...ep, sourceMetaId });
    }

    let resolveEnrich!: () => void;
    let rejectEnrich!: (err: any) => void;
    const enrichPromise = new Promise<void>((resolve, reject) => {
      resolveEnrich = resolve;
      rejectEnrich = reject;
    });

    enrichEpisodes(base, settings, kitsuId, seriesImdb)
      .then(resolveEnrich)
      .catch(rejectEnrich);

    return { base, enrichPromise };
  })();

  cache.set(cacheKey, p);
  return p;
}
