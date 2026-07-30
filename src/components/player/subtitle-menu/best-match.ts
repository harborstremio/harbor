import type { TrackInfo } from "@/lib/player/bridge";
import { releaseAffinity } from "@/lib/subtitles/release-match";
import { streamTagsOf, type StreamHints } from "@/lib/subtitles/search";

export type MatchVerdict = { track: TrackInfo; score: number; reasons: string[] };

const EMBEDDED_BONUS = 60;

function textOf(t: TrackInfo): string {
  return `${t.release ?? ""} ${t.title ?? ""} ${t.label ?? ""} ${t.externalFilename ?? ""}`;
}

export function rankByRelease(tracks: TrackInfo[], hints: StreamHints | null): MatchVerdict[] {
  if (!hints) return [];
  const tags = streamTagsOf(hints);
  return tracks
    .map((track) => {
      if (!track.external) {
        return { track, score: EMBEDDED_BONUS, reasons: ["muxed into this file"] };
      }
      const { score, reasons } = releaseAffinity(tags, textOf(track));
      return { track, score, reasons };
    })
    .sort((a, b) => b.score - a.score);
}

export function pickBestMatch(pool: TrackInfo[], hints: StreamHints | null): MatchVerdict | null {
  const ranked = rankByRelease(pool, hints);
  const top = ranked[0];
  return top && top.score > 0 ? top : null;
}
