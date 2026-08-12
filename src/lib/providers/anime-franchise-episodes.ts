import { buildKitsuEpisodes, mergeAniZipEpisodes, mergeTvdbEpisodes } from "@/lib/providers/anime-episode-build";
import { aniZipByKitsuWithFallback } from "@/lib/providers/anime-mapping";
import { animeKitsuMeta } from "@/lib/providers/anime-kitsu-addon";
import { kitsuEpisodes, type KitsuEpisode } from "@/lib/providers/kitsu";
import { kitsuToTvdb } from "@/lib/providers/anime-mapping";
import { tvdbEpisodesByType, tvdbEpisodesAbsolute, tvdbLangFromIso1 } from "@/lib/providers/tvdb";
import type { Settings } from "@/lib/settings";

const cache = new Map<string, Promise<KitsuEpisode[]>>();

function isPlayable(ep: KitsuEpisode): boolean {
  if (ep.streamId) return true;
  return !!(ep.imdbId?.startsWith("tt") && ep.imdbSeason != null && ep.imdbEpisode != null);
}

export function fetchEntryEpisodes(kitsuId: number, settings: Settings): Promise<KitsuEpisode[]> {
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
    const sourceMetaId = `kitsu:${kitsuId}`;
    const out: KitsuEpisode[] = [];
    for (const ep of eps) {
      if (!isPlayable(ep)) continue;
      out.push({ ...ep, sourceMetaId });
    }
    return out;
  })();
  cache.set(cacheKey, p);
  return p;
}
