import type { BadgeKind } from "@/components/format-badge";
import type { ScoredStream } from "@/lib/streams/types";

export type QualityKey = "all" | "4K" | "1080p" | "720p" | "480p" | "SD" | "telecine" | "telesync" | "cam";

export const QUALITY_ORDER: Exclude<QualityKey, "all">[] = [
  "4K",
  "1080p",
  "720p",
  "480p",
  "SD",
  "telecine",
  "telesync",
  "cam",
];

export const QUALITY_LABEL: Record<Exclude<QualityKey, "all">, string> = {
  "4K": "4K UHD",
  "1080p": "1080p",
  "720p": "720p",
  "480p": "480p",
  SD: "SD",
  telecine: "Telecine",
  telesync: "Telesync",
  cam: "CAM",
};

export const QUALITY_BADGE: Record<Exclude<QualityKey, "all">, BadgeKind> = {
  "4K": "4k-uhd",
  "1080p": "1080p",
  "720p": "720p",
  "480p": "480p",
  SD: "sd",
  telecine: "telecine",
  telesync: "telesync",
  cam: "cam",
};

export function qualityKey(stream: ScoredStream): Exclude<QualityKey, "all"> {
  if (stream.source === "CAM") return "cam";
  if (stream.source === "TS" || stream.source === "HDTS") return "telesync";
  if (stream.source === "TC") return "telecine";
  if (stream.resolution === "4K") return "4K";
  if (stream.resolution === "1080p") return "1080p";
  if (stream.resolution === "720p") return "720p";
  if (stream.resolution === "480p") return "480p";
  return "SD";
}
