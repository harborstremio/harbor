import { safeFetch as fetch } from "@/lib/safe-fetch";
import { dwarn } from "@/lib/debug";
import { hasUncachedMarker } from "./cached";
import {
  magnetFromHash,
  type DebridResult,
  type DebridStore,
  type DirectLink,
} from "@/lib/debrid/types";
import {
  lastEngineAddError,
  torrentEngineAdd,
  torrentEngineSelect,
} from "@/lib/torrent/local-engine";
import { fullDownloadEnabled, startFullDownload } from "@/lib/torrent/full-download";
import {
  directTorrentEnabled,
  engineP2pEligible,
  isVideoFile,
  localTorrentAllowed,
  trackersFromSources,
  type TorrentFile,
} from "@/lib/torrent/stremio-stream";
import type { ParsedStream, ScoredStream } from "./types";
import { matchEpisodeFileIndex, type EpisodeHint } from "./episode-file";

export type ResolveResult =
  | { ok: true; data: DirectLink; via: string }
  | { ok: false; code: string; tried: Array<{ slug: string; code: string }>; webUrl?: string };

const ERROR_VIDEO_MAX_BYTES = 80 * 1024 * 1024;
const VIDEO_EXT_RE =
  /\.(mkv|mp4|avi|mov|m4v|webm|ts|m3u8|mpd|flv|wmv|m2ts|mpg|mpeg|ogv|3gp)(\?|#|$)/i;

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
): Promise<ResolveResult> {
  const expectedSize = stream.size ?? null;
  const tried: Array<{ slug: string; code: string }> = [];

  if (forceP2p && stream.infoHash && engineP2pEligible(stream)) {
    const direct = await tryTorrentEngine(stream, hint);
    if (direct) return { ok: true, data: direct, via: "p2p" };
    return { ok: false, code: engineFailureCode(), tried };
  }

  if (stream.url && stream.url !== "#") {
    const headers = stream.behaviorHints?.proxyHeaders?.request ?? stream.behaviorHints?.headers;
    const filename = stream.behaviorHints?.filename ?? stream.behaviorHints?.fileName;
    if (!stream.infoHash && !VIDEO_EXT_RE.test(stream.url)) {
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
    const ok = await validateLink(data, expectedSize, headers, signal, false);
    if (ok) return { ok: true, data, via: "direct" };
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
    const direct = await tryTorrentEngine(stream, hint);
    if (direct) return { ok: true, data: direct, via: "p2p" };
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
    const direct = await tryTorrentEngine(stream, hint);
    if (direct) return { ok: true, data: direct, via: "p2p" };
  }
  const magnet = magnetFromHash(stream.infoHash);
  for (const d of sorted) {
    if (signal.aborted) {
      return { ok: false, code: "aborted", tried };
    }
    const r: DebridResult<DirectLink> = await d.playableUrl(magnet, stream.fileIdx, signal, hint);
    if (!r.ok) {
      tried.push({ slug: d.slug, code: r.code });
      if (r.code === "aborted") return { ok: false, code: "aborted", tried };
      continue;
    }
    const ok = await validateLink(r.data, expectedSize, r.data.headers, signal);
    if (ok) {
      if (fullDownloadEnabled()) startFullDownload(stream.infoHash.toLowerCase(), r.data.url);
      return { ok: true, data: r.data, via: d.slug };
    }
    dwarn(
      `[resolve] ${d.slug} returned suspicious link (likely error/downloading video), trying next debrid`,
    );
    tried.push({ slug: d.slug, code: "stub-or-error-video" });
  }
  if (allowP2pFallback) {
    const direct = await tryTorrentEngine(stream, hint);
    if (direct) return { ok: true, data: direct, via: "p2p" };
    if (directTorrentEnabled()) return { ok: false, code: engineFailureCode(), tried };
  }
  return { ok: false, code: tried[tried.length - 1]?.code ?? "all-debrids-failed", tried };
}

async function validateLink(
  link: DirectLink,
  expectedSize: number | null,
  headers: Record<string, string> | undefined,
  signal: AbortSignal,
  allowNetwork = true,
): Promise<boolean> {
  if (link.filesize != null && link.filesize > 0) {
    if (link.filesize < ERROR_VIDEO_MAX_BYTES) {
      if (expectedSize == null || expectedSize > ERROR_VIDEO_MAX_BYTES) {
        return false;
      }
    }
    if (
      expectedSize != null &&
      link.filesize < expectedSize * 0.4 &&
      expectedSize > 100 * 1024 * 1024
    ) {
      return false;
    }
    return true;
  }
  if (!allowNetwork) return true;
  try {
    const ac = new AbortController();
    const onAbort = () => ac.abort();
    signal.addEventListener("abort", onAbort);
    const timer = setTimeout(() => ac.abort(), 5000);
    const headRes = await fetch(link.url, {
      method: "HEAD",
      headers: headers ?? {},
      signal: ac.signal,
    }).finally(() => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    });
    if (!headRes.ok) return true;
    const lenStr = headRes.headers.get("content-length");
    if (!lenStr) return true;
    const len = parseInt(lenStr, 10);
    if (!Number.isFinite(len) || len <= 0) return true;
    if (
      len < ERROR_VIDEO_MAX_BYTES &&
      (expectedSize == null || expectedSize > ERROR_VIDEO_MAX_BYTES)
    ) {
      return false;
    }
    if (expectedSize != null && len < expectedSize * 0.4 && expectedSize > 100 * 1024 * 1024) {
      return false;
    }
    return true;
  } catch {
    return true;
  }
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
    const r: DebridResult<DirectLink> = await d.playableUrl(magnet, fileIdx, signal, hint);
    if (!r.ok) {
      tried.push({ slug: d.slug, code: r.code });
      if (r.code === "aborted") return { ok: false, code: "aborted", tried };
      continue;
    }
    const ok = await validateLink(r.data, null, r.data.headers, signal);
    if (ok) {
      if (fullDownloadEnabled()) startFullDownload(hash.toLowerCase(), r.data.url);
      return { ok: true, data: r.data, via: d.slug };
    }
    tried.push({ slug: d.slug, code: "stub-or-error-video" });
  }
  return { ok: false, code: tried[tried.length - 1]?.code ?? "all-debrids-failed", tried };
}

