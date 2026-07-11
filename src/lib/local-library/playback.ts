import type { Meta } from "@/lib/cinemeta";
import { findLocalEpisodeByIds, findLocalMovie, type LocalEntry } from "@/lib/local-library";
import { episodeLabel } from "@/lib/local-library/player-src";
import { openWatchLocalConfirm } from "@/lib/player/watch-local-confirm";
import { readResumeMs } from "@/lib/resume";

export type LocalPlaybackMode = "ask" | "local" | "stream";

function idsFromMeta(meta: Meta, extraImdb?: string | null): { tmdbId: number | null; imdbId: string | null } {
  let tmdbId: number | null = null;
  let imdbId: string | null = extraImdb ?? null;
  const id = meta.id;
  const m = id.match(/^tmdb:(?:movie|tv):(\d+)$/);
  if (m) tmdbId = parseInt(m[1], 10);
  else if (id.startsWith("tt")) imdbId = imdbId ?? id;
  return { tmdbId, imdbId };
}

export function resolveLocalPlay(
  meta: Meta,
  episode?: { season: number; episode: number } | null,
  extraImdb?: string | null,
): LocalEntry | null {
  const { tmdbId, imdbId } = idsFromMeta(meta, extraImdb);
  if (tmdbId == null && imdbId == null) return null;
  if (episode && episode.season != null && episode.episode != null) {
    return findLocalEpisodeByIds(episode.season, episode.episode, tmdbId, imdbId);
  }
  return findLocalMovie(tmdbId, imdbId);
}

export function playLocalAware(opts: {
  meta: Meta;
  episode?: { season: number; episode: number } | null;
  extraImdb?: string | null;
  mode: LocalPlaybackMode;
  source: "manual" | "auto";
  playLocal: (entry: LocalEntry, opts?: { fromStart?: boolean }) => void;
  playStream: () => void;
  setMode: (mode: LocalPlaybackMode) => void;
  resumeId?: string;
}): void {
  const { meta, episode, extraImdb, mode, source, playLocal, playStream, setMode, resumeId } = opts;
  const local = mode === "stream" ? null : resolveLocalPlay(meta, episode, extraImdb);
  if (!local) {
    playStream();
    return;
  }
  if (source === "auto" || mode === "local") {
    playLocal(local);
    return;
  }
  const rid = resumeId ?? local.imdbId ?? `local:${local.id}`;
  const resumeMs = readResumeMs(rid, episode?.season, episode?.episode);
  const hasResume = resumeMs > 5000;
  openWatchLocalConfirm({
    title: local.title || meta.name,
    subtitle: episodeLabel(local),
    hasResume,
    resumeMs,
    onChoose: (choice, remember) => {
      if (remember) setMode(choice === "stream" ? "stream" : "local");
      if (choice === "stream") playStream();
      else playLocal(local, { fromStart: choice === "local-restart" });
    },
  });
}
