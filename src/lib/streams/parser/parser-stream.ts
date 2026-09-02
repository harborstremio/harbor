import { parse, type DefaultParserResult } from "parse-torrent-title";
import type { DebridSlug, ParsedStream, Stream } from "../types";
import { mapResolution } from "./parser-resolution";
import { detectHdr } from "./parser-hdr";
import { mapCodec } from "./parser-codec";
import { detectSource } from "./parser-source";
import { parseAudio } from "./parser-audio";
import { parseLanguages } from "./parser-language";
import { parseCacheFlags } from "./parser-cache-flags";
import { extractFilenameLine } from "./parser-filename";
import { parseEpisodeSpan } from "@/lib/episode-span";
import {
  computeScamScore,
  parseAnimeHash,
  parseContainer,
  parseDisc,
  parseEdition,
  parseEpisodeTitle,
  parseRepackIteration,
  parseSeasonPack,
  parseSeeders,
  parseSize,
  parseYearRange,
} from "./parser-metadata";

const REMUX_RX = /\bRemux\b/i;
const HARDCODED_RX = /\b(HC|HARDCODED|HARDSUB)\b/i;

export function parseStream(stream: Stream): ParsedStream {
  const filenameLine = extractFilenameLine(stream);
  const text = [filenameLine, stream.title, stream.description, stream.name]
    .filter(Boolean)
    .join(" ");
  const ptt = parse(filenameLine || text) as DefaultParserResult;

  const resolution = mapResolution(ptt.resolution);
  const hdrFormat = detectHdr(text);
  const codec = mapCodec(ptt.codec ?? "");
  const source = detectSource(text);
  const audio = parseAudio(text, ptt);
  const audioLanguages = parseLanguages(text);
  const size = parseSize(text, stream.behaviorHints?.videoSize);
  const seeders = parseSeeders(text);
  const cached = parseCacheFlags(
    text,
    stream.behaviorHints?.bingeGroup,
    stream.addonName,
    stream.url,
  );
  const cacheVerified: Partial<Record<DebridSlug, boolean>> = {};
  const inLibrary: Partial<Record<DebridSlug, boolean>> = {};
  const container = parseContainer(stream.behaviorHints?.filename, filenameLine, text);
  const releaseGroup = ptt.group ?? null;
  const releaseGroupNormalized = releaseGroup
    ? releaseGroup.toUpperCase().replace(/[^A-Z0-9]/g, "")
    : null;
  const remux = REMUX_RX.test(text);
  const edition = parseEdition(text, ptt);
  const year = ptt.year ?? null;
  const yearRange = parseYearRange(text);
  const span = parseEpisodeSpan(filenameLine || text);
  const season = span?.season ?? ptt.season ?? null;
  const episode = span?.episode ?? ptt.episode ?? null;
  const episodeEnd = span?.episodeEnd ?? episode;
  const seasonPack = parseSeasonPack(text, ptt, filenameLine);
  const discIndex = parseDisc(text);
  const repackIteration = parseRepackIteration(text, ptt);
  const proper = ptt.proper === true;
  const hardcoded = HARDCODED_RX.test(text) || ptt.hardcoded === true;
  const animeHash = parseAnimeHash(text);
  const scamScore = computeScamScore(source, resolution, size);

  return {
    ...stream,
    parsedTitle: ptt.title ?? filenameLine.slice(0, 100) ?? text.slice(0, 100),
    episodeTitle: parseEpisodeTitle(filenameLine, ptt.season, ptt.episode),
    resolution,
    hdrFormat,
    codec,
    source,
    audio,
    audioLanguages,
    size,
    seeders,
    cached,
    cacheVerified,
    inLibrary,
    container,
    releaseGroup,
    releaseGroupNormalized,
    remux,
    edition,
    year,
    yearRange,
    season,
    episode,
    episodeEnd,
    seasonPack,
    discIndex,
    repackIteration,
    proper,
    hardcoded,
    animeHash,
    scamScore,
  };
}
