import { invoke } from "@tauri-apps/api/core";
import { stopFullDownload } from "./full-download";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const PENDING_DELETE_KEY = "harbor-internal.torrent.pending-delete.v1";
const INFO_HASH_RE = /^[a-f0-9]{40}$/;

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
  already_managed?: boolean;
};

export type LocalEngineStreamRef = {
  infoHash: string;
  fileIdx: number;
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

export type TorrentListItem = {
  infoHash: string;
  name: string;
  downloaded: number;
  total: number;
  downloadSpeed: number;
  finished: boolean;
  paused: boolean;
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
    const added = await invoke<AddResult>("torrent_engine_add", {
      magnet,
      trackers,
      fileIdx: typeof fileIdx === "number" && fileIdx >= 0 ? fileIdx : null,
    });
    schedulePostStartReconciliation();
    return added;
  } catch (e) {
    lastAddError = String(e);
    console.warn("[engine] add failed", e);
    return null;
  }
}

export async function torrentEngineSelect(infoHash: string, fileIdx: number): Promise<boolean> {
  if (!isTauri) return false;
  try {
    await invoke("torrent_engine_select", { infoHash, fileIdx });
    return true;
  } catch (error) {
    lastAddError = String(error);
    console.warn("[engine] select failed", error);
    return false;
  }
}

export async function torrentEngineStats(
  infoHash: string,
  fileIdx: number | null,
): Promise<TorrentEngineStats | null> {
  if (!isTauri) return null;
  try {
    return await invoke<TorrentEngineStats>("torrent_engine_stats", { infoHash, fileIdx });
  } catch {
    return null;
  }
}

export async function torrentEngineList(): Promise<TorrentListItem[]> {
  if (!isTauri) return [];
  try {
    return await invoke<TorrentListItem[]>("torrent_engine_list");
  } catch {
    return [];
  }
}

export async function torrentEnginePause(infoHash: string): Promise<void> {
  if (!isTauri) return;
  await invoke("torrent_engine_pause", { infoHash }).catch((e) =>
    console.warn("[engine] pause failed", e),
  );
}

export async function torrentEngineResume(infoHash: string): Promise<void> {
  if (!isTauri) return;
  await invoke("torrent_engine_resume", { infoHash }).catch((e) =>
    console.warn("[engine] resume failed", e),
  );
}

async function tryTorrentEngineRemove(infoHash: string, deleteFiles: boolean): Promise<boolean> {
  const key = normalizeInfoHash(infoHash);
  if (deleteFiles) markPendingDelete(key);
  cancelTorrentRemoval(key, false);
  clearTorrentPlaybackHandoff(key);
  torrentUsage.delete(key);
  stopFullDownload(key);
  if (!isTauri) {
    clearPendingDelete(key);
    return true;
  }
  try {
    await invoke("torrent_engine_remove", { infoHash: key, deleteFiles });
    clearPendingDelete(key);
    return true;
  } catch (e) {
    console.warn("[engine] remove failed", e);
    return false;
  }
}

export async function torrentEngineRemove(infoHash: string, deleteFiles: boolean): Promise<void> {
  await tryTorrentEngineRemove(infoHash, deleteFiles);
}

const pendingRemovals = new Map<string, number>();
const pendingPlaybackHandoffs = new Map<string, { ownerId: string; timeoutId: number }>();
const torrentUsage = new Map<
  string,
  { owners: Set<string>; pausedOwners: Set<string>; deleteFilesRequested: boolean }
>();
let playbackHandoffSequence = 0;
const UNUSED_REMOVE_RETRY_MS = [0, 750, 2_000] as const;

function normalizeInfoHash(infoHash: string): string {
  return infoHash.trim().toLowerCase();
}

function readPendingDeletes(): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const stored = JSON.parse(localStorage.getItem(PENDING_DELETE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(stored)) return new Set();
    return new Set(
      stored
        .filter((value): value is string => typeof value === "string")
        .map(normalizeInfoHash)
        .filter((value) => INFO_HASH_RE.test(value)),
    );
  } catch {
    return new Set();
  }
}

function writePendingDeletes(pending: Set<string>): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (pending.size === 0) localStorage.removeItem(PENDING_DELETE_KEY);
    else localStorage.setItem(PENDING_DELETE_KEY, JSON.stringify([...pending]));
  } catch {
    /* cleanup remains best-effort if local storage is unavailable */
  }
}

function markPendingDelete(infoHash: string): void {
  const key = normalizeInfoHash(infoHash);
  if (!INFO_HASH_RE.test(key)) return;
  const pending = readPendingDeletes();
  pending.add(key);
  writePendingDeletes(pending);
}

