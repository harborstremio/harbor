import { aniZipByKitsu } from "@/lib/providers/anizip";
import {
  buildKitsuEpisodes,
  mergeAniZipEpisodes,
  mergeTvdbEpisodes,
  mergeTmdbEpisodes,
} from "@/lib/providers/anime-episode-build";
import { enrichEpisodes } from "@/lib/providers/anime-episode-enrich";
import { animeKitsuMeta } from "@/lib/providers/anime-kitsu-addon";
import { kitsuEpisodes, type KitsuEpisode } from "@/lib/providers/kitsu";
import { applyAnidbSeasonWindow, kitsuToTvdb, kitsuToMal } from "@/lib/providers/anime-mapping";
import {
  applyMalEpisodeTitles,
  episodesMissingTitle,
} from "@/lib/providers/episode-placeholder";
import { malEpisodeTitles } from "@/lib/providers/mal-episodes";
import { tvdbEpisodesByType, tvdbEpisodesAbsolute, tvdbLangFromIso1 } from "@/lib/providers/tvdb";
import { tmdbSeasonEpisodes } from "@/lib/providers/tmdb/tmdb-details";
import type { Episode as TmdbEpisode } from "@/lib/providers/tmdb/tmdb-details";
import type { Settings } from "@/lib/settings";

const cache = new Map<string, Promise<KitsuEpisode[]>>();

function isPlayable(ep: KitsuEpisode): boolean {
  if (ep.streamId) return true;
  return !!(ep.imdbId?.startsWith("tt") && ep.imdbSeason != null && ep.imdbEpisode != null);
}

export function fetchEntryEpisodes(kitsuId: number, settings: Settings): Promise<KitsuEpisode[]> {
  const lang = tvdbLangFromIso1(settings.tmdbLanguage || settings.uiLanguage);
  const iso1 = settings.tmdbLanguage || settings.uiLanguage || "en";
  const localized = iso1.split("-")[0]?.toLowerCase() !== "en";
  const cacheKey = `${kitsuId}:${lang}:${localized ? "loc" : "std"}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const p = (async () => {
    const [addonMeta, raw, aniZip, tvdbRaw] = await Promise.all([
      animeKitsuMeta(`kitsu:${kitsuId}`).catch(() => null),
      kitsuEpisodes(kitsuId, 100).catch(() => [] as KitsuEpisode[]),
      aniZipByKitsu(kitsuId).catch(() => null),
      kitsuToTvdb(kitsuId)
        .then((tid) => {
          if (!tid) return null;
          const fetchAll = (l: string) =>
            Promise.all([
              tvdbEpisodesByType(settings.tvdbKey ?? "", tid, "default", l),
              tvdbEpisodesAbsolute(settings.tvdbKey ?? "", tid, l),
            ]).then(([def, abs]) => {
              const all = [...def, ...abs];
              const unique = new Map(all.map((e) => [e.id, e]));
              return Array.from(unique.values());
            });
          return Promise.all([
            fetchAll(lang),
            lang !== "eng" ? fetchAll("eng").catch(() => null) : Promise.resolve(null),
          ]).then(([loc, en]) => ({ loc, en }));
        })
        .catch(() => null),
    ]);
    let tmdbEpsRaw: TmdbEpisode[] | null = null;
    let tmdbEnRaw: TmdbEpisode[] | null = null;
    if (localized && settings.tmdbKey) {
      const tmdbId = Number(aniZip?.mappings?.themoviedb_id);
      if (tmdbId > 0) {
        // TMDB sometimes merges multiple cours into one generalized season 1 (e.g. 25 episodes
        // covering two 12/13-episode seasons); fetch every season AniZip reports plus season 1
        // and let the merge match by absolute episode number.
        const seasons = new Set<number>([1]);
        for (const az of Object.values(aniZip?.episodes ?? {})) {
          if (az.seasonNumber != null && az.seasonNumber > 0) seasons.add(az.seasonNumber);
        }
        const fetchTmdb = (l: string) =>
          Promise.all(
            Array.from(seasons).map((s) =>
              tmdbSeasonEpisodes(settings.tmdbKey, tmdbId, s, l).catch(() => null),
            ),
          ).then((arr) => {
            const merged = arr.flat().filter((e): e is TmdbEpisode => e != null);
            return merged.length > 0 ? merged : null;
          });
        const isoBase = iso1.split("-")[0]?.toLowerCase();
        const [loc, en] = await Promise.all([
          fetchTmdb(iso1),
          isoBase && isoBase !== "en"
            ? fetchTmdb("en").catch(() => null)
            : Promise.resolve<TmdbEpisode[] | null>(null),
        ]);
        tmdbEpsRaw = loc;
        tmdbEnRaw = en;
      }
    }
    const eps = buildKitsuEpisodes(addonMeta, raw);
    mergeAniZipEpisodes(eps, aniZip, { lang: localized ? iso1 : undefined, targetLang: iso1 });
    // AniZip often carries a new season's ids before its episode records, and
    // the addon labels the cour "season 1" — the window must land before the
    // TVDB merge or the cour's identity-less rows match franchise season 1.
    await applyAnidbSeasonWindow(eps, kitsuId);
    mergeTvdbEpisodes(eps, tvdbRaw?.loc ?? null, {
      lang: localized ? iso1 : undefined,
      targetLang: iso1,
    });
    mergeTmdbEpisodes(eps, tmdbEpsRaw, { lang: localized ? iso1 : undefined, targetLang: iso1 });
    // Fall back to English titles/overviews when the localized translation is missing (providers
    // otherwise fall back to the original, e.g. Japanese for anime). `targetLang` keeps this pass
    // from overwriting a title the user already has in their own language.
    if (localized) {
      if (tvdbRaw?.en) mergeTvdbEpisodes(eps, tvdbRaw.en, { targetLang: iso1 });
      if (tmdbEnRaw) mergeTmdbEpisodes(eps, tmdbEnRaw, { targetLang: iso1 });
    }
    // Last resort: MAL names episodes the other providers leave unnamed (it
    // carries English and romaji early). Only rows with no real title are filled.
    if (episodesMissingTitle(eps)) {
      const malId = aniZip?.mappings?.mal_id ?? (await kitsuToMal(kitsuId).catch(() => null));
      if (malId != null) {
        const malEps = await malEpisodeTitles(malId).catch(() => null);
        applyMalEpisodeTitles(eps, malEps);
      }
    }
    const imdbId = aniZip?.mappings?.imdb_id ?? eps.find((ep) => ep.imdbId)?.imdbId ?? null;
    await enrichEpisodes(eps, settings, kitsuId, imdbId).catch(() => {});
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
