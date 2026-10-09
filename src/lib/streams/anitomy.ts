import type { ParsedStream, Resolution } from "./types";

type AnitomyFields = {
  animeTitle?: string;
  episodeNumber?: number;
  episodeTitle?: string;
  season?: number;
  year?: number;
  releaseGroup?: string;
  resolution?: Resolution;
  fileChecksum?: string;
  isBatch?: boolean;
};

export async function enhanceAnimeStreams(streams: ParsedStream[]): Promise<void> {
  for (const s of streams) {
    const filename = primaryFilename(s);
    if (!filename) continue;
    const r = parseAnimeFilename(filename);
    if (r.animeTitle) s.parsedTitle = r.animeTitle;
    if (r.episodeNumber != null) s.episode = r.episodeNumber;
    if (r.episodeTitle) s.episodeTitle = r.episodeTitle;
    if (r.season != null) s.season = r.season;
    if (r.year != null) s.year = r.year;
    if (r.releaseGroup) {
      s.releaseGroup = r.releaseGroup;
      s.releaseGroupNormalized = r.releaseGroup.toUpperCase().replace(/[^A-Z0-9]/g, "");
    }
    if (r.resolution) s.resolution = r.resolution;
    if (r.fileChecksum) s.animeHash = r.fileChecksum;
    if (r.isBatch) s.seasonPack = true;
  }
}

function primaryFilename(s: ParsedStream): string {
  return s.behaviorHints?.filename ?? extractFilenameLine(s) ?? s.title ?? s.name ?? "";
}

function extractFilenameLine(s: ParsedStream): string | null {
  const blocks = [s.title, s.description, s.name].filter(Boolean) as string[];
  for (const b of blocks) {
    for (const line of b.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (/\.(mkv|mp4|m4v|avi|webm|mov|ts|wmv)\b/i.test(trimmed)) return trimmed;
    }
  }
  return null;
}

const RESOLUTION_RX = /\b(2160p|1080p|720p|480p|4k|uhd)\b/i;
const HASH_RX = /\[([0-9A-Fa-f]{8})\]/;
const SEASON_EP_RX = /\b[Ss](\d{1,2})[\s._-]?[Ee](\d{1,4})\b/;
const SEASON_ONLY_RX = /\b(?:Season|S)[\s._-]?(\d{1,2})\b/i;
const YEAR_RX = /(?:^|[^\d])((?:19|20)\d{2})(?:[^\d]|$)/;
const RELEASE_GROUP_DASH_RX = /-([A-Za-z0-9_]+)(?:\.[a-z0-9]{2,4})?$/i;
const ANIME_EP_RX = /(?:^|[\s._-])(?:Ep?(?:isode)?[\s._-]?)?(\d{1,4})(?:v\d)?(?=\s*(?:\[|\(|$|[\s._-]))/i;
const BATCH_RX = /\b(?:BATCH|COMPLETE|SEASON\s*PACK)\b/i;
const RANGE_RX = /\b(\d{1,4})\s*[-~]\s*(\d{1,4})\b/;

function parseAnimeFilename(raw: string): AnitomyFields {
  const out: AnitomyFields = {};
  let working = raw;

  const extMatch = working.match(/\.(mkv|mp4|m4v|avi|webm|mov|ts|wmv)$/i);
  if (extMatch) working = working.slice(0, -extMatch[0].length);

  const groupHead = working.match(/^\[([^\]]+)\]\s*/);
  if (groupHead) {
    out.releaseGroup = groupHead[1].trim();
    working = working.slice(groupHead[0].length);
  }

  const hash = working.match(HASH_RX);
  if (hash) {
    out.fileChecksum = hash[1].toUpperCase();
    working = working.replace(hash[0], " ");
  }

  const res = working.match(RESOLUTION_RX);
  if (res) out.resolution = mapResolution(res[1]);

  const yearM = working.match(YEAR_RX);
  if (yearM) {
    const y = parseInt(yearM[1], 10);
    if (y >= 1900 && y <= 2100) out.year = y;
  }

  const sxe = working.match(SEASON_EP_RX);
  if (sxe) {
    out.season = parseInt(sxe[1], 10);
    out.episodeNumber = parseInt(sxe[2], 10);
  } else {
    const seasonOnly = working.match(SEASON_ONLY_RX);
    if (seasonOnly) out.season = parseInt(seasonOnly[1], 10);
  }

  const stripped = working
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (out.episodeNumber == null) {
    const dash = stripped.match(/\s-\s(\d{1,4})(?:v\d)?(?:\s|$)/);
    if (dash) {
      out.episodeNumber = parseInt(dash[1], 10);
    } else {
      const anime = stripped.match(ANIME_EP_RX);
      if (anime) out.episodeNumber = parseInt(anime[1], 10);
    }
  }

  if (out.releaseGroup == null) {
    const dashTail = working.match(RELEASE_GROUP_DASH_RX);
    if (dashTail && !/^\d+$/.test(dashTail[1])) out.releaseGroup = dashTail[1];
  }

  if (BATCH_RX.test(working)) {
    out.isBatch = true;
  } else {
    const range = stripped.match(RANGE_RX);
    if (range) {
      const lo = parseInt(range[1], 10);
      const hi = parseInt(range[2], 10);
      if (Number.isFinite(lo) && Number.isFinite(hi) && hi - lo >= 2 && hi <= 999) {
        out.isBatch = true;
      }
    }
  }

  out.animeTitle = extractTitle(stripped, out);
  out.episodeTitle = extractEpisodeTitle(stripped, out);

  return out;
}

function extractTitle(stripped: string, fields: AnitomyFields): string | undefined {
  let s = stripped;
  if (fields.episodeNumber != null) {
    const dashIdx = s.search(new RegExp(`\\s-\\s${fields.episodeNumber}(?:v\\d)?(?:\\s|$)`));
    if (dashIdx > 0) s = s.slice(0, dashIdx);
  }
  s = s.replace(SEASON_EP_RX, " ").replace(SEASON_ONLY_RX, " ");
  s = s.replace(RESOLUTION_RX, " ");
  s = s.replace(/\.(mkv|mp4|m4v|avi|webm|mov|ts|wmv)$/i, "");
  s = s.replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return undefined;
  if (s.length < 2) return undefined;
  return s;
}

function extractEpisodeTitle(stripped: string, fields: AnitomyFields): string | undefined {
  if (fields.episodeNumber == null) return undefined;
  const ep = String(fields.episodeNumber);
  const idx = stripped.search(new RegExp(`\\s-\\s${ep}(?:v\\d)?(\\s+-\\s+)`));
  if (idx < 0) return undefined;
  const after = stripped.slice(idx).match(new RegExp(`\\s-\\s${ep}(?:v\\d)?\\s+-\\s+(.+)`));
  if (!after) return undefined;
  const title = after[1].split(/\s+\[/)[0].trim();
  if (!title || title.length < 2) return undefined;
  return title;
}

function mapResolution(v: string): Resolution {
  const x = v.toLowerCase();
  if (x.startsWith("2160") || x === "4k" || x === "uhd") return "4K";
  if (x.startsWith("1080")) return "1080p";
  if (x.startsWith("720")) return "720p";
  if (x.startsWith("480")) return "480p";
  return "SD";
}
