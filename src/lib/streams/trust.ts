import type { ParsedStream, Resolution } from "./types";
import { episodeSpanContains } from "@/lib/episode-span";
export type { Resolution };

export type TrustOptions = {
  kind?: "movie" | "series";
  expectedTitle?: string | null;
  expectedYear?: number | null;
  expectedSeason?: number | null;
  expectedEpisode?: number | null;
  releaseDate?: string | null;
  allowSeasonPacks?: boolean;
  allowCam?: boolean;
  allowSizeOutliers?: boolean;
  strict?: boolean;
  disabled?: boolean;
  preferredLanguages?: string[];
  preferredAudioLangs?: string[];
  requirePreferredLanguage?: boolean;
  isAnime?: boolean;
  expectedTitles?: string[] | null;
};

export type Rejection = {
  stream: ParsedStream;
  reason: string;
};

const FILENAME_BLACKLIST = [".exe", ".zip", ".rar", ".lnk", ".scr", ".bat", ".iso", ".img"];
const TRAILER_RX =
  /(?<![A-Za-z0-9])(?:trailer|teaser|tlr|trl|tra(?:iler)?|sneak[\s.\-_]?peek|preview|behind[\s.\-_]?the[\s.\-_]?scenes|featurette|making[\s.\-_]?of|deleted[\s.\-_]?scene|bloopers?|gag[\s.\-_]?reel|extras?|promo)(?![A-Za-z0-9])/i;
const PLACEHOLDER_BANNER_RX =
  /(?:🚫|⚠️?|❗|ℹ️?)\s*(?:no\s+streams?\s+(?:found|available)|streams?\s+filtered|streams?\s+blocked|filtered)/iu;
const STATUS_LINE_RX =
  /\b(?:expires?\s+in|days?\s+left|premium\s+(?:active|expir(?:ed|ing))|api\s+limit|quota\s+used)\b/i;
const TINY_STUB_FLOOR = 5 * 1024 ** 2;

// Notorious fake/scam release groups. These uploaders only ever post fakes
// (malware stubs, mislabeled ad-trailer reuploads), so they are rejected
// regardless of the cinema window. Scene-style tags are matched against the
// PARSED release group only (never free title text) so a legit title that
// merely contains a common word like "rude" is never nuked. The multi-word
// ad-studio brands are matched as word-boundary phrases in the haystack because
// they are rarely parsed as a clean release-group token.
const FAKE_GROUP_TOKENS = new Set([
  "LAMA",
  "DJT",
  "TELLY",
  "RUDE",
  "TELESYNC",
  "TELESYNCH",
  "DRAGONMONEY",
]);
const FAKE_STUDIO_RX = /(?:^|[^a-z0-9])(?:dragon[\s._-]?money|telesynch)(?:$|[^a-z0-9])/i;

const MIB = 1024 ** 2;
const GIB = 1024 ** 3;

const MOVIE_MIN_SIZE: Record<Resolution, [number, number, number]> = {
  "4K": [Math.round(2.5 * GIB), Math.round(1.5 * GIB), 600 * MIB],
  "1080p": [Math.round(1.2 * GIB), 700 * MIB, 250 * MIB],
  "720p": [600 * MIB, 400 * MIB, 120 * MIB],
  "480p": [250 * MIB, 150 * MIB, 50 * MIB],
  SD: [200 * MIB, 100 * MIB, 25 * MIB],
};

const EPISODE_MIN_SIZE: Record<Resolution, [number, number, number]> = {
  "4K": [Math.round(1.0 * GIB), 600 * MIB, 200 * MIB],
  "1080p": [400 * MIB, 250 * MIB, 100 * MIB],
  "720p": [200 * MIB, 120 * MIB, 40 * MIB],
  "480p": [80 * MIB, 50 * MIB, 12 * MIB],
  SD: [50 * MIB, 30 * MIB, 8 * MIB],
};

