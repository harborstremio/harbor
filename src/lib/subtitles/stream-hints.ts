import { detectSource, parseRelease, type ReleaseTags } from "./release-match";

export type StreamHints = {
  release?: string | null;
  source?: string | null;
  resolution?: string | null;
  season?: number | null;
  episode?: number | null;
  preferHearingImpaired?: boolean;
};

export function streamTagsOf(hints: StreamHints): ReleaseTags {
  const parsed = parseRelease(hints.release);
  return {
    ...parsed,
    // The release name is more specific than the addon's broad source badge.
    // For example, a stream may be labelled "BluRay" while its release name
    // identifies it as a REMUX. Do not discard that stronger timing evidence.
    source: parsed.source ?? detectSource(hints.source),
    resolution: normalizeResolution(hints.resolution) ?? parsed.resolution,
    season: hints.season ?? parsed.season,
    episode: hints.episode ?? parsed.episode,
    episodeEnd: hints.episode ?? parsed.episodeEnd,
  };
}

function normalizeResolution(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.toLowerCase();
  if (value === "4k" || value === "uhd" || value.includes("2160")) return "2160p";
  const match = value.match(/(2160|1080|720|576|480)/);
  return match ? `${match[1]}p` : null;
}
