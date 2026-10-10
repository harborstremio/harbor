import { pickLocalizedTitle, type AniZipMapping } from "@/lib/providers/anizip";
import type { AnimeKitsuMeta } from "@/lib/providers/anime-kitsu-addon";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import type { TvdbEpisode } from "@/lib/providers/tvdb";
import type { Episode as TmdbEpisode } from "@/lib/providers/tmdb/tmdb-details";

export type EpisodeLocalizeOptions = {
  lang?: string | null;
  // The user's selected metadata language. Unlike `lang` (which gates which
  // provider text is accepted here), this is also passed on the English
  // fallback pass so a title already in the user's language is left alone.
  targetLang?: string | null;
};

// Hunter x Hunter (2011) only: AniZip keys 59-78 carry the right Greed Island
// titles ("Bid x and x Haste" = true ep 59) but Chimera-Ant-era identity
// (absoluteNumber 117-136, tvdbId 4798644+, image .../4798644.jpg, S2E59-78,
// airDate 2014). Copying that unchecked poisons TVDB matching, proxy overlay
// and season buckets (59-78 repeats). Scoped to HxH so no other anime changes.
function isHunterXHunter2011(aniZip: AniZipMapping | null): boolean {
  const m = aniZip?.mappings;
  if (!m) return false;
  if (m.kitsu_id === 6448) return true;
  if (m.mal_id === 11061) return true;
  if (m.anilist_id === 11061) return true;
  if (m.anidb_id === 8550) return true;
  if (m.thetvdb_id === 252322) return true;
  if (m.imdb_id === "tt2098220") return true;
  const tmdb = m.themoviedb_id;
  if (tmdb != null && String(tmdb) === "46298") return true;
  return false;
}

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

export function isUsableLocalizedText(text: string | null | undefined, lang: string | null | undefined): boolean {
  if (!text) return false;
  if (isTextInLanguage(text, lang)) return true;
  const base = lang?.trim().split("-")[0]?.toLowerCase() ?? "";
  return base !== "en" && !FOREIGN_SCRIPT.test(text);
}

/**
 * A title written in a non-Latin script (Japanese kanji/kana, Cyrillic, …).
 * For an English target these are not the language the user asked for, so a
 * Latin (English) name from another provider may replace them.
 */
export function isForeignScriptTitle(text: string | null | undefined): boolean {
  return !!text && FOREIGN_SCRIPT.test(text);
}

/**
 * Whether `text` is already written in the user's selected (non-English)
 * language. The English fallback pass uses this so it only fills gaps and never
 * overwrites a title the user asked for in their own language.
 */
