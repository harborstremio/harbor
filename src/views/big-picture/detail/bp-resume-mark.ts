import type { Meta } from "@/lib/cinemeta";
import { episodeFromVideoId, type LibraryItem } from "@/lib/stremio";
import type { PlayEpisode } from "@/lib/view";
import { bpPlayEpisode, type BpEpisodeIds } from "../bp-episode-ids";

export type BpResumeMark = { ep?: PlayEpisode; resumed: boolean };

export function bpResumeMark(
  meta: Meta | null,
  entry: LibraryItem | null,
  ids: BpEpisodeIds,
): BpResumeMark {
  const vids = (meta?.videos ?? []).filter((v) => (v.season ?? 0) > 0 && (v.episode ?? 0) > 0);
  if (vids.length === 0) return { resumed: false };
  const sorted = [...vids].sort(
    (a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0),
  );

  if (entry) {
    const season = entry.state?.season ?? 0;
    const episode = entry.state?.episode ?? 0;
    const parsed =
      episode > 0 ? { season, episode } : episodeFromVideoId(entry.state?.video_id ?? "");
    if (parsed?.episode) {
      const hit = sorted.find(
        (v) => (v.season ?? 0) === parsed.season && (v.episode ?? 0) === parsed.episode,
      );
      if (hit) return { ep: bpPlayEpisode(hit, ids), resumed: true };
    }
  }

  return { ep: bpPlayEpisode(sorted[0], ids), resumed: false };
}