function clearPendingDelete(infoHash: string): void {
  const pending = readPendingDeletes();
  if (!pending.delete(normalizeInfoHash(infoHash))) return;
  writePendingDeletes(pending);
}

export function localEngineStreamRef(url: string | null | undefined): LocalEngineStreamRef | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") return null;
    const match = parsed.pathname.match(/^\/stream\/([a-f0-9]{40})\/(\d+)(?:\/|$)/i);
    if (!match) return null;
    const fileIdx = Number.parseInt(match[2], 10);
    if (!Number.isSafeInteger(fileIdx) || fileIdx < 0) return null;
    return { infoHash: normalizeInfoHash(match[1]), fileIdx };
  } catch {
    return null;
  }
}

export function retainTorrentUsage(
  infoHash: string,
  ownerId: string,
  options: { preservePendingDelete?: boolean } = {},
): void {
  const key = normalizeInfoHash(infoHash);
  if (options.preservePendingDelete !== true) claimTorrentPlaybackHandoff(key);
  cancelTorrentRemoval(key, options.preservePendingDelete !== true);
  const usage = torrentUsage.get(key) ?? {
    owners: new Set<string>(),
    pausedOwners: new Set<string>(),
    deleteFilesRequested: false,
  };
  usage.owners.add(ownerId);
  usage.pausedOwners.delete(ownerId);
  torrentUsage.set(key, usage);
}

export function confirmTorrentUsage(infoHash: string): void {
  clearPendingDelete(infoHash);
}

function clearTorrentPlaybackHandoff(infoHash: string): string | null {
  const key = normalizeInfoHash(infoHash);
  const handoff = pendingPlaybackHandoffs.get(key);
  if (!handoff) return null;
  window.clearTimeout(handoff.timeoutId);
  pendingPlaybackHandoffs.delete(key);
  return handoff.ownerId;
}

export function beginTorrentPlaybackHandoff(infoHash: string, timeoutMs = 60000): void {
  if (!isTauri) return;
  const key = normalizeInfoHash(infoHash);
  const previousOwner = clearTorrentPlaybackHandoff(key);
  if (previousOwner) {
    releaseTorrentUsage(key, previousOwner, { removeWhenUnused: false });
  }

  markPendingDelete(key);
  const ownerId = `player-handoff:${++playbackHandoffSequence}`;
  retainTorrentUsage(key, ownerId, { preservePendingDelete: true });
  const timeoutId = window.setTimeout(
    () => {
      pendingPlaybackHandoffs.delete(key);
      releaseTorrentUsage(key, ownerId, { removeWhenUnused: false });
      scheduleAbandonedTorrentRemoval(key, 0);
    },
    Math.max(1000, timeoutMs),
  );
  pendingPlaybackHandoffs.set(key, { ownerId, timeoutId });
}

export function claimTorrentPlaybackHandoff(infoHash: string): void {
  const key = normalizeInfoHash(infoHash);
  const ownerId = clearTorrentPlaybackHandoff(key);
  if (!ownerId) return;
  releaseTorrentUsage(key, ownerId, { removeWhenUnused: false });
}

export function releaseTorrentUsage(
  infoHash: string,
  ownerId: string,
  options: { deleteFiles?: boolean; removeWhenUnused?: boolean; delayMs?: number } = {},
): void {
  const key = normalizeInfoHash(infoHash);
  const usage = torrentUsage.get(key);
  if (!usage) {
    if (options.removeWhenUnused !== false) {
      scheduleTorrentRemoval(key, options.deleteFiles === true, options.delayMs);
    }
    return;
  }
  usage.owners.delete(ownerId);
  usage.pausedOwners.delete(ownerId);
  usage.deleteFilesRequested ||= options.deleteFiles === true;
  if (usage.owners.size > 0) {
    if (usage.pausedOwners.size === usage.owners.size) void torrentEnginePause(key);
    return;
  }
  if (options.removeWhenUnused === false && !usage.deleteFilesRequested) {
    torrentUsage.delete(key);
    return;
  }
  scheduleTorrentRemoval(key, usage.deleteFilesRequested, options.delayMs);
}

export function pauseTorrentUsage(infoHash: string, ownerId: string): void {
  const usage = torrentUsage.get(normalizeInfoHash(infoHash));
  if (!usage || !usage.owners.has(ownerId)) return;
  usage.pausedOwners.add(ownerId);
  if (usage.pausedOwners.size === usage.owners.size) void torrentEnginePause(infoHash);
}

