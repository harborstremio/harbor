import { isGenericEpisodeTitle, pickPreferredEpisodeTitle } from "../episode-title.ts";
import { pickEpisodeTitle } from "./anizip-episode-title.ts";
import type { AniZipMapping } from "./anizip";
import { pickEpisodeTitle, pickLocalizedTitle, type AniZipMapping } from "@/lib/providers/anizip";
import type { AnimeKitsuMeta } from "@/lib/providers/anime-kitsu-addon";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import type { TvdbEpisode } from "@/lib/providers/tvdb";
import type { Episode as TmdbEpisode } from "@/lib/providers/tmdb/tmdb-details";

export type EpisodeLocalizeOptions = { lang?: string | null };

// Opt-in gate: localized text applies only for non-English languages; English/empty keeps the old merge behavior.
function wantsLocalized(opts?: EpisodeLocalizeOptions): boolean {
  const lang = opts?.lang?.trim();
  if (!lang) return false;
  const base = lang.split("-")[0]?.toLowerCase() ?? "";
  return base !== "" && base !== "en";
}

// TMDB/TVDB return original-language text (Japanese for most anime) when the requested
// translation is missing, so only accept text written in the target language's script.
const SCRIPT_TEST: Record<string, RegExp> = {
  ar: /[\u0600-\u06FF\u0750-\u077F]/,
  fa: /[\u0600-\u06FF\u0750-\u077F]/,
  ur: /[\u0600-\u06FF\u0750-\u077F]/,
  ru: /[\u0400-\u04FF]/,
  uk: /[\u0400-\u04FF]/,
  bg: /[\u0400-\u04FF]/,
  sr: /[\u0400-\u04FF]/,
  mk: /[\u0400-\u04FF]/,
  be: /[\u0400-\u04FF]/,
  el: /[\u0370-\u03FF]/,
  hi: /[\u0900-\u097F]/,
  mr: /[\u0900-\u097F]/,
  ne: /[\u0900-\u097F]/,
  th: /[\u0E00-\u0E7F]/,
  he: /[\u0590-\u05FF]/,
  yi: /[\u0590-\u05FF]/,
  ko: /[\uAC00-\uD7AF\u1100-\u11FF]/,
  zh: /[\u3400-\u4DBF\u4E00-\u9FFF]/,
  ja: /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]/,
};

const FOREIGN_SCRIPT =
  /[\u0600-\u06FF\u0750-\u077F\u0400-\u04FF\u0370-\u03FF\u0900-\u097F\u0E00-\u0E7F\u0590-\u05FF\uAC00-\uD7AF\u1100-\u11FF\u3400-\u4DBF\u4E00-\u9FFF\u3040-\u30FF]/;

export function isTextInLanguage(text: string | null | undefined, lang: string | null | undefined): boolean {
  if (!text) return false;
  const base = lang?.trim().split("-")[0]?.toLowerCase() ?? "";
  if (!base || base === "en") return true;
  const range = SCRIPT_TEST[base];
  if (range) return range.test(text);
  return !FOREIGN_SCRIPT.test(text);
}

// "Episode N" words in various languages: providers ship such placeholders when a real
// translated title is missing, and they must not be merged in as if they were titles.
const EPISODE_NUMBER_WORDS = [
  "episode", "ep",
  "الحلقة", "الحلقه", "حلقة", "حلقه",
  "قسمت", "اپیزود", "اپيسود",
  "قسط",
  "серия", "эпизод", "серія", "епізод", "епизод", "епизода", "серыя", "эпізод",
  "επεισόδιο",
  "एपिसोड", "भाग",
  "ตอน",
  "פרק", "פּרק",
  "에피소드",
  "episodio", "capítulo", "capitulo", "cap",
  "épisode",
  "folge",
  "puntata",
  "bölüm", "bolum",
  "odcinek",
  "aflevering",
  "avsnitt",
  "tập",
];

