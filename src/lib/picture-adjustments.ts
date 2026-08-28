export const PICTURE_KEYS = ["brightness", "contrast", "saturation", "gamma", "sharpen"];

export type PicturePatch = Record<string, string | null>;

export const PICTURE_TEMPLATES: Array<{ label: string; sub: string; patch: PicturePatch }> = [
  {
    label: "Brighten dark movies",
    sub: "Lifts shadows so the pitch-black scenes are actually watchable.",
    patch: { gamma: "12", brightness: "4" },
  },
  {
    label: "Punchier color",
    sub: "Richer, more vivid picture with a touch more contrast.",
    patch: { saturation: "15", contrast: "8" },
  },
  {
    label: "Easy on the eyes",
    sub: "Softer and dimmer, kinder for late-night watching.",
    patch: { brightness: "-4", gamma: "-6", saturation: "-5" },
  },
  {
    label: "Crisp (anime & cartoons)",
    sub: "Sharper lines and a little more pop.",
    patch: { sharpen: "0.6", saturation: "8" },
  },
];

// A preset defines a complete look, so any picture dial it does not set must
// fall back to its default instead of keeping the previous preset's value.
export function picturePresetPatch(patch: PicturePatch): PicturePatch {
  return { ...Object.fromEntries(PICTURE_KEYS.map((k) => [k, null])), ...patch };
}