export function scheduleTorrentRemoval(
  infoHash: string,
  deleteFiles = false,
  delayMs = 1200,
): void {
  if (!isTauri) return;
  const key = normalizeInfoHash(infoHash);
  const usage = torrentUsage.get(key);
  if (usage && usage.owners.size > 0) {
    usage.deleteFilesRequested ||= deleteFiles;
    return;
  }
  if (usage) usage.deleteFilesRequested ||= deleteFiles;
  const shouldDeleteFiles = usage?.deleteFilesRequested ?? deleteFiles;
  if (shouldDeleteFiles) markPendingDelete(key);
  cancelTorrentRemoval(key, false);
  const id = window.setTimeout(() => {
    pendingRemovals.delete(key);
    void removeUnusedTorrentWithRetry(key, shouldDeleteFiles);
  }, delayMs);
  pendingRemovals.set(key, id);
}

export function scheduleAbandonedTorrentRemoval(infoHash: string, delayMs = 1200): void {
  if (!isTauri) return;
  const key = normalizeInfoHash(infoHash);
  if ((torrentUsage.get(key)?.owners.size ?? 0) > 0) return;
  markPendingDelete(key);
  cancelTorrentRemoval(key, false);
  const id = window.setTimeout(() => {
    pendingRemovals.delete(key);
    if ((torrentUsage.get(key)?.owners.size ?? 0) > 0) return;
    void removeUnusedTorrentWithRetry(key, true);
  }, delayMs);
  pendingRemovals.set(key, id);
}

async function removeUnusedTorrentWithRetry(infoHash: string, deleteFiles: boolean): Promise<void> {
  const key = normalizeInfoHash(infoHash);
  for (const delayMs of UNUSED_REMOVE_RETRY_MS) {
    if (delayMs > 0) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));
    }
    if ((torrentUsage.get(key)?.owners.size ?? 0) > 0) return;
    if (await tryTorrentEngineRemove(key, deleteFiles)) return;
  }
  schedulePostStartReconciliation();
}

export function cancelTorrentRemoval(infoHash: string, clearPersisted = true): void {
  const key = normalizeInfoHash(infoHash);
  const id = pendingRemovals.get(key);
  if (id != null) {
    window.clearTimeout(id);
    pendingRemovals.delete(key);
  }
  if (clearPersisted) clearPendingDelete(key);
}

let reconciliation: Promise<void> | null = null;
let postStartReconciliation: number | null = null;

function schedulePostStartReconciliation(): void {
  if (!isTauri || postStartReconciliation != null || readPendingDeletes().size === 0) return;
  postStartReconciliation = window.setTimeout(() => {
    postStartReconciliation = null;
    void reconcilePendingTorrentRemovals(0);
  }, 6000);
}

async function waitForEngineReady(waitForReadyMs: number): Promise<boolean> {
  const deadline = Date.now() + Math.max(0, waitForReadyMs);
  let waiting = true;
  while (waiting) {
    const status = await torrentEngineStatus();
    if (status?.ready) return true;
    waiting = Date.now() < deadline;
    if (!waiting) break;
    await new Promise<void>((resolve) => window.setTimeout(resolve, 250));
  }
  return false;
}

async function runPendingTorrentReconciliation(
  waitForReadyMs: number,
  includeOwned: boolean,
): Promise<void> {
  if (!isTauri || readPendingDeletes().size === 0) return;
  if (!(await waitForEngineReady(waitForReadyMs))) return;

  let active: TorrentListItem[];
  try {
    active = await invoke<TorrentListItem[]>("torrent_engine_list");
  } catch {
    return;
  }
  const activeHashes = new Set(active.map((item) => normalizeInfoHash(item.infoHash)));
  for (const key of readPendingDeletes()) {
    if (!includeOwned && pendingRemovals.has(key)) continue;
    if (!includeOwned && (torrentUsage.get(key)?.owners.size ?? 0) > 0) continue;
    if (!activeHashes.has(key)) {
      clearPendingDelete(key);
      continue;
    }
    await torrentEngineRemove(key, true);
  }
}

export function reconcilePendingTorrentRemovals(waitForReadyMs = 15000): Promise<void> {
  if (reconciliation) return reconciliation;
  reconciliation = runPendingTorrentReconciliation(waitForReadyMs, false).finally(() => {
    reconciliation = null;
  });
  return reconciliation;
}

export function flushPendingTorrentRemovals(): Promise<void> {
  return runPendingTorrentReconciliation(0, true);
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
