import type { MusicTrack } from "./types";

export type MusicQuality = {
  label: string;
  detail: string;
  lossless: boolean;
  hiFi: boolean;
  tier: "lossy" | "lossless" | "hi-res" | "unverified";
  format: string | null;
  sampleRateHz: number | null;
  bitDepth: number | null;
  bitrateKbps: number | null;
};

export const MUSIC_QUALITY_LABELS = {
  lossy: "music.quality.lossy",
  lossless: "music.quality.lossless",
  "hi-res": "music.quality.hiRes",
  unverified: "music.quality.unverified",
} as const;

export function musicSampleRateLabel(sampleRateHz: number): string {
  return `${Number((sampleRateHz / 1000).toFixed(3))} kHz`;
}

type Codec = { label: string; lossless?: boolean };

function audioCodec(value: string | undefined): Codec | null {
  const codec = value?.trim().toLowerCase();
  if (!codec) return null;
  if (/^pcm_(?:s|u|f)\d+(?:le|be|planar)?$/.test(codec)) return { label: "PCM", lossless: true };
  const codecs: Record<string, Codec> = {
    flac: { label: "FLAC", lossless: true },
    alac: { label: "ALAC", lossless: true },
    ape: { label: "APE", lossless: true },
    wmalossless: { label: "WMA", lossless: true },
    wavpack: { label: "WavPack" },
    wav: { label: "WAV" },
    mp3: { label: "MP3", lossless: false },
    aac: { label: "AAC", lossless: false },
    "mp4a.40.2": { label: "AAC", lossless: false },
    "mp4a.40.5": { label: "AAC", lossless: false },
    opus: { label: "Opus", lossless: false },
    vorbis: { label: "Vorbis", lossless: false },
  };
  return Object.hasOwn(codecs, codec) ? codecs[codec] : null;
}

function positive(value: number | undefined, maximum: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= maximum
    ? value
    : null;
}

function localFormat(track: MusicTrack): string | null {
  if (track.connectorId !== "local") return null;
  for (const location of [track.sourceId, track.playbackUrl]) {
    if (!location) continue;
    let path = location;
    if (/^file:\/\//i.test(path)) {
      try {
        path = decodeURIComponent(new URL(path).pathname);
      } catch {
        continue;
      }
    } else if (!/^(?:[a-z]:[\\/]|\\\\|\/(?!\/))/.test(path.toLowerCase())) {
      continue;
    }
    const extension = path.match(/\.([a-z0-9]+)$/i)?.[1].toLowerCase();
    // A local extension identifies its format, not the fidelity of its contents.
    const formats: Record<string, string> = {
      flac: "FLAC",
      mp3: "MP3",
      m4a: "M4A",
      aac: "AAC",
      ogg: "OGG",
      opus: "Opus",
      wav: "WAV",
      wv: "WavPack",
    };
    if (extension && Object.hasOwn(formats, extension)) return formats[extension];
  }
  return null;
}

export function musicTrackQuality(track: MusicTrack): MusicQuality | null {
  const quality = track.quality;
  const codec = audioCodec(quality?.codec);
  const format = codec?.label ?? localFormat(track);
  const sampleRate = positive(quality?.sampleRateHz, 3_072_000);
  // Lossy decoders often use float/s32 internally. That is not source resolution.
  const bitDepth =
    codec?.lossless === false || quality?.lossless === false
      ? null
      : positive(quality?.bitDepth, 64);
  const bitrate = positive(quality?.bitrateKbps, 100_000);
  const lossless =
    quality?.lossless !== false &&
    codec?.lossless !== false &&
    (codec?.lossless === true || quality?.lossless === true);
  const hiFi =
    lossless && sampleRate !== null && sampleRate >= 44_100 && bitDepth !== null && bitDepth >= 16;
  // A conservative display tier, not an audibility or mastering-quality claim.
  const hiRes =
    lossless && sampleRate !== null && sampleRate > 48_000 && bitDepth !== null && bitDepth >= 24;
  const tier: MusicQuality["tier"] = hiRes
    ? "hi-res"
    : lossless
      ? "lossless"
      : codec?.lossless === false || quality?.lossless === false
        ? "lossy"
        : "unverified";
  const resolution =
    bitDepth !== null && sampleRate !== null
      ? `${bitDepth}-bit / ${musicSampleRateLabel(sampleRate)}`
      : sampleRate !== null
        ? musicSampleRateLabel(sampleRate)
        : null;
  const bitrateLabel = bitrate !== null ? `${Math.round(bitrate)} kbps` : null;
  const detail = [format, resolution, bitrateLabel].filter(Boolean).join(" · ");
  const label = hiRes
    ? "Hi-Res lossless"
    : lossless
      ? "Lossless"
      : (format ?? bitrateLabel ?? resolution);
  return label
    ? {
        label,
        detail: detail || label,
        lossless,
        hiFi,
        tier,
        format,
        sampleRateHz: sampleRate,
        bitDepth,
        bitrateKbps: bitrate,
      }
    : null;
}