const ANIME_EPISODE_MIN_SIZE: Record<Resolution, [number, number, number]> = {
  "4K": [600 * MIB, 400 * MIB, 150 * MIB],
  "1080p": [220 * MIB, 150 * MIB, 50 * MIB],
  "720p": [100 * MIB, 60 * MIB, 20 * MIB],
  "480p": [40 * MIB, 28 * MIB, 8 * MIB],
  SD: [25 * MIB, 18 * MIB, 5 * MIB],
};

export function applyTrust(
  streams: ParsedStream[],
  opts: TrustOptions = {},
): { keep: ParsedStream[]; rejected: Rejection[] } {
  if (opts.disabled) {
    return { keep: streams.slice(), rejected: [] };
  }
  const keep: ParsedStream[] = [];
  const rejected: Rejection[] = [];
  const inCinemaWindow = isInCinemaWindow(opts.releaseDate);
  const olderCatalog = isOlderCatalog(opts.releaseDate, opts.expectedYear);
  const strict = opts.strict ?? true;
  for (const s of streams) {
    const reason = checkOne(s, opts, strict, inCinemaWindow, olderCatalog);
    if (reason) rejected.push({ stream: s, reason });
    else keep.push(s);
  }
  return { keep, rejected };
}

const SHORT_FORMAT_RX =
  /\b(short|shorts|mini|mini[\s.\-_]?episode|ova|special|specials|skit|sketch|chibi|micro|webisode|vignette|interlude)\b/i;

function isShortFormat(s: ParsedStream): boolean {
  const filenameRaw = s.behaviorHints?.filename ?? s.behaviorHints?.fileName ?? "";
  const haystack = `${filenameRaw} ${s.title ?? ""} ${s.name ?? ""}`;
  return SHORT_FORMAT_RX.test(haystack);
}

function pickFloor(
  table: Record<Resolution, [number, number, number]>,
  resolution: Resolution,
  inCinemaWindow: boolean,
  olderCatalog: boolean,
): number {
  const [cinema, normal, older] = table[resolution] ?? table.SD;
  if (olderCatalog) return older;
  if (inCinemaWindow) return cinema;
  return normal;
}

