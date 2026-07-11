import type { CastDeviceInfo, TranscodeProfile } from "@/lib/cast";

export type DeviceCaps = {
  label: string;
  maxResolution: 720 | 1080 | 2160;
  hevc: boolean;
  av1: boolean;
  dolbyVision: boolean;
  hdr10: boolean;
  passthroughAc3: boolean;
  passthroughEac3: boolean;
  passthroughTruehd: boolean;
  passthroughDts: boolean;
  containerMkv: boolean;
};

const CAPS_NEST_HUB: DeviceCaps = {
  label: "Nest Hub",
  maxResolution: 720,
  hevc: false,
  av1: false,
  dolbyVision: false,
  hdr10: false,
  passthroughAc3: false,
  passthroughEac3: false,
  passthroughTruehd: false,
  passthroughDts: false,
  containerMkv: false,
};

const CAPS_NEST_HUB_MAX: DeviceCaps = {
  ...CAPS_NEST_HUB,
  label: "Nest Hub Max",
  maxResolution: 1080,
};

const CAPS_CHROMECAST_GEN1_2: DeviceCaps = {
  label: "Chromecast",
  maxResolution: 1080,
  hevc: false,
  av1: false,
  dolbyVision: false,
  hdr10: false,
  passthroughAc3: false,
  passthroughEac3: false,
  passthroughTruehd: false,
  passthroughDts: false,
  containerMkv: false,
};

const CAPS_CHROMECAST_ULTRA: DeviceCaps = {
  label: "Chromecast Ultra",
  maxResolution: 2160,
  hevc: true,
  av1: false,
  dolbyVision: false,
  hdr10: true,
  passthroughAc3: true,
  passthroughEac3: true,
  passthroughTruehd: false,
  passthroughDts: false,
  containerMkv: false,
};

const CAPS_CHROMECAST_GOOGLE_TV_4K: DeviceCaps = {
  label: "Chromecast with Google TV (4K)",
  maxResolution: 2160,
  hevc: true,
  av1: false,
  dolbyVision: true,
  hdr10: true,
  passthroughAc3: true,
  passthroughEac3: true,
  passthroughTruehd: true,
  passthroughDts: false,
  containerMkv: true,
};

const CAPS_CHROMECAST_GOOGLE_TV_HD: DeviceCaps = {
  label: "Chromecast with Google TV (HD)",
  maxResolution: 1080,
  hevc: true,
  av1: false,
  dolbyVision: false,
  hdr10: true,
  passthroughAc3: true,
  passthroughEac3: true,
  passthroughTruehd: false,
  passthroughDts: false,
  containerMkv: false,
};

const CAPS_FIRE_TV_4K: DeviceCaps = {
  label: "Fire TV",
  maxResolution: 2160,
  hevc: true,
  av1: true,
  dolbyVision: true,
  hdr10: true,
  passthroughAc3: true,
  passthroughEac3: true,
  passthroughTruehd: true,
  passthroughDts: true,
  containerMkv: true,
};

const CAPS_ROKU_4K: DeviceCaps = {
  label: "Roku",
  maxResolution: 2160,
  hevc: true,
  av1: false,
  dolbyVision: true,
  hdr10: true,
  passthroughAc3: true,
  passthroughEac3: true,
  passthroughTruehd: false,
  passthroughDts: true,
  containerMkv: true,
};

const CAPS_GENERIC_DLNA: DeviceCaps = {
  label: "DLNA TV",
  maxResolution: 1080,
  hevc: false,
  av1: false,
  dolbyVision: false,
  hdr10: false,
  passthroughAc3: true,
  passthroughEac3: false,
  passthroughTruehd: false,
  passthroughDts: false,
  containerMkv: true,
};

const CAPS_SAMSUNG_DLNA: DeviceCaps = {
  label: "Samsung Smart TV",
  maxResolution: 1080,
  hevc: false,
  av1: false,
  dolbyVision: false,
  hdr10: false,
  passthroughAc3: true,
  passthroughEac3: false,
  passthroughTruehd: false,
  passthroughDts: false,
  containerMkv: false,
};

const CAPS_LG_DLNA: DeviceCaps = {
  label: "LG Smart TV",
  maxResolution: 1080,
  hevc: false,
  av1: false,
  dolbyVision: false,
  hdr10: false,
  passthroughAc3: true,
  passthroughEac3: false,
  passthroughTruehd: false,
  passthroughDts: false,
  containerMkv: false,
};

const CAPS_SONY_DLNA: DeviceCaps = {
  label: "Sony Smart TV",
  maxResolution: 1080,
  hevc: false,
  av1: false,
  dolbyVision: false,
  hdr10: false,
  passthroughAc3: true,
  passthroughEac3: false,
  passthroughTruehd: false,
  passthroughDts: false,
  containerMkv: false,
};

