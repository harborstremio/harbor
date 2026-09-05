import type { TvDoc, TvGroup, TvRow, TvValue } from "./model";
import type { TvChoice } from "./model-lists";

export const SUB_TINTS: Array<TvChoice & { css: string }> = [
  { value: "White", label: "White", css: "#FFFFFF" },
  { value: "Warm", label: "Warm white", css: "#F5F0E6" },
  { value: "Grey", label: "Soft grey", css: "#D6D6DE" },
  { value: "Yellow", label: "Yellow", css: "#F6D75A" },
  { value: "Amber", label: "Amber", css: "#F0A63A" },
  { value: "Cyan", label: "Cyan", css: "#7FE3F0" },
  { value: "Green", label: "Green", css: "#8CE08C" },
  { value: "Black", label: "Black", css: "#000000" },
];

export const SUB_FAMILY_CSS: Record<string, string> = {
  Sans: "system-ui, sans-serif",
  Condensed: "'Arial Narrow', 'Roboto Condensed', system-ui, sans-serif",
  Serif: "Georgia, 'Times New Roman', serif",
  Mono: "'JetBrains Mono', 'Courier New', monospace",
};

export function tintCss(name: string): string {
  return SUB_TINTS.find((t) => t.value === name)?.css ?? "#FFFFFF";
}

const TINT_OPTIONS: TvChoice[] = SUB_TINTS.map((t) => ({ value: t.value, label: t.label }));

export const SUB_LOOK_ROWS: TvRow[] = [
  { kind: "step", key: "subLookSize", label: "Size", def: 100, min: 60, max: 260, step: 10, unit: "%" },
  { kind: "choice", key: "subLookTint", label: "Text colour", def: "White", options: TINT_OPTIONS },
  { kind: "step", key: "subLookOpacity", label: "Text opacity", def: 100, min: 30, max: 100, step: 5, unit: "%" },
  {
    kind: "choice",
    key: "subLookEdge",
    label: "Edge treatment",
    sub: "What separates the letters from the picture behind them.",
    def: "Shadow",
    options: [
      { value: "Shadow", label: "Soft shadow" },
      { value: "Outline", label: "Hard outline" },
      { value: "Box", label: "Solid box" },
    ],
  },
  { kind: "choice", key: "subLookEdgeTint", label: "Edge colour", def: "Black", options: TINT_OPTIONS },
  { kind: "step", key: "subLookOutline", label: "Edge weight", def: 7, min: 0, max: 24, step: 1 },
  { kind: "choice", key: "subLookBoxTint", label: "Box colour", def: "Black", options: TINT_OPTIONS },
  { kind: "step", key: "subLookBoxOpacity", label: "Box opacity", def: 55, min: 0, max: 100, step: 5, unit: "%" },
  { kind: "step", key: "subLookBottom", label: "Distance from bottom", def: 6, min: 0, max: 60, step: 2, unit: "%" },
  {
    kind: "choice",
    key: "subLookAlign",
    label: "Alignment",
    def: "Center",
    options: [
      { value: "Left", label: "Left" },
      { value: "Center", label: "Center" },
      { value: "Right", label: "Right" },
    ],
  },
  { kind: "step", key: "subLookGap", label: "Line spacing", def: 6, min: 0, max: 40, step: 2 },
  { kind: "toggle", key: "subLookBold", label: "Bold", def: false },
  {
    kind: "choice",
    key: "subLookFamily",
    label: "Typeface",
    def: "Sans",
    options: [
      { value: "Sans", label: "Sans" },
      { value: "Condensed", label: "Condensed" },
      { value: "Serif", label: "Serif" },
      { value: "Mono", label: "Mono" },
    ],
  },
];

export const SUB_LOOK_GROUP: TvGroup = {
  id: "subtitle-look",
  title: "Subtitle look on the TV",
  subtitle:
    "Thirteen controls for how a subtitle sits on the TV screen. The preview is the real shape, at TV distance.",
  wire: "playerlayout",
  rows: SUB_LOOK_ROWS,
};

export type SubPreset = { id: string; label: string; note: string; values: TvDoc };

function preset(
  id: string,
  label: string,
  note: string,
  size: number,
  tint: string,
  opacity: number,
  edge: string,
  edgeTint: string,
  outline: number,
  boxTint: string,
  boxOpacity: number,
  bottom: number,
  align: string,
  gap: number,
  bold: boolean,
  family: string,
): SubPreset {
  return {
    id,
    label,
    note,
    values: {
      subLookSize: String(size),
      subLookTint: tint,
      subLookOpacity: String(opacity),
      subLookEdge: edge,
      subLookEdgeTint: edgeTint,
      subLookOutline: String(outline),
      subLookBoxTint: boxTint,
      subLookBoxOpacity: String(boxOpacity),
      subLookBottom: String(bottom),
      subLookAlign: align,
      subLookGap: String(gap),
      subLookBold: bold,
      subLookFamily: family,
    },
  };
}

export const SUB_PRESETS: SubPreset[] = [
  preset(
    "default",
    "Harbor default",
    "White text, soft shadow. The safe one.",
    100, "White", 100, "Shadow", "Black", 7, "Black", 55, 6, "Center", 6, false, "Sans",
  ),
  preset(
    "clear",
    "Large and clear",
    "Big and bold on a solid plate.",
    150, "White", 100, "Box", "Black", 7, "Black", 70, 8, "Center", 10, true, "Sans",
  ),
  preset(
    "cinema",
    "Cinema",
    "Warm off white, lifted, heavier edge.",
    115, "Warm", 96, "Shadow", "Black", 10, "Black", 55, 12, "Center", 8, false, "Sans",
  ),
  preset(
    "minimal",
    "Minimal",
    "Small condensed with a thin outline.",
    85, "White", 88, "Outline", "Black", 4, "Black", 40, 5, "Center", 4, false, "Condensed",
  ),
];

export function matchesPreset(doc: TvDoc, p: SubPreset): boolean {
  return Object.entries(p.values).every(([k, v]) => {
    const held: TvValue | undefined = doc[k];
    if (held === undefined) return SUB_LOOK_ROWS.some((r) => r.key === k && defaultOf(r) === v);
    return held === v;
  });
}

function defaultOf(row: TvRow): TvValue {
  return row.kind === "step" ? String(row.def) : row.def;
}
