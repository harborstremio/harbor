import type { Addon } from "@/lib/addons";
import {
  findDownloadSources,
  resolveBestDownload,
  resolveDownloadSource,
  type ResolveOptions,
} from "@/lib/auto-download/resolve";
import type { Meta } from "@/lib/cinemeta";
import type { DebridStore } from "@/lib/debrid/types";
import { magnetFromHash } from "@/lib/debrid/types";
import { resolveStream } from "@/lib/streams/resolve";
import { matchEpisodeFileIndex } from "@/lib/streams/episode-file";
import type { ScoredStream } from "@/lib/streams/types";
import type { PlayEpisode } from "@/lib/view";
import { isVideoFile } from "@/lib/local-library";
import { localTorrentAllowed, trackersFromSources } from "@/lib/torrent/stremio-stream";
import {
  torrentEngineAdd,
  torrentEngineSelectSet,
  type EngineFile,
} from "@/lib/torrent/local-engine";
import { downloadsSnapshot, enqueueDownload } from "@/lib/download/downloads-store";
import { episodeDownloadStatus } from "./episode-download-state";
import { seasonPackFileMatchesEpisode, streamForSeasonPackEpisode } from "./season-pack";
import { discoverReviewRows, resolveReviewSelections } from "./review-operations";

const MAX_CONCURRENT = 2;

function limiter(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const release = () => {
    active -= 1;
    queue.shift()?.();
  };
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (active >= max) await new Promise<void>((r) => queue.push(r));
    active += 1;
    try {
      return await fn();
    } finally {
      release();
    }
  };
}

export function pendingSeasonEpisodes(metaId: string, episodes: PlayEpisode[]): PlayEpisode[] {
  const downloads = downloadsSnapshot();
  return episodes.filter((ep) => episodeDownloadStatus(downloads, metaId, ep) === null);
}

export type SeasonDownloadResult = {
  total: number;
  queued: number;
  failed: number;
};

export type SeasonReviewCandidate = {
  episode: PlayEpisode;
  candidates: ScoredStream[];
};

export type SeasonReviewDownloadResult = {
  episode: PlayEpisode;
  status: "queued" | "failed" | "skipped" | "already-queued";
};