const CAPS_AIRPLAY_APPLE_TV: DeviceCaps = {
  label: "Apple TV",
  maxResolution: 2160,
  hevc: true,
  av1: false,
  dolbyVision: true,
  hdr10: true,
  passthroughAc3: true,
  passthroughEac3: true,
  passthroughTruehd: false,
  passthroughDts: false,
  containerMkv: false,
};

const CAPS_AIRPLAY_GENERIC: DeviceCaps = {
  label: "AirPlay",
  maxResolution: 1080,
  hevc: false,
  av1: false,
  dolbyVision: false,
  hdr10: false,
  passthroughAc3: false,
  passthroughEac3: false,
  passthroughTruehd: false,
  passthroughDts: false,
  containerMkv: false,
};

export function getDeviceCaps(device: CastDeviceInfo): DeviceCaps {
  const model = (device.model ?? "").toLowerCase();
  const name = device.name.toLowerCase();
  const blob = `${model} ${name}`;

  if (device.kind === "roku") return CAPS_ROKU_4K;
  if (device.kind === "airplay") {
    if (/apple\s*tv|appletv/.test(blob)) return CAPS_AIRPLAY_APPLE_TV;
    if (/homepod/.test(blob)) return { ...CAPS_AIRPLAY_GENERIC, label: "HomePod", maxResolution: 1080 };
    return CAPS_AIRPLAY_GENERIC;
  }
  if (device.kind === "dlna") {
    if (/fire\s*tv/.test(blob)) return CAPS_FIRE_TV_4K;
    if (/samsung|tizen/.test(blob)) return CAPS_SAMSUNG_DLNA;
    if (/\b(?:qn|un|gq|ue|qe|ks|ku|mu|ju|hu|eh|tu|au|bu|cu|du|ls)\d{2,3}[a-z]/.test(blob)) return CAPS_SAMSUNG_DLNA;
    if (/\blg\b|webos|thinq/.test(blob)) return CAPS_LG_DLNA;
    if (/\boled\d{2,3}|\bnano\d{2,3}|\bqned\d{2,3}|\b(?:ur|uq|up|um)\d{2,3}/.test(blob)) return CAPS_LG_DLNA;
    if (/sony|bravia/.test(blob)) return CAPS_SONY_DLNA;
    if (/\b(?:kd|xbr|xr|kj)-?\d{2,3}/.test(blob)) return CAPS_SONY_DLNA;
    return CAPS_GENERIC_DLNA;
  }

  if (/nest hub max/.test(blob)) return CAPS_NEST_HUB_MAX;
  if (/nest hub|home hub|google home hub/.test(blob)) return CAPS_NEST_HUB;
  if (/chromecast.*ultra/.test(blob)) return CAPS_CHROMECAST_ULTRA;
  if (/google tv/.test(blob)) {
    if (/4k|2160/.test(blob)) return CAPS_CHROMECAST_GOOGLE_TV_4K;
    if (/hd|1080/.test(blob)) return CAPS_CHROMECAST_GOOGLE_TV_HD;
    return CAPS_CHROMECAST_GOOGLE_TV_4K;
  }
  if (/fire\s*tv|firetv|aftt|aftr|aftm/.test(blob)) return CAPS_FIRE_TV_4K;
  if (/chromecast/.test(blob)) return CAPS_CHROMECAST_GEN1_2;
  return CAPS_CHROMECAST_GEN1_2;
}

export type StreamLike = {
  parsedTitle?: string | null;
  title?: string | null;
  resolution?: string | null;
  liveHeight?: number;
  liveWidth?: number;
};

export type CompatVerdict = {
  ok: boolean;
  reasons: string[];
};

function detectResolution(s: StreamLike): number {
  if (typeof s.liveHeight === "number" && s.liveHeight > 0) {
    if (s.liveHeight >= 1800) return 2160;
    if (s.liveHeight >= 1300) return 1440;
    if (s.liveHeight >= 900) return 1080;
    if (s.liveHeight >= 600) return 720;
    return 480;
  }
  const hay = `${s.parsedTitle ?? ""} ${s.title ?? ""} ${s.resolution ?? ""}`.toLowerCase();
  if (/\b(2160p|4k|uhd|3840)\b/.test(hay)) return 2160;
  if (/\b1440p\b/.test(hay)) return 1440;
  if (/\b1080p|fhd\b/.test(hay)) return 1080;
  if (/\b720p|hd\b/.test(hay)) return 720;
  if (/\b480p|sd\b/.test(hay)) return 480;
  return 1080;
}

function noAudioPassthrough(caps: DeviceCaps): boolean {
  return !caps.passthroughAc3 && !caps.passthroughEac3 && !caps.passthroughDts && !caps.passthroughTruehd;
}

