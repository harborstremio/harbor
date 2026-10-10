export type Anime4kMode = "A" | "B" | "C" | "AA" | "BB" | "CA";
export type Anime4kTier = "hq" | "fast";

export const ANIME4K_MODES: Array<{ id: Anime4kMode; label: string; sub: string }> = [
  { id: "A", label: "Mode A", sub: "Restore + upscale. The best all-rounder for most anime." },
  { id: "B", label: "Mode B", sub: "Softer restore. Kinder to compressed or noisy sources." },
  { id: "C", label: "Mode C", sub: "Denoise + upscale. Lightest, cleanest on already-sharp video." },
  { id: "AA", label: "Mode A+A", sub: "Double restore. Sharpest detail, for high-quality sources." },
  { id: "BB", label: "Mode B+B", sub: "Double soft restore. For heavy compression artifacts." },
  { id: "CA", label: "Mode C+A", sub: "Denoise then restore. Balanced cleanup and detail." },
];

const CLAMP = "Anime4K_Clamp_Highlights.glsl";
const D2 = "Anime4K_AutoDownscalePre_x2.glsl";
const D4 = "Anime4K_AutoDownscalePre_x4.glsl";
const UPSCALE_M = "Anime4K_Upscale_CNN_x2_M.glsl";
const RESTORE_M = "Anime4K_Restore_CNN_M.glsl";
const RESTORE_SOFT_M = "Anime4K_Restore_CNN_Soft_M.glsl";

function chainFiles(mode: Anime4kMode, big: "VL" | "M"): string[] {
  const restore = `Anime4K_Restore_CNN_${big}.glsl`;
  const restoreSoft = `Anime4K_Restore_CNN_Soft_${big}.glsl`;
  const upscale = `Anime4K_Upscale_CNN_x2_${big}.glsl`;
  const denoise = `Anime4K_Upscale_Denoise_CNN_x2_${big}.glsl`;
  switch (mode) {
    case "A":
      return [CLAMP, restore, upscale, D2, D4, UPSCALE_M];
    case "B":
      return [CLAMP, restoreSoft, upscale, D2, D4, UPSCALE_M];
    case "C":
      return [CLAMP, denoise, D2, D4, UPSCALE_M];
    case "AA":
      return [CLAMP, restore, upscale, RESTORE_M, D2, D4, UPSCALE_M];
    case "BB":
      return [CLAMP, restoreSoft, upscale, D2, RESTORE_SOFT_M, D4, UPSCALE_M];
    case "CA":
      return [CLAMP, denoise, D2, D4, RESTORE_M, UPSCALE_M];
  }
}

export function anime4kChain(folder: string, mode: Anime4kMode, tier: Anime4kTier): string[] {
  if (!folder) return [];
  const base = folder.replace(/\\/g, "/").replace(/\/+$/, "");
  const big = tier === "hq" ? "VL" : "M";
  return chainFiles(mode, big).map((f) => `${base}/${f}`);
}