export async function findSeasonDownloadSources(
  meta: Meta,
  episodes: PlayEpisode[],
  options: ResolveOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<SeasonReviewCandidate[]> {
  const targets = pendingSeasonEpisodes(meta.id, episodes);
  return discoverReviewRows(
    targets,
    (episode) => findDownloadSources(meta, episode, options),
    options.signal,
    onProgress,
  );
}

export async function downloadReviewedSeasonEpisodes(
  meta: Meta,
  selections: Array<{ episode: PlayEpisode; stream: ScoredStream | null }>,
  options: ResolveOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<SeasonReviewDownloadResult[]> {
  const pendingKeys = new Set(
    pendingSeasonEpisodes(
      meta.id,
      selections.map((selection) => selection.episode),
    ).map((episode) => `${episode.season}:${episode.episode}`),
  );
  const targets = selections.filter(
    (selection): selection is { episode: PlayEpisode; stream: ScoredStream } =>
      selection.stream !== null &&
      pendingKeys.has(`${selection.episode.season}:${selection.episode.episode}`),
  );
  const results: SeasonReviewDownloadResult[] = selections.map(({ episode, stream }) => ({
    episode,
    status: !stream
      ? "skipped"
      : pendingKeys.has(`${episode.season}:${episode.episode}`)
        ? "failed"
        : "already-queued",
  }));
  const queued = await resolveReviewSelections(
    targets.map(({ episode, stream }) => ({ episode, candidate: stream })),
    async (episode, stream) => {
      const pick = await resolveDownloadSource(meta, episode, stream, options);
      if (!pick || options.signal.aborted)
        throw new Error("The selected source could not be resolved.");
      await enqueueDownload({
        meta,
        episode,
        streamLabel: pick.label,
        url: pick.url,
        headers: pick.headers ?? null,
      });
    },
    options.signal,
    onProgress,
  );
  for (const result of queued) {
    if (!result) continue;
    const index = results.findIndex(
      (item) =>
        item.episode.season === result.episode.season &&
        item.episode.episode === result.episode.episode,
    );
    if (index >= 0) results[index] = result;
  }
  return results;
}

function packFileForEpisode(files: EngineFile[], ep: PlayEpisode): number {
  const vids = files.filter((f) => isVideoFile(f.name));
  const pool = vids.length > 0 ? vids : files;
  const mi = matchEpisodeFileIndex(
    pool.map((f) => f.name),
    { season: ep.imdbSeason ?? ep.season ?? null, episode: ep.imdbEpisode ?? ep.episode ?? null },
  );
  return mi >= 0 ? pool[mi].idx : -1;
}

// A season pack is a single multi-file torrent. Add it once, match every wanted
// episode to its file, then select that whole set of files in one call so the
// engine downloads exactly those episodes. This replaces the old per-episode
// re-add loop, which re-added the same torrent with "all files" selected on an
// already-running torrent and quietly downloaded the entire season.
async function downloadPackViaEngine(
  meta: Meta,
  targets: PlayEpisode[],
  stream: ScoredStream,
  streamLabel: string | null,
  signal: AbortSignal,
): Promise<SeasonDownloadResult | null> {
  const hash = stream.infoHash;
  if (!hash) return null;
  const added = await torrentEngineAdd(magnetFromHash(hash), trackersFromSources(stream.sources));
  if (!added || added.files.length === 0 || signal.aborted) return null;

  const result: SeasonDownloadResult = { total: targets.length, queued: 0, failed: 0 };
  const picks: Array<{ ep: PlayEpisode; idx: number }> = [];
  const usedIdx = new Set<number>();
  for (const ep of targets) {
    const idx = packFileForEpisode(added.files, ep);
    if (idx < 0 || usedIdx.has(idx)) {
      result.failed += 1;
      continue;
    }
    usedIdx.add(idx);
    picks.push({ ep, idx });
  }
  if (picks.length === 0) return result;

  await torrentEngineSelectSet(
    added.info_hash,
    picks.map((p) => p.idx),
  );

  const base = `${added.stream_base}/${added.info_hash.toLowerCase()}`;
  for (const { ep, idx } of picks) {
    if (signal.aborted) break;
    try {
      await enqueueDownload({
        meta,
        episode: ep,
        streamLabel,
        url: `${base}/${idx}`,
        headers: null,
      });
      result.queued += 1;
    } catch {
      result.failed += 1;
    }
  }
  return result;
}

export async function downloadSeasonFromPack({
  meta,
  episodes,
  stream,
  streamLabel,
  debrids,
  signal,
}: {
  meta: Meta;
  episodes: PlayEpisode[];
  stream: ScoredStream;
  streamLabel: string | null;
  debrids: DebridStore[];
  signal: AbortSignal;
}): Promise<SeasonDownloadResult> {
  const targets = pendingSeasonEpisodes(meta.id, episodes);
  const result: SeasonDownloadResult = { total: targets.length, queued: 0, failed: 0 };
  if (targets.length === 0 || signal.aborted) return result;

  // P2P path: one torrent, one atomic multi-file selection.
  if (stream.infoHash && localTorrentAllowed()) {
    const viaEngine = await downloadPackViaEngine(meta, targets, stream, streamLabel, signal).catch(
      () => null,
    );
    if (viaEngine) return viaEngine;
  }

  // Debrid / no-P2P fallback: resolve each episode on its own. No shared torrent
  // here, so there is nothing to run away.
  const packStream = streamForSeasonPackEpisode(stream);
  const limit = limiter(MAX_CONCURRENT);
  await Promise.all(
    targets.map((ep) =>
      limit(async () => {
        if (signal.aborted) return;
        const resolved = await resolveStream(
          packStream,
          debrids,
          signal,
          true,
          false,
          {
            season: ep.imdbSeason ?? ep.season ?? null,
            episode: ep.imdbEpisode ?? ep.episode ?? null,
          },
          true,
        ).catch(() => null);
        if (!resolved?.ok || signal.aborted) {
          if (!signal.aborted) result.failed += 1;
          return;
        }
        if (resolved.data.filename && !seasonPackFileMatchesEpisode(resolved.data.filename, ep)) {
          result.failed += 1;
          return;
        }
        try {
          await enqueueDownload({
            meta,
            episode: ep,
            streamLabel,
            url: resolved.data.url,
            headers: resolved.data.headers ?? null,
          });
          result.queued += 1;
        } catch {
          result.failed += 1;
        }
      }),
    ),
  );
  return result;
}

export async function downloadSeasonPerEpisode({
  meta,
  episodes,
  addons,
  debrids,
  allowP2p,
  signal,
  onProgress,
}: {
  meta: Meta;
  episodes: PlayEpisode[];
  addons: Addon[];
  debrids: DebridStore[];
  allowP2p: boolean;
  signal: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}): Promise<SeasonDownloadResult> {
  const targets = pendingSeasonEpisodes(meta.id, episodes);
  const result: SeasonDownloadResult = { total: targets.length, queued: 0, failed: 0 };
  if (targets.length === 0 || signal.aborted) return result;

  let settled = 0;
  const limit = limiter(MAX_CONCURRENT);
  await Promise.all(
    targets.map((ep) =>
      limit(async () => {
        if (signal.aborted) return;
        const hit = await resolveBestDownload(meta, ep, {
          allowP2p,
          maxHeight: null,
          imdbId: null,
          debrids,
          addons,
          signal,
        }).catch(() => null);
        if (signal.aborted) return;
        if (!hit) {
          result.failed += 1;
        } else {
          try {
            await enqueueDownload({
              meta,
              episode: ep,
              streamLabel: hit.label,
              url: hit.url,
              headers: hit.headers ?? null,
            });
            result.queued += 1;
          } catch {
            result.failed += 1;
          }
        }
        settled += 1;
        onProgress?.(settled, targets.length);
      }),
    ),
  );
  return result;
}
