import type { ScoredStream } from "@/lib/streams/types";

export type QualityTier = "4K" | "1080p" | "720p" | "SD";

export function qualityTier(s: ScoredStream): QualityTier {
  if (s.resolution === "4K") return "4K";
  if (s.resolution === "1080p") return "1080p";
  if (s.resolution === "720p") return "720p";
  return "SD";
}

export type SourceGroup = "Remux" | "BluRay" | "WEB-DL" | "WEBRip" | "HDTV" | "CAM";

export function sourceGroup(s: ScoredStream): SourceGroup | null {
  switch (s.source) {
    case "REMUX":
      return "Remux";
    case "BluRay":
    case "BDRip":
      return "BluRay";
    case "WEB-DL":
      return "WEB-DL";
    case "WEBRip":
    case "HDRip":
      return "WEBRip";
    case "HDTV":
    case "DVDRip":
      return "HDTV";
    case "CAM":
    case "TS":
    case "HDTS":
    case "TC":
    case "SCR":
      return "CAM";
    default:
      return null;
  }
}
