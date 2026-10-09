import { safeFetch as fetch } from "@/lib/safe-fetch";
import { dwarn } from "@/lib/debug";
import { completedTorrentDownloadFor } from "@/lib/download/downloads-store";
import { hasUncachedMarker, isP2pStream } from "./cached";
import {
  magnetFromHash,
  type DebridResult,
  type DebridStore,
  type DirectLink,
} from "@/lib/debrid/types";
import {
  getPreparedDebridLink,
  invalidatePreparedDebridLink,
} from "@/lib/debrid/playback-preparation";
import {
  beginTorrentPlaybackHandoff,
  lastEngineAddError,
  scheduleAbandonedTorrentRemoval,
  torrentEngineAdd,
  torrentEngineSelect,
  type AddResult,
} from "@/lib/torrent/local-engine";
import {
  buildTorrentStreamUrl,
  createAndListFiles,
  directTorrentEnabled,
  engineP2pEligible,
  isHostedTorrentServerUrl,
  isVideoFile,
  localTorrentAllowed,
  trackersFromSources,
  type TorrentFile,
} from "@/lib/torrent/stremio-stream";
import {
  probeStremioServer,
  remoteStreamServerStrict,
  remoteStreamServerUrl,
} from "@/lib/stremio-server";
import type { ParsedStream, ScoredStream } from "./types";
import { matchEpisodeFileIndex, type EpisodeHint } from "./episode-file";

export type ResolveResult =
  | { ok: true; data: DirectLink; via: string; readiness?: LinkReadiness }
  | { ok: false; code: string; tried: Array<{ slug: string; code: string }>; webUrl?: string };

export type LinkReadiness = {
  exactUrlValidated: boolean;
  method: "provider-size" | "not-checked";
  sizeBytes: number | null;
};

type LinkValidation = { ok: boolean; readiness: LinkReadiness };

const ERROR_VIDEO_MAX_BYTES = 80 * 1024 * 1024;
const VIDEO_EXT_RE =
  /\.(mkv|mp4|avi|mov|m4v|webm|ts|m3u8|mpd|flv|wmv|m2ts|mpg|mpeg|ogv|3gp)(\?|#|$)/i;
const REMOTE_CREATE_TIMEOUT_MS = 15000;

type RemoteEngineFailure = "unreachable" | "no-files" | null;

let lastRemoteEngineFailure: RemoteEngineFailure = null;

async function probeIsWebPage(
  url: string,
  headers: Record<string, string> | undefined,
  signal: AbortSignal,
): Promise<boolean> {
  try {
    const ac = new AbortController();
    const onAbort = () => ac.abort();
    signal.addEventListener("abort", onAbort);
    const timer = setTimeout(() => ac.abort(), 3500);
    const res = await fetch(url, {
      method: "HEAD",
      headers: headers ?? {},
      signal: ac.signal,
    }).finally(() => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    });
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") ?? "";
    return /^\s*(?:text\/html|application\/xhtml)/i.test(ct);
  } catch {
    return false;
  }
}

