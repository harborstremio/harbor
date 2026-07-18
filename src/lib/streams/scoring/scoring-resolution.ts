import type { ParsedStream, ScoreReason, Tier } from "../types";

export function resolutionPoints(s: ParsedStream): ScoreReason {
  if (s.resolution === "4K") return { signal: "4K", delta: 25 };
  if (s.resolution === "1080p") return { signal: "1080p", delta: 20 };
  if (s.resolution === "720p") return { signal: "720p", delta: 8 };
  if (s.resolution === "480p") return { signal: "480p", delta: 2 };
  return { signal: "SD", delta: 0 };
}

export function tierOf(s: ParsedStream): Tier {
  if (
    s.source === "CAM" ||
    s.source === "TS" ||
    s.source === "HDTS" ||
    s.source === "TC" ||
    s.source === "SCR"
  ) {
    return "ROUGH";
  }
  if (s.resolution === "4K") {
    if (s.hdrFormat === "DV" || s.hdrFormat === "DV+HDR10") return "4K_DV";
    if (s.hdrFormat) return "4K_HDR";
    return "4K";
  }
  if (s.resolution === "1080p") {
    if (s.hdrFormat) return "1080p_HDR";
    return "1080p";
  }
  if (s.resolution === "720p") return "720p";
  return "SD";
}
