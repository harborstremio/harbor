import type { TrackInfo } from "../player/bridge";

export type EmbeddedSubtitleIdentity = { ffIndex: number; subIndex: number };

type SubtitlePreselect = {
  off: boolean;
  url?: string;
  embedded?: EmbeddedSubtitleIdentity;
};

type SubtitleMediaIdentity = {
  url: string;
  meta?: { id?: string };
  episode?: { season?: number; episode?: number };
};

export function shouldEnforceSubtitleOff(
  choice: SubtitlePreselect | undefined,
  storedOff: boolean,
): boolean {
  return choice ? choice.off : storedOff;
}

export function enforceSubtitleOff(
  choice: SubtitlePreselect | undefined,
  storedOff: boolean,
  tracks: { selected: boolean }[],
  clear: () => void,
): boolean {
  if (!shouldEnforceSubtitleOff(choice, storedOff) || !tracks.some((track) => track.selected)) {
    return false;
  }
  clear();
  return true;
}

export function applySubtitleOffPreselect(
  tracks: { selected: boolean }[],
  clear: () => void,
): boolean {
  if (tracks.length === 0) return false;
  enforceSubtitleOff({ off: true }, false, tracks, clear);
  return true;
}

export function shouldEnforceStoredSubtitleOff(
  choice: SubtitlePreselect | undefined,
  storedOff: boolean,
): boolean {
  return choice === undefined && storedOff;
}

export function enforceStoredSubtitleOff(
  choice: SubtitlePreselect | undefined,
  storedOff: boolean,
  tracks: { selected: boolean }[],
  clear: () => void,
): boolean {
  if (
    !shouldEnforceStoredSubtitleOff(choice, storedOff) ||
    !tracks.some((track) => track.selected)
  ) {
    return false;
  }
  clear();
  return true;
}

export function resolveEmbeddedSubtitleTrack(
  tracks: TrackInfo[],
  identity: EmbeddedSubtitleIdentity,
): TrackInfo | null {
  const embedded = tracks.filter(
    (track) => track.kind === "subtitle" && track.external !== true && !track.url,
  );
  const exact = embedded.find((track) => track.ffIndex === identity.ffIndex);
  if (exact) return exact;

  // Once mpv exposes container indices, an ordinal fallback could select a sibling track.
  if (embedded.some((track) => track.ffIndex !== undefined)) return null;
  return embedded[identity.subIndex] ?? null;
}

export function applyEmbeddedSubtitlePreselect(
  tracks: TrackInfo[],
  identity: EmbeddedSubtitleIdentity,
  select: (runtimeId: string) => void,
): boolean {
  const track = resolveEmbeddedSubtitleTrack(tracks, identity);
  if (!track) return false;
  select(track.id);
  return true;
}

export function subtitlePreselectApplyKey(
  src: SubtitleMediaIdentity,
  choice: SubtitlePreselect,
): string {
  const selection = choice.off
    ? ["off"]
    : choice.embedded
      ? ["embedded", choice.embedded.ffIndex, choice.embedded.subIndex]
      : ["external", choice.url ?? ""];
  return JSON.stringify([
    src.meta?.id ?? "",
    src.episode?.season ?? null,
    src.episode?.episode ?? null,
    src.url,
    selection,
  ]);
}
