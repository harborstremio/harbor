export const MIKU_MODELS = ["classic", "retro", "modern"] as const;
export type MikuModel = typeof MIKU_MODELS[number];
// Saved IDs describe the original assets; the retro asset is now labelled Classic MMD.
export const DEFAULT_MIKU_MODEL: MikuModel = "retro";

export function normalizeMikuModel(value: unknown): MikuModel {
  return value === "classic" || value === "retro" || value === "modern" ? value : DEFAULT_MIKU_MODEL;
}
