import { Maximize2, Palette, Sparkles, Sun, Wand2, type LucideIcon } from "lucide-react";
import type {
  ShaderCatalogEntry,
  ShaderContent,
  ShaderStage,
} from "@/lib/player/shader-catalog";

export const STAGE_SEQUENCE: ShaderStage[] = [
  "prescale",
  "restore",
  "chroma",
  "sharpen",
  "tonemap",
];

export const STAGE_LABEL: Record<ShaderStage, string> = {
  prescale: "Upscaling",
  restore: "Detail recovery",
  chroma: "Color",
  sharpen: "Sharpening",
  tonemap: "HDR tone-mapping",
};

export const STAGE_ICON: Record<ShaderStage, LucideIcon> = {
  prescale: Maximize2,
  restore: Wand2,
  chroma: Palette,
  sharpen: Sparkles,
  tonemap: Sun,
};

export const CONTENT_LABEL: Record<ShaderContent, string> = {
  all: "All video",
  anime: "Anime",
  hdr: "HDR only",
  live: "Live action",
};

export const TIER_LABEL: Record<ShaderCatalogEntry["tier"], string> = {
  fast: "Light",
  quality: "Quality",
  heavy: "Heavy",
};

export function appliesLabel(content: ShaderContent): string {
  if (content === "hdr") return "Applies only to HDR sources when you play them.";
  if (content === "anime") return "Applies to anime when you play it.";
  if (content === "live") return "Applies to live action when you play it.";
  return "Applies when you play something. Only visibly changes the picture when the video is being scaled.";
}

export const TIER_LOAD: Record<ShaderCatalogEntry["tier"], string> = {
  fast: "Light on the graphics card.",
  quality: "Moderate load on the graphics card.",
  heavy: "Heavy on the graphics card.",
};

export function segmentedWide(labels: readonly string[]): boolean {
  const n = labels.length;
  if (n === 0) return false;
  const chars = labels.reduce((sum, label) => sum + label.length, 0);
  return 8 + 2 * (n - 1) + 32 * n + 8.2 * chars * 1.3 > 320;
}