function checkOne(
  s: ParsedStream,
  opts: TrustOptions,
  strict: boolean,
  inCinemaWindow: boolean,
  olderCatalog: boolean,
): string | null {
  const hasPlayableUrl = !!s.url || !!s.infoHash || !!s.ytId || !!s.externalUrl || !!s.nzbUrl;
  const titleNameDesc = `${s.title ?? ""} ${s.name ?? ""} ${s.description ?? ""}`;
  if (!hasPlayableUrl) {
    return "no-playable-source";
  }
  if (PLACEHOLDER_BANNER_RX.test(titleNameDesc)) {
    return "addon-placeholder-banner";
  }
  if (!s.infoHash && !s.url?.match(/\.(mkv|mp4|m4v|avi|webm|mov|ts)(?:\?|$)/i)) {
    if (
      STATUS_LINE_RX.test(titleNameDesc) &&
      !s.behaviorHints?.videoSize &&
      !s.behaviorHints?.filename
    ) {
      return "addon-status-card";
    }
  }

  const filenameRaw = s.behaviorHints?.filename ?? s.behaviorHints?.fileName ?? "";
  const filename = filenameRaw.toLowerCase();
  const haystack = `${filename} ${s.title ?? ""} ${s.name ?? ""}`.toLowerCase();
  for (const ext of FILENAME_BLACKLIST) {
    if (filename.endsWith(ext)) return `suspicious-extension:${ext}`;
  }

  if (TRAILER_RX.test(haystack)) {
    return "trailer-or-extra";
  }

  if (
    (s.releaseGroupNormalized != null && FAKE_GROUP_TOKENS.has(s.releaseGroupNormalized)) ||
    FAKE_STUDIO_RX.test(haystack)
  ) {
    return "known-fake-group";
  }

  if (s.size != null && s.size < TINY_STUB_FLOOR) {
    return "size-stub";
  }

  if (opts.kind === "movie" && s.size != null) {
    const floor = pickFloor(MOVIE_MIN_SIZE, s.resolution, inCinemaWindow, olderCatalog);
    if (s.size < floor) return `movie-stub-too-small-for-${s.resolution}`;
  }

  if (
    opts.kind === "movie" &&
    s.size != null &&
    inCinemaWindow &&
    s.source !== "CAM" &&
    s.source !== "TS" &&
    s.source !== "HDTS" &&
    s.source !== "TC"
  ) {
    const sizeMB = s.size / MIB;
    if (sizeMB < 250) return `new-release-virus-${Math.round(sizeMB)}mb`;
    if (sizeMB < 500 && !isShortFormat(s)) {
      return `new-release-stub-${Math.round(sizeMB)}mb`;
    }
  }

  if (opts.kind === "movie" && !opts.isAnime) {
    if (s.seasonPack || s.season != null || s.episode != null) {
      return "series-result-for-movie";
    }
  }

  if (
    strict &&
    opts.kind === "movie" &&
    !opts.isAnime &&
    inCinemaWindow &&
    opts.expectedYear != null &&
    s.year == null &&
    s.source === "Other" &&
    s.resolution === "SD"
  ) {
    return "cinema-bare-untagged";
  }

  if (strict && opts.kind === "movie" && opts.expectedTitle && s.parsedTitle) {
    if (!titleMatches(opts.expectedTitle, s.parsedTitle, s.year, opts.expectedYear ?? null)) {
      return "title-mismatch";
    }
  }

  if (
    strict &&
    opts.kind === "movie" &&
    inCinemaWindow &&
    opts.expectedYear != null &&
    s.year != null &&
    s.year !== opts.expectedYear
  ) {
    return `cinema-year-mismatch:${s.year}-vs-${opts.expectedYear}`;
  }

  if (strict && opts.kind === "movie" && opts.expectedTitle) {
    const expectedSeq = sequelMarker(opts.expectedTitle);
    if (expectedSeq != null && expectedSeq >= 2) {
      const filename = s.behaviorHints?.filename ?? s.behaviorHints?.fileName ?? "";
      const haystack = `${filename} ${s.title ?? ""}`.toLowerCase();
      if (!haystackHasSequelToken(haystack, expectedSeq)) {
        return "filename-missing-sequel";
      }
    }
  }

  if (strict && opts.kind === "movie" && inCinemaWindow) {
    if (s.source === "BluRay" || s.remux) {
      return "fresh-cinema-fake-bluray";
    }
    if (
      s.resolution === "4K" &&
      (s.source === "WEB-DL" ||
        s.source === "WEBRip" ||
        s.source === "BDRip" ||
        s.source === "HDRip")
    ) {
      return "fresh-cinema-fake-4k-web";
    }
    if (
      (s.resolution === "1080p" || s.resolution === "720p") &&
      (s.source === "WEB-DL" ||
        s.source === "WEBRip" ||
        s.source === "BDRip" ||
        s.source === "HDRip")
    ) {
      return "fresh-cinema-fake-web";
    }
    if (s.source === "HDTV" && (s.resolution === "4K" || s.resolution === "1080p")) {
      return "fresh-cinema-fake-hdtv";
    }
  }

  if (opts.kind === "series" && s.size != null && !isShortFormat(s)) {
    const table = opts.isAnime ? ANIME_EPISODE_MIN_SIZE : EPISODE_MIN_SIZE;
    const floor = pickFloor(table, s.resolution, inCinemaWindow, olderCatalog);
    if (s.size < floor) return `episode-stub-too-small-for-${s.resolution}`;
  }

  if (strict && opts.kind === "series" && !opts.isAnime && opts.expectedTitle && s.parsedTitle) {
    if (!titleMatches(opts.expectedTitle, s.parsedTitle, s.year, opts.expectedYear ?? null)) {
      return "title-mismatch";
    }
  }

  if (
    strict &&
    opts.kind === "series" &&
    opts.isAnime &&
    opts.expectedTitles != null &&
    opts.expectedTitles.length > 0 &&
    s.parsedTitle
  ) {
    const ok = opts.expectedTitles.some((t) => titleTokensPresent(t, s.parsedTitle!));
    if (!ok) return "anime-title-mismatch";
  }

  const hasFileIdx = s.fileIdx != null;

  if (
    strict &&
    !opts.isAnime &&
    !hasFileIdx &&
    opts.expectedSeason != null &&
    s.season != null &&
    s.season !== opts.expectedSeason &&
    !s.seasonPack
  ) {
    return `season-mismatch:${s.season}-vs-${opts.expectedSeason}`;
  }

  if (
    strict &&
    !opts.isAnime &&
    !hasFileIdx &&
    !s.seasonPack &&
    opts.expectedEpisode != null &&
    s.episode != null &&
    !episodeSpanContains(s, opts.expectedSeason ?? s.season ?? 0, opts.expectedEpisode)
  ) {
    return `episode-mismatch:${s.episode}-vs-${opts.expectedEpisode}`;
  }

  if (s.scamScore >= 5 && !opts.allowCam && !olderCatalog) {
    return `scam-score-${s.scamScore}`;
  }

  return null;
}