const NATIVE_AUDIO_RX = /\b(aac|mp3|opus|vorbis|flac)\b/;

export function checkStreamCompat(stream: StreamLike, caps: DeviceCaps): CompatVerdict {
  const hay = `${stream.parsedTitle ?? ""} ${stream.title ?? ""} ${stream.resolution ?? ""}`.toLowerCase();
  const reasons: string[] = [];
  const res = detectResolution(stream);
  if (res > caps.maxResolution) reasons.push(`${res}p above device max ${caps.maxResolution}p`);
  if (/dolby\s*vision|\bdv\b|\bdvhdr\b/.test(hay) && !caps.dolbyVision) reasons.push("Dolby Vision unsupported");
  if (/\bhdr10\+?\b|hdr10plus/.test(hay) && !caps.hdr10) reasons.push("HDR10 unsupported");
  if (/\bav1\b/.test(hay) && !caps.av1) reasons.push("AV1 unsupported");
  if (/\b(hevc|h\.?265|x265)\b/.test(hay) && !caps.hevc) reasons.push("HEVC unsupported");
  if (/\btruehd\b/.test(hay) && !caps.passthroughTruehd) reasons.push("TrueHD audio unsupported");
  if (/\bdts(-?hd|-?ma)?\b/.test(hay) && !caps.passthroughDts) reasons.push("DTS audio unsupported");
  if (/\beac3|e-?ac-?3|ddp\b/.test(hay) && !caps.passthroughEac3) reasons.push("E-AC-3 unsupported");
  if (/\bac-?3|dd5|\bdolby\s*digital\b/.test(hay) && !caps.passthroughAc3) reasons.push("AC-3 audio unsupported");
  if (/\b(mkv|matroska)\b/.test(hay) && !caps.containerMkv) reasons.push("MKV container unsupported");
  if (noAudioPassthrough(caps) && !NATIVE_AUDIO_RX.test(hay)) reasons.push("audio must be re-encoded");
  return { ok: reasons.length === 0, reasons };
}

export function pickBestCompatStream<T extends StreamLike>(streams: T[], caps: DeviceCaps): T | null {
  const compat = streams.filter((s) => checkStreamCompat(s, caps).ok);
  if (compat.length === 0) return null;
  return compat.reduce((best, s) => {
    const r = detectResolution(s);
    const b = detectResolution(best);
    return r > b ? s : best;
  });
}

export function pickTranscodeProfile(stream: StreamLike, caps: DeviceCaps): TranscodeProfile {
  const hay = `${stream.parsedTitle ?? ""} ${stream.title ?? ""} ${stream.resolution ?? ""}`.toLowerCase();
  const isHevc = /\b(hevc|h\.?265|x265)\b/.test(hay);
  const isAv1 = /\bav1\b/.test(hay);
  const isDv = /dolby\s*vision|\bdv\b|\bdvhdr\b/.test(hay);
  const isHdr10 = /\bhdr10\+?\b|hdr10plus|\bhdr\b/.test(hay);
  const isTrueHd = /\btruehd\b/.test(hay);
  const isDts = /\bdts(-?hd|-?ma)?\b/.test(hay);
  const isEac3 = /\beac3|e-?ac-?3|ddp\b/.test(hay);
  const isAc3 = /\bac-?3|dd5|\bdolby\s*digital\b/.test(hay);
  const noPt = noAudioPassthrough(caps);
  const knownNativeAudio = NATIVE_AUDIO_RX.test(hay);

  const sourceRes = detectResolution(stream);
  const max_height = Math.min(sourceRes, caps.maxResolution) as 720 | 1080 | 2160;

  const force_h264 =
    (isHevc && !caps.hevc) ||
    (isAv1 && !caps.av1) ||
    (isDv && !caps.dolbyVision) ||
    (isHdr10 && !caps.hdr10) ||
    sourceRes > caps.maxResolution;

  const force_aac =
    (isTrueHd && !caps.passthroughTruehd) ||
    (isDts && !caps.passthroughDts) ||
    (isEac3 && !caps.passthroughEac3) ||
    (isAc3 && !caps.passthroughAc3) ||
    (noPt && !knownNativeAudio);

  const force_stereo = force_aac && !caps.passthroughEac3 && !caps.passthroughAc3;

  const max_video_kbps = max_height >= 2160 ? 18000 : max_height >= 1080 ? 8000 : 3500;

  return { max_height, force_h264, force_aac, force_stereo, max_video_kbps };
}

export function needsTranscode(stream: StreamLike, caps: DeviceCaps): boolean {
  const v = checkStreamCompat(stream, caps);
  return !v.ok;
}