export async function resolveStream(
  stream: ParsedStream | ScoredStream,
  debrids: DebridStore[],
  signal: AbortSignal,
  userCommitted = false,
  forceP2p = false,
  hint?: EpisodeHint,
  allowP2pFallback = true,
  allowCompletedDownload = true,
): Promise<ResolveResult> {
  const expectedSize = stream.size ?? null;
  const tried: Array<{ slug: string; code: string }> = [];
  if (allowCompletedDownload && stream.infoHash) {
    const completed = await completedTorrentDownloadFor(stream.infoHash, stream.fileIdx, hint);
    if (completed) {
      return {
        ok: true,
        via: "local-download",
        data: {
          url: completed.path,
          fileIdx: completed.torrentFileIdx ?? stream.fileIdx,
          filesize: completed.totalBytes ?? completed.receivedBytes,
          notWebReady: true,
          filename: completed.streamLabel ?? undefined,
          subtitles: stream.subtitles?.map((s) => ({ url: s.url, lang: s.lang, id: s.id })),
        },
      };
    }
  }

  if (forceP2p && stream.infoHash && engineP2pEligible(stream)) {
    const direct = await tryTorrentEngine(stream, signal, hint);
    if (direct) return { ok: true, data: direct, via: "p2p" };
    if (signal.aborted) return { ok: false, code: "aborted", tried };
    return { ok: false, code: engineFailureCode(), tried };
  }

  if (stream.infoHash && isHostedTorrentServerUrl(stream.url) && engineP2pEligible(stream)) {
    const direct = await tryTorrentEngine(stream, signal, hint);
    if (direct) return { ok: true, data: direct, via: "p2p" };
    if (signal.aborted) return { ok: false, code: "aborted", tried };
  }

  if (stream.url && stream.url !== "#") {
    const headers = stream.behaviorHints?.proxyHeaders?.request ?? stream.behaviorHints?.headers;
    const filename = stream.behaviorHints?.filename ?? stream.behaviorHints?.fileName;
    // A manual source selection is already an explicit playback commitment.
    // Let mpv validate an extensionless media URL instead of delaying it behind
    // a separate HEAD request that many signed/CDN URLs reject. Automatic picks
    // retain the webpage guard because they have no user confirmation step.
    if (!userCommitted && !stream.infoHash && !VIDEO_EXT_RE.test(stream.url)) {
      if (await probeIsWebPage(stream.url, headers, signal)) {
        return { ok: false, code: "web-page", tried: [], webUrl: stream.url };
      }
      if (signal.aborted) return { ok: false, code: "aborted", tried };
    }
    const data: DirectLink = {
      url: stream.url,
      filename,
      filesize: stream.behaviorHints?.videoSize,
      headers,
      notWebReady: stream.behaviorHints?.notWebReady,
      subtitles: stream.subtitles?.map((s) => ({ url: s.url, lang: s.lang, id: s.id })),
    };
    const validation = validateLink(data, expectedSize);
    if (validation.ok) {
      return { ok: true, data, via: "direct", readiness: validation.readiness };
    }
    tried.push({ slug: "direct", code: "stub-or-error-video" });
    if (debrids.length === 0 || !stream.infoHash) {
      return { ok: false, code: "stub-or-error-video", tried };
    }
  }
  if (stream.url === "#") {
    return { ok: false, code: "addon-not-configured", tried: [] };
  }
  if (stream.externalUrl) {
    return { ok: false, code: "external-url-only", tried: [] };
  }
  if (stream.ytId) {
    return { ok: false, code: "youtube-only", tried: [] };
  }
  if (stream.nzbUrl) {
    return { ok: false, code: "nzb-needs-external-player", tried: [] };
  }
  if (!stream.infoHash) {
    return { ok: false, code: "no-source", tried };
  }
  if (debrids.length === 0) {
    if (!allowP2pFallback) return { ok: false, code: "no-debrid-configured", tried };
    const direct = await tryTorrentEngine(stream, signal, hint);
    if (direct) return { ok: true, data: direct, via: "p2p" };
    if (signal.aborted) return { ok: false, code: "aborted", tried };
    return { ok: false, code: engineFailureCode(), tried };
  }
  const sorted = sortDebridsForStream(stream, debrids);
  if (!userCommitted) {
    const cachedMap = stream.cached ?? {};
    const libMap = (stream as { inLibrary?: Record<string, boolean> }).inLibrary ?? {};
    const anyCached = sorted.some((d) => cachedMap[d.slug] === true || libMap[d.slug] === true);
    if (!anyCached) {
      return { ok: false, code: "uncached-not-committed", tried };
    }
  }
  const cachedMap = stream.cached ?? {};
  const libMap = (stream as { inLibrary?: Record<string, boolean> }).inLibrary ?? {};
  const anyCached = sorted.some((d) => cachedMap[d.slug] === true || libMap[d.slug] === true);
  if (
    allowP2pFallback &&
    userCommitted &&
    !anyCached &&
    hasUncachedMarker(stream) &&
    engineP2pEligible(stream)
  ) {
    const direct = await tryTorrentEngine(stream, signal, hint);
    if (direct) return { ok: true, data: direct, via: "p2p" };
    if (signal.aborted) return { ok: false, code: "aborted", tried };
  }
  const magnet = magnetFromHash(stream.infoHash);
  for (const d of sorted) {
    if (signal.aborted) {
      return { ok: false, code: "aborted", tried };
    }
    const prepared = await getPreparedDebridLink(stream, d, hint, signal);
    const r: DebridResult<DirectLink> = prepared
      ? { ok: true, data: prepared }
      : await d.playableUrl(magnet, stream.fileIdx, signal, hint);
    if (!r.ok) {
      tried.push({ slug: d.slug, code: r.code });
      if (r.code === "aborted") return { ok: false, code: "aborted", tried };
      continue;
    }
    const validation = validateLink(r.data, expectedSize);
    if (validation.ok) {
      return { ok: true, data: r.data, via: d.slug, readiness: validation.readiness };
    }
    invalidatePreparedDebridLink(stream, d, hint);
    dwarn(
      `[resolve] ${d.slug} returned suspicious link (likely error/downloading video), trying next debrid`,
    );
    tried.push({ slug: d.slug, code: "stub-or-error-video" });
  }
  if (allowP2pFallback && !anyCached) {
    const direct = await tryTorrentEngine(stream, signal, hint);
    if (direct) return { ok: true, data: direct, via: "p2p" };
    if (signal.aborted) return { ok: false, code: "aborted", tried };
    if (directTorrentEnabled()) return { ok: false, code: engineFailureCode(), tried };
  }
  return { ok: false, code: tried[tried.length - 1]?.code ?? "all-debrids-failed", tried };
}