async function tryLocalEngine(
  stream: ParsedStream | ScoredStream,
  hint?: EpisodeHint,
): Promise<DirectLink | null> {
  if (!stream.infoHash || !localTorrentAllowed()) return null;
  const addIdx =
    typeof stream.fileIdx === "number" && stream.fileIdx >= 0 ? stream.fileIdx : undefined;
  const added = await torrentEngineAdd(
    magnetFromHash(stream.infoHash),
    trackersFromSources(stream.sources),
    addIdx,
  );
  if (!added || added.files.length === 0) return null;
  const filename = stream.behaviorHints?.filename ?? stream.behaviorHints?.fileName ?? null;
  let chosenIdx = stream.fileIdx;
  if (chosenIdx == null || chosenIdx < 0) {
    const season = hint?.season ?? stream.season;
    const episode = hint?.episode ?? stream.episode;
    chosenIdx = selectEngineFileIdx(added.files, season, episode);
  }
  await torrentEngineSelect(added.info_hash, chosenIdx);
  const engineUrl = `${added.stream_base}/${added.info_hash.toLowerCase()}/${chosenIdx}`;
  if (fullDownloadEnabled()) startFullDownload(added.info_hash.toLowerCase(), engineUrl);
  return {
    url: engineUrl,
    fileIdx: chosenIdx,
    filename: filename ?? undefined,
    notWebReady: stream.behaviorHints?.notWebReady,
    subtitles: stream.subtitles?.map((s) => ({ url: s.url, lang: s.lang, id: s.id })),
  };
}

async function tryTorrentEngine(
  stream: ParsedStream | ScoredStream,
  hint?: EpisodeHint,
): Promise<DirectLink | null> {
  return tryLocalEngine(stream, hint);
}

function engineFailureCode(): string {
  if (!localTorrentAllowed()) return "direct-torrent-disabled";
  const err = lastEngineAddError();
  if (err && /timed out|no peers/i.test(err)) return "engine-no-peers";
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
