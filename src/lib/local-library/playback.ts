import type { Meta } from "@/lib/cinemeta";
import { type LocalEntry } from "@/lib/local-library";
import { findLocalEpisodeVersions, findLocalMovieVersions } from "@/lib/local-library/versions";
import { openLocalVersions } from "@/lib/player/local-versions-modal";
import { episodeLabel } from "@/lib/local-library/player-src";
import { readResumeMs } from "@/lib/resume";
import { openWatchLocalConfirm } from "@/lib/player/watch-local-confirm";

export type LocalPlaybackMode = "ask" | "local" | "stream";

function idsFromMeta(
  meta: Meta,
  extraImdb?: string | null,
): { tmdbId: number | null; imdbId: string | null } {
  let tmdbId: number | null = null;
  let imdbId: string | null = extraImdb ?? null;
  const id = meta.id;
  const m = id.match(/^tmdb:(?:movie|tv):(\d+)$/);
  if (m) tmdbId = parseInt(m[1], 10);
  else if (id.startsWith("tt")) imdbId = imdbId ?? id;
  return { tmdbId, imdbId };
}

/** Every local file for this title/episode, best version first. */
export function resolveLocalPlayVersions(
  meta: Meta,
  episode?: { season: number; episode: number } | null,
  extraImdb?: string | null,
): LocalEntry[] {
  const { tmdbId, imdbId } = idsFromMeta(meta, extraImdb);
  if (tmdbId == null && imdbId == null) return [];
  if (episode && episode.season != null && episode.episode != null) {
    return findLocalEpisodeVersions(episode.season, episode.episode, tmdbId, imdbId);
  }
  return findLocalMovieVersions(tmdbId, imdbId);
}

export function resolveLocalPlay(
  meta: Meta,
  episode?: { season: number; episode: number } | null,
  extraImdb?: string | null,
): LocalEntry | null {
  return resolveLocalPlayVersions(meta, episode, extraImdb)[0] ?? null;
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
  const versions = mode === "stream" ? [] : resolveLocalPlayVersions(meta, episode, extraImdb);
  const local = versions[0] ?? null;
  if (!local) {
    playStream();
    return;
  }
  // Autoplay must not stall on a dialog, so it takes the best version. A
  // deliberate press with more than one file on disk always gets to choose.
  if (source === "auto") {
    playLocal(local);
    return;
  }
  // Runs after the local-vs-stream decision, never instead of it.
  const goLocal = (fromStart?: boolean) => {
    if (versions.length < 2) {
      playLocal(local, { fromStart });
      return;
    }
    openLocalVersions({
      title: local.title || meta.name,
      poster: meta.poster ?? null,
      entries: versions,
      onPlayLocal: (entry) => playLocal(entry, { fromStart }),
    });
  };
  if (mode === "local") {
    goLocal();
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
      else goLocal(choice === "local-restart");
    },
  });
}
