import type { PlayerControlId } from "./player-chrome";

function svg(inner: string): string {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff">${inner}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(doc)}`;
}

const solidPlay = svg(`<path d="M8 5v14l11-7z"/>`);
const solidPause = svg(`<rect x="6.5" y="4.5" width="4" height="15" rx="1.3"/><rect x="13.5" y="4.5" width="4" height="15" rx="1.3"/>`);
const solidRewind = svg(`<path d="M11 6 3 12l8 6zm9 0-8 6 8 6z"/>`);
const solidForward = svg(`<path d="M4 6l8 6-8 6zm9 0 8 6-8 6z"/>`);
const solidSkipPrev = svg(`<rect x="6" y="5.5" width="2.6" height="13" rx="1"/><path d="M19 6l-9 6 9 6z"/>`);
const solidSkipNext = svg(`<rect x="15.4" y="5.5" width="2.6" height="13" rx="1"/><path d="M5 6l9 6-9 6z"/>`);

export type IconPreset = { id: string; label: string; icons: Record<string, string> };

const PRESETS: Partial<Record<PlayerControlId, IconPreset[]>> = {
  "play-pause": [{ id: "solid", label: "Solid", icons: { playing: solidPause, paused: solidPlay } }],
  "seek-back": [{ id: "solid", label: "Solid", icons: { default: solidRewind } }],
  "seek-forward": [{ id: "solid", label: "Solid", icons: { default: solidForward } }],
  "prev-episode": [{ id: "solid", label: "Solid", icons: { default: solidSkipPrev } }],
  "next-episode": [{ id: "solid", label: "Solid", icons: { default: solidSkipNext } }],
};

export function getIconPresets(id: PlayerControlId): IconPreset[] {
  return PRESETS[id] ?? [];
}

export function presetThumb(p: IconPreset): string {
  return p.icons.paused ?? p.icons.default ?? Object.values(p.icons)[0] ?? "";
}