export function isGenericEpisodeName(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.trim();
  if (!t) return false;
  if (/^\d+[\s.,-]*$/.test(t)) return true;
  // Compact CJK forms like 第18話 / 第18集 / 18화
  if (/^第\s*\d+\s*[話话集]$/.test(t)) return true;
  if (/^\d+\s*화$/.test(t)) return true;
  const lower = t.toLowerCase();
  for (const word of EPISODE_NUMBER_WORDS) {
    if (!lower.includes(word)) continue;
    const rest = lower.replace(word, "").replace(/[\s\-–—:.,()\[\]'"،،]/g, "");
    if (/^\d*$/.test(rest)) return true;
  }
  return false;
}

export function buildKitsuEpisodes(
  addonMeta: AnimeKitsuMeta | null,
  kitsuRawEpisodes: KitsuEpisode[],
): KitsuEpisode[] {
  if (!addonMeta?.videos || addonMeta.videos.length === 0) return kitsuRawEpisodes;
  const kitsuById = new Map<number, KitsuEpisode>();
  for (const ep of kitsuRawEpisodes) kitsuById.set(ep.number, ep);
  return addonMeta.videos.map((v): KitsuEpisode => {
    const k = kitsuById.get(v.episode);
    return {
      id: k?.id ?? v.episode,
      number: v.episode,
      seasonNumber: v.season ?? 1,
      title: pickPreferredEpisodeTitle(v.episode, v.title, k?.title) ?? `Episode ${v.episode}`,
      synopsis: v.overview ?? k?.synopsis ?? "",
      thumbnail: v.thumbnail ?? k?.thumbnail ?? null,
      airdate: v.released ?? k?.airdate ?? null,
      length: k?.length ?? null,
      streamId: v.id,
      imdbId: v.imdb_id,
      imdbSeason: v.imdbSeason,
      imdbEpisode: v.imdbEpisode,
    };
  });
}

export function mergeAniZipEpisodes(
  episodes: KitsuEpisode[],
  aniZip: AniZipMapping | null,
  opts?: EpisodeLocalizeOptions,
): void {
  if (!aniZip?.episodes) return;
  const azImdb = aniZip.mappings?.imdb_id;
  const localized = wantsLocalized(opts);
  for (const ep of episodes) {
    const az = aniZip.episodes[String(ep.number)];
    if (!az) continue;
    const enrichedTitle = pickEpisodeTitle(az);
    if (enrichedTitle && isGenericEpisodeTitle(ep.title, ep.number)) {
      ep.title = enrichedTitle;
    if (localized) {
      const localizedTitle = pickLocalizedTitle(az, opts?.lang);
      if (localizedTitle && !isGenericEpisodeName(localizedTitle) && isTextInLanguage(localizedTitle, opts?.lang)) {
        ep.title = localizedTitle;
      }
    } else {
      const enrichedTitle = pickEpisodeTitle(az);
      if (enrichedTitle && !isGenericEpisodeName(enrichedTitle) && (!ep.title || ep.title === `Episode ${ep.number}`)) {
        ep.title = enrichedTitle;
      }
    }
    if (az.overview && !ep.synopsis && (!localized || isTextInLanguage(az.overview, opts?.lang))) {
      ep.synopsis = az.overview;
    }
    if (az.image) {
      if (ep.thumbnail && ep.thumbnail !== az.image && !ep.thumbnailFallback) {
        ep.thumbnailFallback = ep.thumbnail;
      }
      ep.thumbnail = az.image;
    }
    if (az.airDate) ep.airdate = az.airDate;
    if (az.runtime && !ep.length) ep.length = az.runtime;
    if (az.filler) ep.filler = true;
    if (az.absoluteEpisodeNumber) ep.absoluteNumber = az.absoluteEpisodeNumber;
    if (az.tvdbId) ep.tvdbEpisodeId = az.tvdbId;
    if (ep.rating == null && az.rating != null) {
      const r = Number(az.rating);
      if (Number.isFinite(r) && r > 0) ep.rating = r;
    }
    if (az.seasonNumber != null && az.seasonNumber >= 0 && az.episodeNumber != null) {
      if (azImdb) ep.imdbId = azImdb;
      if (ep.imdbSeason == null) ep.imdbSeason = az.seasonNumber;
      if (ep.imdbEpisode == null) ep.imdbEpisode = az.episodeNumber;
    }
  }
}

export function mergeTvdbEpisodes(
  episodes: KitsuEpisode[],
  tvdbEps: TvdbEpisode[] | null,
  opts?: EpisodeLocalizeOptions,
): void {
  if (!tvdbEps || tvdbEps.length === 0) return;
  const localized = wantsLocalized(opts);
  const tvdbById = new Map<number, TvdbEpisode>();
  const tvdbByAbsolute = new Map<number, TvdbEpisode>();
  const tvdbBySeasonAndEpisode = new Map<string, TvdbEpisode>();

  for (const e of tvdbEps) {
    tvdbById.set(e.id, e);
    if (e.absoluteNumber != null) tvdbByAbsolute.set(e.absoluteNumber, e);
    tvdbBySeasonAndEpisode.set(`${e.seasonNumber}:${e.number}`, e);
  }

  for (const ep of episodes) {
    let tvdbEp: TvdbEpisode | undefined;

    if (ep.tvdbEpisodeId) tvdbEp = tvdbById.get(ep.tvdbEpisodeId);
    if (!tvdbEp && ep.absoluteNumber) tvdbEp = tvdbByAbsolute.get(ep.absoluteNumber);
    if (!tvdbEp && ep.imdbSeason != null && ep.imdbEpisode != null) {
      tvdbEp = tvdbBySeasonAndEpisode.get(`${ep.imdbSeason}:${ep.imdbEpisode}`);
    }
    if (!tvdbEp) tvdbEp = tvdbBySeasonAndEpisode.get(`${ep.seasonNumber}:${ep.number}`);
    if (!tvdbEp) tvdbEp = tvdbByAbsolute.get(ep.number);

    if (tvdbEp) {
      if (
        tvdbEp.name &&
        !isGenericEpisodeTitle(tvdbEp.name, tvdbEp.number) &&
        isGenericEpisodeTitle(ep.title, ep.number)
      ) {
        ep.title = tvdbEp.name;
      if (tvdbEp.name && !isGenericEpisodeName(tvdbEp.name) && (localized || !ep.title || ep.title === `Episode ${ep.number}`)) {
        if (!localized || isTextInLanguage(tvdbEp.name, opts?.lang)) {
          ep.title = tvdbEp.name;
        }
      }
      if (tvdbEp.aired) ep.airdate = tvdbEp.aired;
      if (tvdbEp.overview && (localized || !ep.synopsis)) {
        if (!localized || isTextInLanguage(tvdbEp.overview, opts?.lang)) {
          ep.synopsis = tvdbEp.overview;
        }
      }
      if (tvdbEp.image) {
        if (ep.thumbnail && ep.thumbnail !== tvdbEp.image && !ep.thumbnailFallback) {
          ep.thumbnailFallback = ep.thumbnail;
        }
        ep.thumbnail = tvdbEp.image;
      }
      if (tvdbEp.runtime && !ep.length) ep.length = tvdbEp.runtime;
    }
  }
}

export function mergeTmdbEpisodes(
  episodes: KitsuEpisode[],
  tmdbEps: TmdbEpisode[] | null,
  opts?: EpisodeLocalizeOptions,
): void {
  if (!tmdbEps || tmdbEps.length === 0) return;
  const localized = wantsLocalized(opts);
  const byNumber = new Map<number, TmdbEpisode>();
  for (const e of tmdbEps) byNumber.set(e.episodeNumber, e);
  for (const ep of episodes) {
    // Kitsu restarts numbering per season entry, so prefer AniZip's TMDB episode number
    // (imdbEpisode) to keep split-season parts matched to the correct TMDB episodes.
    const tmdbEp = byNumber.get(ep.imdbEpisode ?? ep.number);
    if (!tmdbEp) continue;
    if (tmdbEp.name && !isGenericEpisodeName(tmdbEp.name) && (localized || !ep.title || ep.title === `Episode ${ep.number}`)) {
      if (!localized || isTextInLanguage(tmdbEp.name, opts?.lang)) {
        ep.title = tmdbEp.name;
      }
    }
    if (tmdbEp.overview && (localized || !ep.synopsis)) {
      if (!localized || isTextInLanguage(tmdbEp.overview, opts?.lang)) {
        ep.synopsis = tmdbEp.overview;
      }
    }
  }
}
