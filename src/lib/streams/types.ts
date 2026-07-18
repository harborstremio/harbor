export type Resolution = "4K" | "1080p" | "720p" | "480p" | "SD";
export type HdrFormat = "HDR10" | "HDR10+" | "DV" | "DV+HDR10" | "HLG";
export type Codec = "HEVC" | "AVC" | "AV1" | "VP9" | "MPEG2" | "Other";
export type AudioCodec =
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
export type Source =
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
export type Tier = "4K_DV" | "4K_HDR" | "4K" | "1080p_HDR" | "1080p" | "720p" | "SD" | "ROUGH";
export type DebridSlug = "rd" | "tb" | "ad" | "pm" | "dl";

export type ProxyHeaders = {
  request?: Record<string, string>;
  response?: Record<string, string>;
};

export type StreamSubtitle = {
  id?: string;
  url: string;
  lang?: string;
  m?: string;
};

export type Stream = {
  name?: string;
  title?: string;
  description?: string;
  infoHash?: string;
  fileIdx?: number;
  fileMustInclude?: string;
  url?: string;
  ytId?: string;
  externalUrl?: string;
  nzbUrl?: string;
  servers?: string[];
  rarUrls?: string[];
  zipUrls?: string[];
  tarUrls?: string[];
  tgzUrls?: string[];
  sevenZipUrls?: string[];
  subtitles?: StreamSubtitle[];
  behaviorHints?: {
    bingeGroup?: string;
    videoHash?: string;
    videoSize?: number;
    filename?: string;
    fileName?: string;
    countryWhitelist?: string[];
    notWebReady?: boolean;
    proxyHeaders?: ProxyHeaders;
    headers?: Record<string, string>;
  } & Record<string, unknown>;
  sources?: string[];
  availability?: number;
  liveStreamCheck?: boolean;
  addonId: string;
  addonName: string;
  addonUrl?: string;
  addonRanked?: boolean;
  addonPriority?: number;
  addonReturnIdx?: number;
  contributors?: Array<{ id: string; name: string }>;
};

export type AudioInfo = {
  codec: AudioCodec;
  channels: number;
  bitDepth?: number;
};

export type Container = "mkv" | "mp4" | "m4v" | "avi" | "webm" | "mov" | "ts" | "wmv";

export type ParsedStream = Stream & {
  parsedTitle: string;
  episodeTitle: string | null;
  resolution: Resolution;
  hdrFormat: HdrFormat | null;
  codec: Codec;
  source: Source;
  audio: AudioInfo;
  audioLanguages: string[];
  size: number | null;
  seeders: number | null;
  cached: Partial<Record<DebridSlug, boolean>>;
  inLibrary: Partial<Record<DebridSlug, boolean>>;
  container: Container | null;
  releaseGroup: string | null;
  releaseGroupNormalized: string | null;
  remux: boolean;
  edition: string | null;
  year: number | null;
  yearRange: [number, number] | null;
  season: number | null;
  episode: number | null;
  seasonPack: boolean;
  discIndex: number | null;
  repackIteration: number;
  proper: boolean;
  hardcoded: boolean;
  animeHash: string | null;
  scamScore: number;
};

export type ScoreReason = {
  signal: string;
  delta: number;
};

export type ScoredStream = ParsedStream & {
  score: number;
  reasons: ScoreReason[];
  tier: Tier;
  nativeIdx?: number;
};

export type RankedPicker = {
  primary: ScoredStream | null;
  byTier: Partial<Record<Tier, ScoredStream>>;
  all: ScoredStream[];
};
