import type { DownloadItem } from "./downloads-store";
import type { PlayEpisode } from "@/lib/view";

type DownloadState = Pick<DownloadItem, "metaId" | "season" | "episode" | "status">;

/** Match only known identities and their corresponding episode numbering. */
export function episodeDownloadStatus(
  downloads: readonly DownloadState[],
  metaId: string,
  episode: PlayEpisode,
): "done" | "downloading" | "paused" | null {
  const identities: Array<[string, number, number]> = [[metaId, episode.season, episode.episode]];
  if (episode.imdbId && episode.imdbSeason != null && episode.imdbEpisode != null) {
    identities.push([episode.imdbId, episode.imdbSeason, episode.imdbEpisode]);
  }
  const native = /^(kitsu:\d+):(\d+)$/.exec(episode.kitsuStreamId ?? "");
  if (native && native[1] !== metaId) identities.push([native[1], 1, Number(native[2])]);

  const matches = downloads.filter((download) =>
    identities.some(
      ([id, season, number]) =>
        download.metaId === id && download.season === season && download.episode === number,
    ),
  );
  for (const status of ["done", "downloading", "paused"] as const) {
    if (matches.some((download) => download.status === status)) return status;
  }
  return null;
}