export function shouldPreferP2pDownload(stream: ParsedStream | ScoredStream): boolean {
  return isP2pStream(stream) && engineP2pEligible(stream);
}

function validateLink(link: DirectLink, expectedSize: number | null): LinkValidation {
  if (link.filesize != null && link.filesize > 0) {
    if (link.filesize < ERROR_VIDEO_MAX_BYTES) {
      if (expectedSize == null || expectedSize > ERROR_VIDEO_MAX_BYTES) {
        return {
          ok: false,
          readiness: {
            exactUrlValidated: false,
            method: "provider-size",
            sizeBytes: link.filesize,
          },
        };
      }
    }
    if (
      expectedSize != null &&
      link.filesize < expectedSize * 0.4 &&
      expectedSize > 100 * 1024 * 1024
    ) {
      return {
        ok: false,
        readiness: {
          exactUrlValidated: false,
          method: "provider-size",
          sizeBytes: link.filesize,
        },
      };
    }
    return {
      ok: true,
      readiness: {
        exactUrlValidated: true,
        method: "provider-size",
        sizeBytes: link.filesize,
      },
    };
  }
  return {
    ok: true,
    readiness: { exactUrlValidated: false, method: "not-checked", sizeBytes: null },
  };
}

function sortDebridsForStream(
  stream: ParsedStream | ScoredStream,
  debrids: DebridStore[],
): DebridStore[] {
  return debrids.slice().sort((a, b) => {
    const aCached = stream.cached[a.slug] ? 1 : 0;
    const bCached = stream.cached[b.slug] ? 1 : 0;
    return bCached - aCached;
  });
}

export async function resolveViaDebrids(
  hash: string,
  fileIdx: number | undefined,
  cached: Record<string, boolean>,
  debrids: DebridStore[],
  signal: AbortSignal,
  userCommitted = false,
  inLibrary: Record<string, boolean> = {},
  hint?: EpisodeHint,
): Promise<ResolveResult> {
  if (!hash || debrids.length === 0) return { ok: false, code: "no-debrid-configured", tried: [] };
  const stream = { infoHash: hash, fileIdx, cached } as unknown as ScoredStream;
  const sorted = sortDebridsForStream(stream, debrids);
  if (
    !userCommitted &&
    !sorted.some((d) => cached[d.slug] === true || inLibrary[d.slug] === true)
  ) {
    return { ok: false, code: "uncached-not-committed", tried: [] };
  }
  const magnet = magnetFromHash(hash);
  const tried: Array<{ slug: string; code: string }> = [];
  for (const d of sorted) {
    if (signal.aborted) return { ok: false, code: "aborted", tried };
    const prepared = await getPreparedDebridLink(stream, d, hint, signal);
    const r: DebridResult<DirectLink> = prepared
      ? { ok: true, data: prepared }
      : await d.playableUrl(magnet, fileIdx, signal, hint);
    if (!r.ok) {
      tried.push({ slug: d.slug, code: r.code });
      if (r.code === "aborted") return { ok: false, code: "aborted", tried };
      continue;
    }
    const validation = validateLink(r.data, null);
    if (validation.ok) {
      return { ok: true, data: r.data, via: d.slug, readiness: validation.readiness };
    }
    invalidatePreparedDebridLink(stream, d, hint);
    tried.push({ slug: d.slug, code: "stub-or-error-video" });
  }
  return { ok: false, code: tried[tried.length - 1]?.code ?? "all-debrids-failed", tried };
}

