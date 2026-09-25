import type { PlayEpisode } from "@/lib/view";
import type { DownloadItem } from "./downloads-store";

/** An older failed/canceled copy must not hide a currently active transfer. */
export function contextDownloadTask(
  downloads: readonly DownloadItem[],
  metaId: string,
  episode?: Pick<PlayEpisode, "season" | "episode">,
): DownloadItem | null {
  const matching = downloads.filter(
    (item) =>
      item.metaId === metaId &&
      item.season === (episode?.season ?? null) &&
      item.episode === (episode?.episode ?? null),
  );
  return (
    matching.find(
      (item) => item.status !== "error" && item.status !== "canceled" && item.status !== "done",
    ) ??
    matching.sort((a, b) => b.startedAt - a.startedAt)[0] ??
    null
  );
}

export function downloadRequestVisibility(
  request: { actorKey: string; path: string; token: string },
  current: { actorKey: string; path: string; pickerToken?: string },
): "panel" | "picker" | "invalid" {
  if (request.actorKey !== current.actorKey) return "invalid";
  if (current.pickerToken === request.token) return "picker";
  return current.path === request.path && !current.pickerToken ? "panel" : "invalid";
}

/** Enrichment must not replace a captured provider/episode identity with display coordinates. */
export function selectedDownloadEpisode(
  episode: PlayEpisode,
  requested?: PlayEpisode,
): PlayEpisode {
  return requested?.season === episode.season && requested.episode === episode.episode
    ? { ...episode, ...requested }
    : episode;
}
