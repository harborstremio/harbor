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

function chainFiles(mode: Anime4kMode, tier: Anime4kTier): string[] {
  // `hq` uses the VL restore kernels; `fast` uses M. The final upscale and the
  // optional second restore are always the lighter kernel, matching upstream's
  // high-end and low-end presets.
  const big = tier === "hq" ? "VL" : "M";
  const restore = `Anime4K_Restore_CNN_${big}.glsl`;
  const restoreSoft = `Anime4K_Restore_CNN_Soft_${big}.glsl`;
  const upscale = `Anime4K_Upscale_CNN_x2_${big}.glsl`;
  const denoise = `Anime4K_Upscale_Denoise_CNN_x2_${big}.glsl`;
  const restoreLight = "Anime4K_Restore_CNN_S.glsl";
  const restoreSoftLight = "Anime4K_Restore_CNN_Soft_S.glsl";
  const upscaleLight = "Anime4K_Upscale_CNN_x2_S.glsl";
  const second = tier === "hq" ? UPSCALE_M : upscaleLight;
  switch (mode) {
    case "A":
      return [CLAMP, restore, upscale, D2, D4, second];
    case "B":
      return [CLAMP, restoreSoft, upscale, D2, D4, second];
    case "C":
      return [CLAMP, denoise, D2, D4, second];
    case "AA":
      return [CLAMP, restore, upscale, restoreLight, D2, D4, second];
    case "BB":
      return [CLAMP, restoreSoft, upscale, D2, D4, restoreSoftLight, second];
    case "CA":
      return [CLAMP, denoise, D2, D4, restoreLight, second];
  }
}

export function anime4kChain(folder: string, mode: Anime4kMode, tier: Anime4kTier): string[] {
  if (!folder) return [];
  const base = folder.replace(/\\/g, "/").replace(/\/+$/, "");
  return chainFiles(mode, tier).map((f) => `${base}/${f}`);
}
