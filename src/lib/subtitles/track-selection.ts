import { langScore } from "./language.ts";

type SelectableSubtitleTrack = {
  id: string;
  lang?: string;
  default?: boolean;
  external?: boolean;
  title?: string;
  label?: string;
};

function isForcedTrack(track: SelectableSubtitleTrack): boolean {
  return /\bforced\b/i.test(`${track.title ?? ""} ${track.label ?? ""}`);
}

function sourceRank(track: SelectableSubtitleTrack, preferEmbedded: boolean): number {
  if (!track.external) return preferEmbedded ? 3 : 0;
  const text = `${track.title ?? ""} ${track.label ?? ""}`.toLowerCase();
  return text.includes("opensubtitles") ? 1 : 2;
}

export function pickDesiredSubtitleTrack<T extends SelectableSubtitleTrack>(
  tracks: T[],
  preferredLanguages: string[],
  preferEmbedded: boolean,
): T | null {
  const matching = tracks.filter(
    (track) => !isForcedTrack(track) && langScore(track.lang ?? "", preferredLanguages) >= 0,
  );
  if (matching.length === 0) return null;
  matching.sort((a, b) => {
    const languageDelta =
      langScore(b.lang ?? "", preferredLanguages) - langScore(a.lang ?? "", preferredLanguages);
    if (languageDelta !== 0) return languageDelta;
    const sourceDelta = sourceRank(b, preferEmbedded) - sourceRank(a, preferEmbedded);
    if (sourceDelta !== 0) return sourceDelta;
    return Number(b.default === true) - Number(a.default === true);
  });
  return matching[0];
}
