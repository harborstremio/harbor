import { engineBaseFor, getStremioServerUrl, isLocalEngineUrl } from "@/lib/stremio-server";
import { torrentEngineStats } from "@/lib/torrent/local-engine";

export type EngineStats = {
  peers: number;
  unchoked: number;
  downloaded: number;
  downloadSpeed: number;
  streamProgress: number;
  streamLen: number | null;
  peerSearchRunning: boolean;
  sawData: boolean;
};

export type StatsFetch = { kind: "ok"; stats: EngineStats } | { kind: "empty" } | { kind: "down" };

const GENUINE_FAILURE_WINDOW_MS = 22_000;
const COLD_CONNECT_DEADLINE_MS = 45_000;
const ENGINE_DOWN_STRIKES = 4;

function num(o: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return 0;
}

function bool(o: Record<string, unknown>, ...keys: string[]): boolean {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "boolean") return v;
  }
  return false;
}

function numOrNull(o: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  }
  return null;
}

export function parseEngineStats(raw: unknown, prev: EngineStats | null): EngineStats {
  const base: EngineStats = prev ?? {
    peers: 0,
    unchoked: 0,
    downloaded: 0,
    downloadSpeed: 0,
    streamProgress: 0,
    streamLen: null,
    peerSearchRunning: false,
    sawData: false,
  };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const peers = num(o, "peers", "numPeers");
  const unchoked = num(o, "unchoked", "unchokedPeers");
  const downloaded = num(o, "downloaded");
  const downloadSpeed = num(o, "downloadSpeed", "speed");
  const streamProgress = num(o, "streamProgress", "progress");
  const anyNonZero =
    peers > 0 || unchoked > 0 || downloaded > 0 || downloadSpeed > 0 || streamProgress > 0;
  return {
    peers,
    unchoked,
    downloaded,
    downloadSpeed,
    streamProgress,
    streamLen: numOrNull(o, "streamLen", "length") ?? base.streamLen,
    peerSearchRunning: bool(o, "peerSearchRunning", "peer_search_running"),
    sawData: base.sawData || anyNonZero,
  };
}

export async function fetchEngineStats(
  infoHash: string,
  fileIdx: number,
  prev: EngineStats | null,
  signal?: AbortSignal,
  url?: string,
): Promise<StatsFetch> {
  if (url && isLocalEngineUrl(url)) {
    try {
      const raw = await torrentEngineStats(infoHash, fileIdx < 0 ? null : fileIdx);
      if (!raw) return { kind: "down" };
      return { kind: "ok", stats: parseEngineStats(raw, prev) };
    } catch {
      return { kind: "down" };
    }
  }
  try {
    const res = await fetch(
      `${url ? engineBaseFor(url) : getStremioServerUrl()}/${infoHash.toLowerCase()}/${fileIdx}/stats.json`,
      { signal },
    );
    if (!res.ok) return { kind: "down" };
    const body = (await res.json()) as unknown;
    if (!body || typeof body !== "object" || Object.keys(body as object).length === 0) {
      return { kind: "empty" };
    }
    return { kind: "ok", stats: parseEngineStats(body, prev) };
  } catch {
    return { kind: "down" };
  }
}

export function readinessScore(s: EngineStats | null, isInfoHash: boolean): number {
  if (!isInfoHash) return 100;
  if (!s) return 0;
  const peers = s.unchoked > 0 ? s.unchoked : s.peers;
  const peerScore = Math.min(1, peers / 8) * 20;
  const minDownload = Math.min(
    8 * 1024 * 1024,
    Math.max(2 * 1024 * 1024, (s.streamLen ?? 0) * 0.008),
  );
  const downloadedScore = Math.min(1, s.downloaded / minDownload) * 70;
  const speedScore = Math.min(1, s.downloadSpeed / (1024 * 1024)) * 10;
  return Math.min(99, peerScore + downloadedScore + speedScore);
}

export { GENUINE_FAILURE_WINDOW_MS, COLD_CONNECT_DEADLINE_MS, ENGINE_DOWN_STRIKES };
