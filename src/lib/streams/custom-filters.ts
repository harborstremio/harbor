import type { ParsedStream } from "@/lib/streams/types";
import { randomUuid } from "../uuid.ts";

export type CustomFilterResolution = "4K" | "1080p" | "720p" | "480p" | "SD";

export type CustomFilterSource =
  | "BluRay"
  | "REMUX"
  | "WEB-DL"
  | "WEBRip"
  | "BDRip"
  | "HDRip"
  | "DVDRip"
  | "HDTV"
  | "CAM"
  | "TS"
  | "HDTS"
  | "TC"
  | "SCR"
  | "Other";

export type CustomFilterCodec = "HEVC" | "AVC" | "AV1" | "VP9" | "MPEG2" | "Other";

export type CustomFilterAudio =
  | "Atmos"
  | "TrueHD"
  | "DTS-HD MA"
  | "DTS"
  | "DD+"
  | "AC3"
  | "AAC"
  | "Opus"
  | "FLAC"
  | "Other";

export type CustomStreamFilter = {
  id: string;
  name: string;
  resolution?: CustomFilterResolution[];
  source?: CustomFilterSource[];
  codec?: CustomFilterCodec[];
  audio?: CustomFilterAudio[];
  requireHdr?: boolean;
  cachedOnly?: boolean;
  minSeeders?: number | null;
  maxSizeGb?: number | null;
};

export const RESOLUTION_OPTIONS: CustomFilterResolution[] = ["4K", "1080p", "720p", "480p", "SD"];

export const SOURCE_OPTIONS: CustomFilterSource[] = [
  "BluRay",
  "REMUX",
  "WEB-DL",
  "WEBRip",
  "BDRip",
  "HDRip",
  "DVDRip",
  "HDTV",
  "CAM",
  "TS",
  "HDTS",
  "TC",
  "SCR",
  "Other",
];

export const CODEC_OPTIONS: CustomFilterCodec[] = ["HEVC", "AVC", "AV1", "VP9", "MPEG2", "Other"];

export const AUDIO_OPTIONS: CustomFilterAudio[] = [
  "Atmos",
  "TrueHD",
  "DTS-HD MA",
  "DTS",
  "DD+",
  "AC3",
  "AAC",
  "Opus",
  "FLAC",
  "Other",
];

export function newCustomFilter(name: string): CustomStreamFilter {
  return {
    id: randomUuid(),
    name,
    resolution: [],
    source: [],
    codec: [],
    audio: [],
    requireHdr: false,
    cachedOnly: false,
    minSeeders: null,
    maxSizeGb: null,
  };
}

function isPositive(value: number | null | undefined): value is number {
  return typeof value === "number" && value > 0;
}

export function isFilterEmpty(filter: CustomStreamFilter): boolean {
  if (filter.resolution && filter.resolution.length > 0) return false;
  if (filter.source && filter.source.length > 0) return false;
  if (filter.codec && filter.codec.length > 0) return false;
  if (filter.audio && filter.audio.length > 0) return false;
  if (filter.requireHdr === true) return false;
  if (filter.cachedOnly === true) return false;
  if (isPositive(filter.minSeeders)) return false;
  if (isPositive(filter.maxSizeGb)) return false;
  return true;
}

export function matchesCustomFilter(stream: ParsedStream, filter: CustomStreamFilter): boolean {
  if (filter.resolution && filter.resolution.length > 0) {
    if (!filter.resolution.includes(stream.resolution)) return false;
  }
  if (filter.source && filter.source.length > 0) {
    if (!filter.source.includes(stream.source)) return false;
  }
  if (filter.codec && filter.codec.length > 0) {
    if (!filter.codec.includes(stream.codec)) return false;
  }
  if (filter.audio && filter.audio.length > 0) {
    if (!filter.audio.includes(stream.audio.codec)) return false;
  }
  if (filter.requireHdr === true) {
    if (stream.hdrFormat == null) return false;
  }
  if (filter.cachedOnly === true) {
    const cached =
      Object.values(stream.cached).some(Boolean) || Object.values(stream.inLibrary).some(Boolean);
    if (!cached) return false;
  }
  if (isPositive(filter.minSeeders)) {
    if (stream.seeders == null || stream.seeders < filter.minSeeders) return false;
  }
  if (isPositive(filter.maxSizeGb)) {
    if (stream.size != null && stream.size > filter.maxSizeGb * 1024 ** 3) return false;
  }
  return true;
}

function summarizeMulti(values: string[] | undefined): string | null {
  if (!values || values.length === 0) return null;
  if (values.length === 1) return values[0];
  return `${values[0]} +${values.length - 1}`;
}

export function summarizeFilter(filter: CustomStreamFilter): string {
  if (isFilterEmpty(filter)) return "Any";
  const parts: string[] = [];
  const res = summarizeMulti(filter.resolution);
  if (res) parts.push(res);
  const src = summarizeMulti(filter.source);
  if (src) parts.push(src);
  const codec = summarizeMulti(filter.codec);
  if (codec) parts.push(codec);
  const audio = summarizeMulti(filter.audio);
  if (audio) parts.push(audio);
  if (filter.requireHdr === true) parts.push("HDR");
  if (filter.cachedOnly === true) parts.push("Cached");
  if (isPositive(filter.minSeeders)) parts.push(`${filter.minSeeders}+ seeds`);
  if (isPositive(filter.maxSizeGb)) parts.push(`<= ${filter.maxSizeGb} GB`);
  return parts.join(" / ");
}
