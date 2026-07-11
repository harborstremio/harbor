import { check } from "@tauri-apps/plugin-updater";
import { useSyncExternalStore } from "react";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const DISMISS_KEY = "harbor.update.dismissed";
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "installing"
  | "uptodate"
  | "error";

export type UpdateState = {
  status: UpdateStatus;
  version: string | null;
  notes: string | null;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  error: string | null;
  manualCheck: boolean;
  dismissed: string | null;
  panelOpen: boolean;
};

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

let state: UpdateState = {
  status: "idle",
  version: null,
  notes: null,
  progress: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  error: null,
  manualCheck: false,
  dismissed: readDismissed(),
  panelOpen: false,
};

type UpdateHandle = {
  version: string;
  body?: string;
  download: (onEvent: (e: DownloadEvent) => void) => Promise<void>;
  install: () => Promise<void>;
  close: () => Promise<void>;
};

type DownloadEvent =
  | { event: "Started"; data?: { contentLength?: number } }
  | { event: "Progress"; data?: { chunkLength?: number } }
  | { event: "Finished" };

let handle: UpdateHandle | null = null;
const listeners = new Set<() => void>();

function set(patch: Partial<UpdateState>): void {
  state = { ...state, ...patch };
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function snapshot(): UpdateState {
  return state;
}

export function useUpdate(): UpdateState {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function updateAvailable(s: UpdateState): boolean {
  return s.status === "available" || s.status === "downloading" || s.status === "downloaded";
}

function betaChannel(): boolean {
  try {
    const raw = localStorage.getItem("harbor.settings");
    if (!raw) return false;
    return (JSON.parse(raw) as { betaUpdates?: boolean }).betaUpdates === true;
  } catch {
    return false;
  }
}

export async function checkForUpdate(manual = false): Promise<void> {
  if (!IS_TAURI) return;
  if (state.status === "checking" || state.status === "downloading" || state.status === "installing") {
    return;
  }
  set({ status: "checking", manualCheck: manual, error: null });
  try {
    const update = await check(betaChannel() ? { headers: { "x-harbor-channel": "beta" } } : undefined);
    if (!update) {
      set({ status: "uptodate", version: null, notes: null });
      return;
    }
    handle = update as unknown as UpdateHandle;
    const dismissed = readDismissed();
    set({
      status: "available",
      version: update.version,
      notes: update.body ?? null,
      dismissed,
      panelOpen: manual || dismissed !== update.version,
    });
  } catch (e) {
    set({ status: "error", error: String(e) });
  }
}

export async function downloadUpdate(): Promise<void> {
  if (!handle || state.status === "downloading" || state.status === "installing") return;
  set({ status: "downloading", progress: 0, downloadedBytes: 0, totalBytes: 0, error: null });
  try {
    let total = 0;
    let got = 0;
    await handle.download((e) => {
      if (e.event === "Started") {
        total = e.data?.contentLength ?? 0;
        set({ totalBytes: total });
      } else if (e.event === "Progress") {
        got += e.data?.chunkLength ?? 0;
        set({ downloadedBytes: got, progress: total > 0 ? Math.min(1, got / total) : 0 });
      } else if (e.event === "Finished") {
        set({ progress: 1 });
      }
    });
    set({ status: "downloaded", progress: 1 });
  } catch (e) {
    set({ status: "error", error: String(e) });
  }
}

export async function installUpdate(): Promise<void> {
  if (!handle) return;
  set({ status: "installing", error: null });
  try {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("close_aux_windows").catch(() => {});
      await invoke("stop_stremio_sidecar");
      await new Promise((r) => setTimeout(r, 600));
    } catch {
      /* best-effort: the NSIS preinstall hook also kills the sidecar */
    }
    await handle.install();
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch (e) {
    set({ status: "error", error: String(e) });
  }
}

export function openUpdatePanel(): void {
  set({ panelOpen: true });
}

export function closeUpdatePanel(): void {
  set({ panelOpen: false });
}

export function dismissUpdate(): void {
  if (state.version) {
    try {
      localStorage.setItem(DISMISS_KEY, state.version);
    } catch {
      /* private mode */
    }
  }
  set({ dismissed: state.version, panelOpen: false });
}

export function clearStagedUpdate(): void {
  if (handle) {
    void handle.close().catch(() => {});
    handle = null;
  }
  set({
    status: "idle",
    version: null,
    notes: null,
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    error: null,
    panelOpen: false,
  });
}

let started = false;
export function startUpdateWatcher(): void {
  if (started || !IS_TAURI) return;
  started = true;
  void checkForUpdate(false);
  window.setInterval(() => void checkForUpdate(false), CHECK_INTERVAL_MS);
}
