import type { DefaultParserResult } from "parse-torrent-title";
import type { Container, Resolution, Source } from "../types";

const CONTAINER_RX = /\.(mkv|mp4|m4v|avi|webm|mov|ts|wmv)\b/i;
const SIZE_RX = /(\d+(?:\.\d+)?)\s*(GB|MB|TB|GiB|MiB|TiB)\b/i;
const SEEDERS_RX = /(?:👥|👤|S:|seeds?:?|\bS\s*=\s*)\s*(\d+)/i;
const ANIME_HASH_RX = /\[([0-9A-F]{8})\]/i;
const REPACK_RX = /\bREPACK(\d+)?\b/i;
const YEAR_RANGE_RX = /\b(19\d\d|20\d\d)[\-\.](19\d\d|20\d\d)\b/;
const DISC_RX = /\bDISC\s*(\d+)\b/i;
const EDITION_RX =
  /\b(IMAX|EXTENDED|DIRECTORS?[.\s]?CUT|THEATRICAL|UNRATED|UNCUT|REMASTERED|RESTORATION|CRITERION|OPEN[.\s]?MATTE|HYBRID)\b/i;

const QUALITY_STOP_RX =
  /\.(?:480p|576p|720p|1080p|1440p|2160p|4k|uhd|hdr|hdr10|dv|dovi|bluray|bdrip|brrip|web[\.\-]?dl|webrip|hdrip|hdtv|remux|cam|ts|hdts|tc|scr|x264|x265|hevc|avc|h\.?264|h\.?265|av1|aac|ac3|ddp?|eac3|dts|truehd|atmos|flac|opus|10bit|8bit|repack|proper|extended|directors?|imax|hybrid|hdr10\+|repack\d?|multi|dual|dubbed|sub|subbed|complete|amzn|nf|hulu|max|atvp|dsnp)/i;

export function parseEpisodeTitle(
  filename: string,
  season?: number,
  episode?: number,
): string | null {
  if (season == null || episode == null) return null;
  const code = `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
  const idx = filename.toUpperCase().indexOf(code);
  if (idx < 0) return null;
  let after = filename.slice(idx + code.length).replace(/^[\.\-_\s]+/, "");
  const stop = after.search(QUALITY_STOP_RX);
  if (stop > 0) after = after.slice(0, stop);
  const cleaned = after
    .replace(/[\.\-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 2 || cleaned.length > 80) return null;
  if (/^(?:e\d+|episode|hdtv|webrip)$/i.test(cleaned)) return null;
  return cleaned;
}

export function parseContainer(
  filenameHint: string | undefined,
  filenameLine: string,
  text: string,
): Container | null {
  for (const src of [filenameHint, filenameLine, text]) {
    if (!src) continue;
    const m = src.match(CONTAINER_RX);
    if (m) return m[1].toLowerCase() as Container;
  }
  return null;
}

export function parseSize(text: string, hint?: number): number | null {
  if (hint && hint > 0) return hint;
  const m = text.match(SIZE_RX);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit.startsWith("t")) return Math.round(n * 1024 ** 4);
  if (unit.startsWith("g")) return Math.round(n * 1024 ** 3);
  if (unit.startsWith("m")) return Math.round(n * 1024 ** 2);
  return null;
}

export function parseSeeders(text: string): number | null {
  const m = text.match(SEEDERS_RX);
  return m ? Number(m[1]) : null;
}

export function parseEdition(text: string, ptt: DefaultParserResult): string | null {
  if (ptt.extended) return "EXTENDED";
  if (ptt.unrated) return "UNRATED";
  if (ptt.theatrical) return "THEATRICAL";
  if (ptt.uncut) return "UNCUT";
  if (ptt.remastered) return "REMASTERED";
  if (ptt.criterion) return "CRITERION";
  if (ptt.openmatte) return "OPEN MATTE";
  const m = text.match(EDITION_RX);
  if (!m) return null;
  return m[1].toUpperCase().replace(/[\.\s]+/g, " ");
}

export function parseYearRange(text: string): [number, number] | null {
  const m = text.match(YEAR_RANGE_RX);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (b - a > 0 && b - a < 30) return [a, b];
  return null;
}

export function parseSeasonPack(text: string, ptt: DefaultParserResult): boolean {
  if (ptt.season != null && ptt.episode == null) {
    return /\b(complete|season[\s\.]?pack|s\d{1,2}\b(?!e))\b/i.test(text);
  }
  return false;
}

export function parseDisc(text: string): number | null {
  const m = text.match(DISC_RX);
  return m ? Number(m[1]) : null;
}

export function parseRepackIteration(text: string, ptt: DefaultParserResult): number {
  const m = text.match(REPACK_RX);
  if (!m) return ptt.repack ? 1 : 0;
  return m[1] ? Number(m[1]) : 1;
}

export function parseAnimeHash(text: string): string | null {
  const m = text.match(ANIME_HASH_RX);
  return m ? m[1].toUpperCase() : null;
}

export function computeScamScore(
  source: Source,
  resolution: Resolution,
  size: number | null,
): number {
  let s = 0;
  if (resolution === "4K" && size != null && size < 5 * 1024 ** 3) s += 3;
  if (resolution === "1080p" && size != null && size < 700 * 1024 ** 2) s += 3;
  if (resolution === "720p" && size != null && size < 250 * 1024 ** 2) s += 3;
  if (resolution === "SD" && size != null && size < 250 * 1024 ** 2) s += 3;
  if (resolution === "SD" && source === "Other") s += 2;
  return s;
}