async function tryLocalEngine(
  stream: ParsedStream | ScoredStream,
  signal: AbortSignal,
  hint?: EpisodeHint,
): Promise<DirectLink | null> {
  if (!stream.infoHash || !localTorrentAllowed() || signal.aborted) return null;
  if (remoteStreamServerStrict()) return null;
  const addIdx =
    typeof stream.fileIdx === "number" && stream.fileIdx >= 0 ? stream.fileIdx : undefined;
  const added = await torrentEngineAdd(
    magnetFromHash(stream.infoHash),
    trackersFromSources(stream.sources),
    addIdx,
  );
  if (!added) return null;
  const releaseAbortCleanup = registerAbortCleanup(added, signal);
  let handedOff = false;
  try {
    if (added.files.length === 0 || signal.aborted) return null;
    const filename = stream.behaviorHints?.filename ?? stream.behaviorHints?.fileName ?? null;
    let chosenIdx = stream.fileIdx;
    if (chosenIdx == null || chosenIdx < 0) {
      const season = hint?.season ?? stream.season;
      const episode = hint?.episode ?? stream.episode;
      chosenIdx = selectEngineFileIdx(added.files, season, episode);
    }
    if (!(await torrentEngineSelect(added.info_hash, chosenIdx))) return null;
    if (signal.aborted) return null;
    const engineUrl = `${added.stream_base}/${added.info_hash.toLowerCase()}/${chosenIdx}`;
    handedOff = true;
    return {
      url: engineUrl,
      fileIdx: chosenIdx,
      filename: filename ?? undefined,
      notWebReady: stream.behaviorHints?.notWebReady,
      subtitles: stream.subtitles?.map((s) => ({ url: s.url, lang: s.lang, id: s.id })),
    };
  } finally {
    releaseAbortCleanup();
    if (added.already_managed !== true) {
      if (handedOff) beginTorrentPlaybackHandoff(added.info_hash);
      else scheduleAbandonedTorrentRemoval(added.info_hash, 0);
    }
  }
}

async function tryRemoteEngine(
  stream: ParsedStream | ScoredStream,
  signal: AbortSignal,
  base: string,
  hint?: EpisodeHint,
): Promise<DirectLink | null> {
  if (!stream.infoHash || signal.aborted) return null;
  const trackers = trackersFromSources(stream.sources);
  const season = hint?.season ?? stream.season;
  const episode = hint?.episode ?? stream.episode;
  const created = await createAndListFiles(
    stream.infoHash,
    trackers,
    { season, episode },
    REMOTE_CREATE_TIMEOUT_MS,
    base,
  );
  if (!created || created.files.length === 0 || signal.aborted) return null;
  let chosenIdx = stream.fileIdx;
  if (chosenIdx == null || chosenIdx < 0) {
    chosenIdx = selectEngineFileIdx(created.files, season, episode);
  }
  const filename = stream.behaviorHints?.filename ?? stream.behaviorHints?.fileName ?? null;
  return {
    url: buildTorrentStreamUrl({
      infoHash: stream.infoHash,
      fileIdx: chosenIdx,
      trackers,
      filename,
      base,
    }),
    fileIdx: chosenIdx,
    filename: filename ?? undefined,
    notWebReady: stream.behaviorHints?.notWebReady,
    subtitles: stream.subtitles?.map((s) => ({ url: s.url, lang: s.lang, id: s.id })),
  };
}

async function tryTorrentEngine(
  stream: ParsedStream | ScoredStream,
  signal: AbortSignal,
  hint?: EpisodeHint,
): Promise<DirectLink | null> {
  lastRemoteEngineFailure = null;
  const remoteBase = remoteStreamServerUrl();
  if (remoteBase) {
    if (await probeStremioServer(false, remoteBase)) {
      const remote = await tryRemoteEngine(stream, signal, remoteBase, hint);
      if (remote) return remote;
      lastRemoteEngineFailure = "no-files";
    } else {
      lastRemoteEngineFailure = "unreachable";
    }
  }
  return tryLocalEngine(stream, signal, hint);
}

function registerAbortCleanup(added: AddResult, signal: AbortSignal): () => void {
  if (added.already_managed === true) return () => {};
  const cleanup = () => scheduleAbandonedTorrentRemoval(added.info_hash);
  if (signal.aborted) cleanup();
  else signal.addEventListener("abort", cleanup, { once: true });
  return () => signal.removeEventListener("abort", cleanup);
}

function engineFailureCode(): string {
  if (lastRemoteEngineFailure === "unreachable") {
    return remoteStreamServerStrict()
      ? "remote-server-unreachable-strict"
      : "remote-server-unreachable";
  }
  if (lastRemoteEngineFailure === "no-files") return "engine-no-peers";
  if (!localTorrentAllowed()) return "direct-torrent-disabled";
  const err = lastEngineAddError();
  if (err && /metadata timed out|no peers/i.test(err)) return "engine-no-peers";
  return "engine-not-ready";
}

function selectEngineFileIdx(
  files: TorrentFile[],
  season?: number | null,
  episode?: number | null,
): number {
  const vids = files.filter(isVideoFile);
  const pool = vids.length > 0 ? vids : files;
  const mi = matchEpisodeFileIndex(
    pool.map((f) => f.name),
    { season: season ?? null, episode: episode ?? null },
  );
  if (mi >= 0) return pool[mi].idx;
  const largest = pool.reduce((a, b) => (b.length > a.length ? b : a));
  return largest.idx;
}