const ROMAN_TO_NUM: Record<string, number> = {
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
};

const TITLE_STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "and",
  "in",
  "to",
  "for",
  "on",
  "at",
  "by",
  "is",
  "or",
  "as",
  "from",
  "with",
  "into",
  "movie",
  "film",
]);

const NUM_TO_ROMAN: Record<number, string> = {
  2: "ii",
  3: "iii",
  4: "iv",
  5: "v",
  6: "vi",
  7: "vii",
  8: "viii",
  9: "ix",
  10: "x",
};
const NUM_TO_WORD: Record<number, string> = {
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
  7: "seven",
  8: "eight",
  9: "nine",
  10: "ten",
};

function haystackHasSequelToken(haystack: string, expectedSeq: number): boolean {
  const tokens = haystack.match(/[a-z0-9]+/gi) ?? [];
  const lower = tokens.map((t) => t.toLowerCase());
  const digit = expectedSeq.toString();
  const roman = NUM_TO_ROMAN[expectedSeq];
  const word = NUM_TO_WORD[expectedSeq];
  for (const tok of lower) {
    if (tok === digit) return true;
    if (roman && tok === roman) return true;
    if (word && tok === word) return true;
  }
  return false;
}

const NUMBER_NAME_TAIL_RX = /(?:\bno\.?|\bnr\.?|\bnumber|#|n°|№)\s*(?:\d{1,2}|[ivx]+)\s*$/i;

function sequelMarker(title: string): number | null {
  const cleaned = title.replace(/\(\d{4}\)/g, "").replace(/\b(part|chapter|vol|volume)\b/gi, "");
  const trimmed = cleaned.trim();
  if (NUMBER_NAME_TAIL_RX.test(trimmed)) return null;
  const m = trimmed.match(/(?:\s|^)(\d{1,2}|[ivx]+)\s*$/i);
  if (!m) return null;
  const tok = m[1].toLowerCase();
  if (/^\d+$/.test(tok)) {
    const n = parseInt(tok, 10);
    if (n >= 2 && n <= 20) return n;
    return null;
  }
  return ROMAN_TO_NUM[tok] ?? null;
}

function tokenize(text: string): string[] {
  const lower = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
  const words = lower.match(/[a-z0-9]+/g) ?? [];
  return words.filter((w) => w.length >= 3 && !TITLE_STOPWORDS.has(w));
}

function countOverlap(words: string[], lookup: Set<string>): number {
  let hits = 0;
  for (const w of words) {
    if (lookup.has(w)) {
      hits++;
      continue;
    }
    for (const l of lookup) {
      if (w.length >= 4 && l.length >= 4 && (w.startsWith(l) || l.startsWith(w))) {
        hits++;
        break;
      }
    }
  }
  return hits;
}

export function titleMatches(
  expected: string,
  parsed: string,
  parsedYear: number | null,
  expectedYear: number | null,
): boolean {
  const expectedSeq = sequelMarker(expected);
  const parsedSeq = sequelMarker(parsed);
  const yearTolerance = yearToleranceFor(expectedYear);
  if (expectedSeq != null && parsedSeq != null && parsedSeq !== expectedSeq) return false;
  if (expectedSeq != null && parsedSeq == null) {
    if (parsedYear == null || expectedYear == null) return false;
    if (Math.abs(parsedYear - expectedYear) > yearTolerance) return false;
  }
  if (expectedSeq == null && parsedSeq != null && parsedSeq >= 2) {
    if (parsedYear == null || expectedYear == null) return false;
    if (Math.abs(parsedYear - expectedYear) > yearTolerance) return false;
  }
  const expectedTokens = tokenize(expected);
  const parsedTokens = tokenize(parsed);
  if (expectedTokens.length === 0 || parsedTokens.length === 0) return true;
  const expectedSet = new Set(expectedTokens);
  const parsedSet = new Set(parsedTokens);
  const overlap = countOverlap(expectedTokens, parsedSet);
  const reverseOverlap = countOverlap(parsedTokens, expectedSet);
  const expectedRatio = overlap / expectedTokens.length;
  const parsedRatio = reverseOverlap / parsedTokens.length;
  // Short-title guard: when the expected title is 1-2 tokens (e.g. "Obsession"),
  // a parsed file like "DBM OBSESSION - Viva Las Vegas" technically overlaps on
  // "obsession" but has 4+ extra tokens that don't belong. Reject those before
  // they leak in as movie matches.
  if (expectedTokens.length <= 2 && parsedTokens.length - overlap > 2) {
    return false;
  }
  return expectedRatio >= 0.5 || parsedRatio >= 0.5 || overlap >= 2;
}

export function titleTokensPresent(expected: string, parsed: string): boolean {
  const expectedTokens = tokenize(expected);
  const parsedTokens = tokenize(parsed);
  if (expectedTokens.length === 0 || parsedTokens.length === 0) return true;
  const expectedSet = new Set(expectedTokens);
  const parsedSet = new Set(parsedTokens);
  const overlap = countOverlap(expectedTokens, parsedSet);
  const reverseOverlap = countOverlap(parsedTokens, expectedSet);
  const expectedRatio = overlap / expectedTokens.length;
  const parsedRatio = reverseOverlap / parsedTokens.length;
  return expectedRatio >= 0.5 || parsedRatio >= 0.5 || overlap >= 2;
}

function yearToleranceFor(expectedYear: number | null): number {
  if (expectedYear == null) return 1;
  const age = new Date().getFullYear() - expectedYear;
  if (age >= 30) return 4;
  if (age >= 15) return 3;
  if (age >= 5) return 2;
  return 1;
}

function isInCinemaWindow(releaseDate?: string | null): boolean {
  if (!releaseDate) return false;
  const d = new Date(releaseDate);
  if (Number.isNaN(d.getTime())) return false;
  const days = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
  return days > -90 && days < 60;
}

function isOlderCatalog(releaseDate?: string | null, expectedYear?: number | null): boolean {
  if (releaseDate) {
    const d = new Date(releaseDate);
    if (!Number.isNaN(d.getTime())) {
      const days = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
      return days > 365 * 2;
    }
  }
  if (expectedYear != null) {
    return new Date().getFullYear() - expectedYear > 2;
  }
  return false;
}
