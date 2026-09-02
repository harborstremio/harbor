export type EpisodeHint = { season: number | null; episode: number | null };
import { episodeSpanContains, parseEpisodeSpan } from "@/lib/episode-span";

const VIDEO_EXT_RE = /\.(mkv|mp4|avi|mov|m4v|webm|ts|flv|wmv|m2ts|mpg|mpeg|ogv|3gp)(\?|#|$)/i;

export function episodeFileRegex(season: number, episode: number): RegExp {
  const s = String(season).padStart(2, "0");
  const e = String(episode).padStart(2, "0");
  return new RegExp(
    `s0*${season}[^0-9]?e0*${episode}(?![0-9])|(?<![A-Za-z0-9])${s}${e}(?![0-9])|\\b${season}x0*${episode}(?![0-9])`,
    "i",
  );
}

export function episodeVariantMatch(text: string, season: number | null, episode: number): boolean {
  const span = parseEpisodeSpan(text);
  if (span && season != null) return episodeSpanContains(span, season, episode);
  if (season != null && episodeFileRegex(season, episode).test(text)) return true;
  if (
    season != null &&
    new RegExp(`season\\s*0*${season}\\s*(?:episode|ep|e)\\s*0*${episode}(?![0-9])`, "i").test(text)
  ) {
    return true;
  }
  const hasSeasonToken =
    season == null ||
    new RegExp(`(?:^|[^a-z0-9])(?:s0*${season}|season\\s*0*${season})(?![0-9])`, "i").test(text);
  return hasSeasonToken && new RegExp(`(?:^|[^a-z0-9])e0*${episode}(?![0-9])`, "i").test(text);
}

export function matchEpisodeFileIndex(names: string[], hint: EpisodeHint | undefined): number {
  if (!hint || hint.season == null || hint.episode == null) return -1;
  const re = episodeFileRegex(hint.season, hint.episode);
  let anyMatch = -1;
  for (let i = 0; i < names.length; i++) {
    const name = names[i] ?? "";
    const span = parseEpisodeSpan(name);
    if (!(span ? episodeSpanContains(span, hint.season, hint.episode) : re.test(name))) continue;
    if (VIDEO_EXT_RE.test(name)) return i;
    if (anyMatch < 0) anyMatch = i;
  }
  return anyMatch;
}
