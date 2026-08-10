import type { PlayEpisode, PlayerSrc, PlayerSubtitleHints } from "@/lib/view";

export type DownloadPlaybackContext = {
  imdbId?: string;
  imdbIdVerified?: boolean;
  episode?: PlayEpisode;
  subtitleHints?: PlayerSubtitleHints;
};

export function snapshotDownloadPlaybackContext(
  context: DownloadPlaybackContext,
): DownloadPlaybackContext {
  const verifiedImdbId =
    context.imdbIdVerified === true && /^tt\d+$/.test(context.imdbId ?? "")
      ? context.imdbId
      : undefined;
  return {
    ...(verifiedImdbId ? { imdbId: verifiedImdbId, imdbIdVerified: true } : {}),
    ...(context.episode ? { episode: { ...context.episode } } : {}),
    ...(context.subtitleHints ? { subtitleHints: { ...context.subtitleHints } } : {}),
  };
}

export function downloadPlaybackFields(
  context: DownloadPlaybackContext | undefined,
  season: number | null,
  episode: number | null,
  path?: string,
): Pick<PlayerSrc, "imdbId" | "imdbIdVerified" | "episode" | "subtitleHints"> {
  const filename = path?.split(/[\\/]/).pop()?.trim();
  return {
    imdbId: context?.imdbId,
    imdbIdVerified: context?.imdbIdVerified === true,
    episode:
      context?.episode ?? (season != null && episode != null ? { season, episode } : undefined),
    subtitleHints:
      context?.subtitleHints ?? (filename ? { filename, release: filename } : undefined),
  };
}
