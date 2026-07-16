import type { TrackInfo } from "@/lib/player/bridge";
import { subtitleTrackLanguageLabel, subtitleTrackTitle } from "@/lib/subtitles/track-label";
import type { Group, SubtitleMenuProps } from "./types";

export function buildOverlayState(props: SubtitleMenuProps) {
  return {
    tracks: props.tracks,
    selectedId: props.selectedId,
    delaySec: props.delaySec,
    metaImdbId: props.metaImdbId ?? null,
    metaTitle: props.metaTitle ?? null,
    metaReleaseDate: props.metaReleaseDate ?? null,
    season: props.season ?? null,
    episode: props.episode ?? null,
  };
}

export function groupByLang(tracks: TrackInfo[]): Group[] {
  const map = new Map<string, Group>();
  for (const t of tracks) {
    const display = subtitleTrackLanguageLabel(t);
    const key = display.toLowerCase();
    let g = map.get(key);
    if (!g) {
      g = { langKey: key, langDisplay: display, variants: [] };
      map.set(key, g);
    }
    g.variants.push(t);
  }
  return [...map.values()];
}

export function variantTitle(t: TrackInfo): string {
  return subtitleTrackTitle(t);
}

export function variantSubtitle(t: TrackInfo): string {
  const parts: string[] = [];
  parts.push(t.external ? "External" : "Embedded");
  if (t.codec) parts.push(t.codec);
  if (t.forced) parts.push("Forced");
  if (t.hearingImpaired) parts.push("SDH");
  if (t.default) parts.push("Default");
  return parts.join(" · ");
}

export function isVeryNewRelease(date?: string | null): boolean {
  if (!date) return false;
  const t = Date.parse(date);
  if (Number.isNaN(t)) return false;
  const days = (Date.now() - t) / 86_400_000;
  return days < 14;
}
