import { invoke } from "@tauri-apps/api/core";

import { stopFullDownload } from "./full-download";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type EngineStatus = {
  ready: boolean;
  port: number | null;
  active_torrents: number;
  last_error: string | null;
  dht_tier?: number;
  dht_nodes?: number;
};

export type EngineFile = {
  idx: number;
  name: string;
  length: number;
};

export type AddResult = {
  info_hash: string;
  files: EngineFile[];
  stream_base: string;
};

export type TorrentEngineStats = {
  peers: number;
  unchoked: number;
  downloaded: number;
  downloadSpeed: number;
  streamProgress: number;
  streamLen: number;
  peerSearchRunning: boolean;
  finished: boolean;
  state: string;
};

export type SelfTestStep = {
  label: string;
  ok: boolean;
  warn?: boolean;
  detail: string;
};

export type SelfTestResult = {
  pass: boolean;
  steps: SelfTestStep[];
};

export async function torrentEngineStatus(): Promise<EngineStatus | null> {
  if (!isTauri) return null;
  try {
    return await invoke<EngineStatus>("torrent_engine_status");
  } catch {
    return null;
  }
}

let lastAddError: string | null = null;

export function lastEngineAddError(): string | null {
  return lastAddError;
}

export async function torrentEngineAdd(
  magnet: string,
  trackers: string[],
  fileIdx?: number,
): Promise<AddResult | null> {
  if (!isTauri) return null;
  try {
    lastAddError = null;
    return await invoke<AddResult>("torrent_engine_add", {
      magnet,
      trackers,
      fileIdx: typeof fileIdx === "number" && fileIdx >= 0 ? fileIdx : null,
    });
  } catch (e) {
    lastAddError = String(e);
    console.warn("[engine] add failed", e);
    return null;
  }
}

export async function torrentEngineSelect(infoHash: string, fileIdx: number): Promise<void> {
  if (!isTauri) return;
  await invoke("torrent_engine_select", { infoHash, fileIdx }).catch((e) => console.warn("[engine] select failed", e));
}

export async function torrentEngineStats(infoHash: string, fileIdx: number | null): Promise<TorrentEngineStats | null> {
  if (!isTauri) return null;
  try {
    return await invoke<TorrentEngineStats>("torrent_engine_stats", { infoHash, fileIdx });
  } catch {
    return null;
  }
}

export async function torrentEngineRemove(infoHash: string, deleteFiles: boolean): Promise<void> {
  if (!isTauri) return;
  stopFullDownload(infoHash);
  await invoke("torrent_engine_remove", { infoHash, deleteFiles }).catch((e) =>
    console.warn("[engine] remove failed", e),
  );
}

const pendingRemovals = new Map<string, number>();

export function scheduleTorrentRemoval(infoHash: string, deleteFiles = false, delayMs = 1200): void {
  if (!isTauri) return;
  cancelTorrentRemoval(infoHash);
  const id = window.setTimeout(() => {
    pendingRemovals.delete(infoHash);
    void torrentEngineRemove(infoHash, deleteFiles);
  }, delayMs);
  pendingRemovals.set(infoHash, id);
}

export function cancelTorrentRemoval(infoHash: string): void {
  const id = pendingRemovals.get(infoHash);
  if (id != null) {
    window.clearTimeout(id);
    pendingRemovals.delete(infoHash);
  }
}

export async function torrentEngineSelfTest(): Promise<SelfTestResult | null> {
  if (!isTauri) return null;
  try {
    return await invoke<SelfTestResult>("torrent_engine_selftest");
  } catch (e) {
    console.warn("[engine] selftest failed", e);
    return null;
  }
}

export async function torrentEngineRestart(): Promise<EngineStatus | null> {
  if (!isTauri) return null;
  try {
    return await invoke<EngineStatus>("torrent_engine_restart");
  } catch (e) {
    console.warn("[engine] restart failed", e);
    return null;
  }
}

export async function torrentEngineHardReset(): Promise<EngineStatus | null> {
  if (!isTauri) return null;
  try {
    return await invoke<EngineStatus>("torrent_engine_hard_reset");
  } catch (e) {
    console.warn("[engine] hard reset failed", e);
    return null;
  }
}

export async function torrentEngineSetOptions(
  dir: string | null,
  retentionHours: number,
  maxGb: number,
  restart: boolean,
): Promise<void> {
  if (!isTauri) return;
  await invoke("torrent_engine_set_options", { dir, retentionHours, maxGb, restart }).catch((e) =>
    console.warn("[engine] set options failed", e),
  );
}
