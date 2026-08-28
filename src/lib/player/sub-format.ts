import type { TrackInfo } from "./bridge";

export function isAssTrack(track: TrackInfo | null | undefined): boolean {
  if (!track) return false;
  const codec = (track.codec ?? "").toUpperCase();
  if (
    codec.includes("ASS") ||
    codec.includes("SSA") ||
    codec.includes("SUBSTATION") ||
    codec.includes("SUB STATION")
  ) {
    return true;
  }
  const title = (track.title ?? "").toLowerCase();
  return /\.(ass|ssa)$/.test(title);
}

export function isImageSubTrack(track: TrackInfo | null | undefined): boolean {
  if (!track) return false;
  const codec = (track.codec ?? "").toUpperCase();
  return (
    codec.includes("PGS") ||
    codec.includes("HDMV") ||
    codec.includes("DVD_SUB") ||
    codec.includes("DVD SUBTITLES") ||
    codec.includes("DVD SUBTITLE") ||
    codec.includes("DVB") ||
    codec.includes("VOBSUB") ||
    codec.includes("XSUB")
  );
}

export function isTextSubTrack(track: TrackInfo | null | undefined): boolean {
  if (!track) return false;
  if (isImageSubTrack(track)) return false;
  const codec = (track.codec ?? "").toUpperCase();
  if (
    codec.includes("SUBRIP") ||
    /\bSRT\b/.test(codec) ||
    codec.includes("WEBVTT") ||
    /\bVTT\b/.test(codec) ||
    /\bASS\b/.test(codec) ||
    /\bSSA\b/.test(codec) ||
    codec.includes("SUBSTATION") ||
    codec.includes("SUB STATION") ||
    /\bMOV[ _-]?TEXT\b/.test(codec) ||
    /\bTEXT(?: SUBTITLE)?\b/.test(codec)
  ) {
    return true;
  }

  const source = [track.externalFilename, track.url, track.title]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  return /\.(?:srt|vtt|ass|ssa)(?:$|[?#\s])/i.test(source);
}
