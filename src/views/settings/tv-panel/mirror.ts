import type { Settings } from "@/lib/settings";
import type { TvDoc } from "./model";
import { TV_LANGS, TV_SERVICES } from "./model-lists";

export type MirrorPlan = { settings: TvDoc; playerlayout: TvDoc; count: number };

const LANG_SET = new Set(TV_LANGS.map((l) => l.value));
const SERVICE_SET = new Set(TV_SERVICES.map((s) => s.value));

function snap(value: number, min: number, max: number, step: number): number {
  const held = Math.min(max, Math.max(min, value));
  return min + Math.round((held - min) / step) * step;
}

const ALIGN: Record<string, string> = { left: "Left", center: "Center", right: "Right" };
const EDGE: Record<string, string> = { shadow: "Shadow", outline: "Outline", box: "Box" };

function tvLanguages(languages: string[]): string[] {
  return [...new Set(languages.flatMap((language) => {
    if (LANG_SET.has(language)) return [language];
    const found = TV_LANGS.find((option) => option.label.toLowerCase() === language.toLowerCase());
    return found ? [found.value] : [];
  }))];
}

export function buildMirrorPlan(s: Settings): MirrorPlan {
  const langs = tvLanguages(s.preferredSubLangs);
  const audio = tvLanguages(s.preferredAudioLangs);
  const services = Object.entries(s.streaming)
    .filter(([k, on]) => on && SERVICE_SET.has(k))
    .map(([k]) => k);

  const settings: TvDoc = {
    instantPlay: s.instantPlay,
    autoNext: s.autoPlayNextEpisode,
    hideWatched: s.hideWatchedInCatalogs,
    showEpisodeRating: s.showEpisodeRating,
    showEpisodeDescription: s.showEpisodeDescription,
    hideSpoilers: s.hideSpoilers,
    spoilerHideThumbnails: s.spoilerHideThumbnails,
    spoilerHideTitles: s.spoilerHideTitles,
    spoilerHideDescriptions: s.spoilerHideDescriptions,
    spoilerSkipNext: s.spoilerSkipNext,
    uiLanguage: s.uiLanguage,
  };
  if (audio.length > 0) settings.audioLang = audio;
  if (langs.length > 0) settings.subLang = langs;
  if (services.length > 0) settings.service = services;

  const playerlayout: TvDoc = {
    subLookBold: s.subBold,
    subLookSize: String(snap(Math.round((s.subFontSize / 32) * 100), 60, 260, 10)),
    subLookOpacity: String(snap(Math.round(s.subOpacity * 100), 30, 100, 5)),
    subLookBoxOpacity: String(snap(Math.round(s.subBoxOpacity * 100), 0, 100, 5)),
  };
  const align = ALIGN[s.subAlignX];
  if (align) playerlayout.subLookAlign = align;
  const edge = EDGE[s.subStyle];
  if (edge) playerlayout.subLookEdge = edge;

  return {
    settings,
    playerlayout,
    count: Object.keys(settings).length + Object.keys(playerlayout).length,
  };
}

export const MIRROR_SKIPPED = [
  "Subtitle colors, because the TV picks from eight named tints and this computer stores free hex.",
  "Subtitle margin and line spacing, because the two units are not the same measurement.",
  "Player engine, hardware acceleration and edge margin, because they describe this computer's hardware, not the TV's.",
];
