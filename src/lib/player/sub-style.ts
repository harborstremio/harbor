import { invoke } from "@tauri-apps/api/core";
import type { Settings } from "@/lib/settings";

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function mpvColor(hex: string, opacity: number): string {
  const rgb = hex.startsWith("#") && hex.length === 7 ? hex.slice(1).toUpperCase() : "FFFFFF";
  const a = Math.round(clamp(opacity, 0, 1) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `#${a}${rgb}`;
}

function mpvFontFor(id: string): string {
  switch (id) {
    case "arabic":
      return "Noto Sans Arabic";
    case "system":
      return "Segoe UI";
    case "serif":
      return "Times New Roman";
    case "rounded":
      return "Segoe UI";
    default:
      return "Inter";
  }
}

/** Hand the second subtitle over to mpv's own renderer, for the one surface our
 *  overlay cannot draw on (HDR passthrough). `secondary-sub-pos` is measured from
 *  the top, matching how `sub-pos` positions the primary. */
export async function applySecondarySubNative(
  on: boolean,
  placement: Settings["subSecondaryPlacement"],
  marginY: number,
): Promise<void> {
  await invoke("mpv_set_property", {
    name: "secondary-sub-visibility",
    value: on,
  }).catch(() => {});
  if (!on) return;
  // "bottom" means "just above the primary line". mpv exposes no line-height
  // metric, so offset by a fixed slice of the frame rather than guessing exactly.
  const pos = placement === "top" ? 0 : clamp(100 - (Number(marginY) || 0) - 8, 0, 100);
  await invoke("mpv_set_property", { name: "secondary-sub-pos", value: pos }).catch(() => {});
}

export type SubRenderContext = {
  assNativeActive: boolean;
  imageNativeActive: boolean;
  assScale?: number;
};

export async function applySubStyle(
  s: Settings,
  context: SubRenderContext = { assNativeActive: false, imageNativeActive: false },
): Promise<void> {
  const override = s.subAssOverride;
  const normScale =
    typeof context.assScale === "number" && Number.isFinite(context.assScale)
      ? context.assScale
      : null;
  const effOverride = normScale != null ? "scale" : override;
  const assMargins = context.assNativeActive && override !== "no" ? "yes" : "no";
  const marginY = clamp(Number(s.subMarginY) || 0, 0, 100);
  const opacity = clamp(Number(s.subOpacity ?? 1), 0.1, 1);
  const boxOpacity = clamp(Number(s.subBoxOpacity ?? 0.6), 0, 1);
  const isBox = s.subStyle === "box";
  const isShadow = s.subStyle === "shadow";
  const reposition = !context.assNativeActive || override !== "no";
  const props: Array<[string, unknown]> = [
    ["sub-font-size", 32],
    ["sub-font", mpvFontFor(s.subFontFamily)],
    [
      "sub-scale",
      normScale != null
        ? clamp(normScale, 0.2, 6)
        : Math.min(4, Math.max(0.4, (Number(s.subFontSize) || 32) / 32)),
    ],
    ["sub-color", mpvColor(s.subFontColor, opacity)],
    ["sub-border-color", mpvColor(s.subBorderColor, opacity)],
    ["sub-border-size", s.subBorderSize],
    ["sub-back-color", isBox ? mpvColor(s.subBoxColor, boxOpacity * opacity) : "#00000000"],
    ["sub-shadow-color", mpvColor("#000000", opacity)],
    ["sub-shadow-offset", isShadow ? 1.4 : 0],
    ["sub-margin-y", marginY],
    ["sub-align-x", s.subAlignX],
    ["sub-ass-override", effOverride],
    ["sub-ass-force-margins", assMargins],
    ["sub-use-margins", assMargins],
    ["sub-spacing", s.subLineSpacing],
    ["sub-bold", s.subBold ? "yes" : "no"],
    ["sub-pos", reposition ? clamp(100 - marginY, 0, 100) : 100],
  ];
  await Promise.all(
    props.map(([name, value]) => invoke("mpv_set_property", { name, value }).catch(() => {})),
  );
}