export function isTextInUserLanguage(
  text: string | null | undefined,
  targetLang: string | null | undefined,
): boolean {
  const base = targetLang?.trim().split("-")[0]?.toLowerCase() ?? "";
  if (!base || base === "en") return false;
  return isTextInLanguage(text, base);
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
  // The Kitsu addon stamps every video of a season with the season's start
  // date. That single shared date marks episodes that have not aired as aired
  // (breaking upcoming badges and air-date gates), so when every video carries
  // the same released instant the per-episode Kitsu air date wins instead.
  const released = addonMeta.videos.map((v) => v.released ?? null);
  const sharedReleased =
    released.length > 1 && released[0] != null && released.every((r) => r === released[0]);
  const kitsuById = new Map<number, KitsuEpisode>();
  for (const ep of kitsuRawEpisodes) kitsuById.set(ep.number, ep);
  return addonMeta.videos.map((v): KitsuEpisode => {
    const k = kitsuById.get(v.episode);
    return {
      id: k?.id ?? v.episode,
      number: v.episode,
      seasonNumber: v.season ?? 1,
      title: v.title || k?.title || `Episode ${v.episode}`,
      synopsis: v.overview ?? k?.synopsis ?? "",
      thumbnail: v.thumbnail ?? k?.thumbnail ?? null,
      airdate: sharedReleased ? (k?.airdate ?? null) : (v.released ?? k?.airdate ?? null),
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
  // Guard against corrupt third-party mappings (e.g. Witch Hat Atelier,
  // kitsu:46043, where AniZip key 2 duplicates key 1's tvdbId/abs and keys
  // 3..13 shift by -1). Stale tvdbIds outrank correct streaming pairs during
  // season matching, so the shifted episode steals the slot and the correct
  // one falls through to Extras. Track ids already owned across the pool so a
  // duplicate is never applied twice, even if this merge runs more than once.
  const tvdbOwned = new Map<number, number>();
  const absOwned = new Map<number, number>();
  for (const ep of episodes) {
    if (ep.tvdbEpisodeId != null) tvdbOwned.set(ep.tvdbEpisodeId, (tvdbOwned.get(ep.tvdbEpisodeId) ?? 0) + 1);
    if (ep.absoluteNumber != null) absOwned.set(ep.absoluteNumber, (absOwned.get(ep.absoluteNumber) ?? 0) + 1);
  }
  const hxHGuard = isHunterXHunter2011(aniZip);
  for (const ep of episodes) {
    const az = aniZip.episodes[String(ep.number)];
    if (!az) continue;
    if (localized) {
      const localizedTitle = pickLocalizedTitle(az, opts?.lang);
      if (localizedTitle && !isGenericEpisodeName(localizedTitle) && isTextInLanguage(localizedTitle, opts?.lang)) {
        ep.title = localizedTitle;
      } else {
        const enTitle = az.titles?.en ?? az.title?.en;
        if (enTitle && !isGenericEpisodeName(enTitle)) ep.title = enTitle;
      }
    } else {
      // English target: only an English name is acceptable. A romaji (`x-jat`)
      // or Japanese original must not fill the row — leaving it generic lets
      // TVDB/TMDB/MAL supply the English name.
      const enTitle = az.titles?.en ?? az.title?.en;
      if (
        enTitle &&
        !isGenericEpisodeName(enTitle) &&
        (!ep.title || ep.title === `Episode ${ep.number}`)
      ) {
        ep.title = enTitle;
      }
    }
    if (az.overview && !ep.synopsis && (!localized || isTextInLanguage(az.overview, opts?.lang))) {
      ep.synopsis = az.overview;
    }
    const hxHMismatch =
      hxHGuard && az.absoluteEpisodeNumber != null && az.absoluteEpisodeNumber !== ep.number;
    if (hxHMismatch) {
      if (az.runtime && !ep.length) ep.length = az.runtime;
      if (az.filler) ep.filler = true;
      continue;
    }
    if (az.image) {
      if (ep.thumbnail && ep.thumbnail !== az.image && !ep.thumbnailFallback) {
        ep.thumbnailFallback = ep.thumbnail;
      }
      ep.thumbnail = az.image;
    }
    const azAir = az.airDate ?? az.airdate;
    if (azAir) ep.airdate = azAir;
    if (az.runtime && !ep.length) ep.length = az.runtime;
    if (az.filler) ep.filler = true;
    // Same-season mismatch means this record's ids belong to another episode
    // (shifted mapping): applying them would steal a TVDB slot. Multi-cour
    // entries legitimately differ across seasons, so only same-season
    // mismatches are skipped. Specials (season 0) never apply to regular eps.
    const epSeason = ep.imdbSeason ?? ep.seasonNumber ?? 1;
    const epNum = ep.imdbEpisode ?? ep.number;
    const azSeason = az.seasonNumber;
    const shifted =
      (azSeason === 0 && epSeason >= 1) ||
      (azSeason != null &&
        azSeason >= 1 &&
        azSeason === epSeason &&
        az.episodeNumber != null &&
        epNum != null &&
        az.episodeNumber !== epNum);
    let applyIds = !shifted;
    if (applyIds && az.tvdbId && (tvdbOwned.get(az.tvdbId) ?? 0) > (ep.tvdbEpisodeId === az.tvdbId ? 1 : 0)) {
      applyIds = false;
    }
    if (
      applyIds &&
      az.absoluteEpisodeNumber &&
      (absOwned.get(az.absoluteEpisodeNumber) ?? 0) > (ep.absoluteNumber === az.absoluteEpisodeNumber ? 1 : 0)
    ) {
      applyIds = false;
    }
    if (applyIds) {
      if (az.absoluteEpisodeNumber) {
        ep.absoluteNumber = az.absoluteEpisodeNumber;
        absOwned.set(az.absoluteEpisodeNumber, (absOwned.get(az.absoluteEpisodeNumber) ?? 0) + 1);
      }
      if (az.tvdbId) {
        ep.tvdbEpisodeId = az.tvdbId;
        tvdbOwned.set(az.tvdbId, (tvdbOwned.get(az.tvdbId) ?? 0) + 1);
      }
    }
    if (ep.rating == null && az.rating != null) {
      const r = Number(az.rating);
      if (Number.isFinite(r) && r > 0) ep.rating = r;
    }
    if (az.seasonNumber != null && az.seasonNumber >= 0 && az.episodeNumber != null) {
      if (azImdb) ep.imdbId = azImdb;
      if (!shifted) {
        if (ep.imdbSeason == null) ep.imdbSeason = az.seasonNumber;
        if (ep.imdbEpisode == null) ep.imdbEpisode = az.episodeNumber;
      }
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
    const hasProviderIdentity =
      ep.tvdbEpisodeId != null ||
      ep.absoluteNumber != null ||
      (ep.imdbSeason != null && ep.imdbEpisode != null);

    if (ep.tvdbEpisodeId) tvdbEp = tvdbById.get(ep.tvdbEpisodeId);
    if (!tvdbEp && ep.absoluteNumber) tvdbEp = tvdbByAbsolute.get(ep.absoluteNumber);
    if (!tvdbEp && ep.imdbSeason != null && ep.imdbEpisode != null) {
      tvdbEp = tvdbBySeasonAndEpisode.get(`${ep.imdbSeason}:${ep.imdbEpisode}`);
    }
    // A cour's native S1E1 is not the franchise's S1E1. A missing mapped
    // episode must not replace its existing artwork with an earlier season.
    if (!tvdbEp && !hasProviderIdentity) {
      tvdbEp = tvdbBySeasonAndEpisode.get(`${ep.seasonNumber}:${ep.number}`);
    }

    if (tvdbEp) {
      const foreignPoolTitle =
        !localized &&
        !isTextInUserLanguage(ep.title, opts?.targetLang) &&
        isForeignScriptTitle(ep.title);
      if (
        tvdbEp.name &&
        !isGenericEpisodeName(tvdbEp.name) &&
        (localized || !ep.title || ep.title === `Episode ${ep.number}` || foreignPoolTitle)
      ) {
        const acceptable = localized
          ? isTextInLanguage(tvdbEp.name, opts?.lang)
          : !isForeignScriptTitle(tvdbEp.name);
        if (acceptable) ep.title = tvdbEp.name;
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
  const byPair = new Map<string, TmdbEpisode>();
  for (const e of tmdbEps) {
    byPair.set(`${e.seasonNumber}:${e.episodeNumber}`, e);
  }
  for (const ep of episodes) {
    // Prefer matching by AniZip's TMDB season+episode pair (normal multi-season shows where
    // each season restarts numbering). When TMDB merged cours into one generalized season 1
    // (episodeNumber == absolute position), fall back to the AniZip absolute episode number.
    // The Kitsu seasonNumber:number pair is unreliable for anime (franchise entries often
    // report season 1 for every cour), so only use it when no AniZip mapping is available.
    const hasAzMapping = ep.imdbSeason != null && ep.imdbEpisode != null;
    const tmdbEp =
      byPair.get(`${ep.imdbSeason}:${ep.imdbEpisode}`) ??
      (ep.absoluteNumber != null ? byPair.get(`1:${ep.absoluteNumber}`) : undefined) ??
      (!hasAzMapping && ep.absoluteNumber == null
        ? byPair.get(`${ep.seasonNumber}:${ep.number}`)
        : undefined);
    if (!tmdbEp) continue;
    const foreignPoolTitle =
      !localized &&
      !isTextInUserLanguage(ep.title, opts?.targetLang) &&
      isForeignScriptTitle(ep.title);
    if (
      tmdbEp.name &&
      !isGenericEpisodeName(tmdbEp.name) &&
      (localized || !ep.title || ep.title === `Episode ${ep.number}` || foreignPoolTitle)
    ) {
      const acceptable = localized
        ? isTextInLanguage(tmdbEp.name, opts?.lang)
        : !isForeignScriptTitle(tmdbEp.name);
      if (acceptable) ep.title = tmdbEp.name;
    }
    if (tmdbEp.overview && (localized || !ep.synopsis)) {
      if (!localized || isTextInLanguage(tmdbEp.overview, opts?.lang)) {
        ep.synopsis = tmdbEp.overview;
      }
    }
  }
}
