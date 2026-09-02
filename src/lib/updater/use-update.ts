import { useSyncExternalStore } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";
import { t } from "@/lib/i18n";
import {
  launchHandoff,
  probeHandoff,
  readHandoffPlan,
  stageHandoff,
  type HandoffPlan,
} from "./handoff";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const DISMISS_KEY = "harbor.update.dismissed";
const PENDING_KEY = "harbor.update.pending";
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
  installFailed: boolean;
  manualCheck: boolean;
  dismissed: string | null;
  panelOpen: boolean;
  handoff: HandoffPlan | null;
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
  installFailed: false,
  manualCheck: false,
  dismissed: readDismissed(),
  panelOpen: false,
  handoff: null,
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

const BETA_HEADERS = { headers: { "x-harbor-channel": "beta" } };

async function runningPrerelease(): Promise<boolean> {
  try {
    const [{ getVersion }, res] = await Promise.all([
      import("@tauri-apps/api/app"),
      fetch(`${HARBOR_API_BASE}/updates/latest.json`, { cache: "no-store" }),
    ]);
    if (!res.ok) return false;
    const stable = (await res.json()) as { version?: string };
    if (!stable.version) return false;
    return cmpVersion(await getVersion(), stable.version) > 0;
  } catch {
    return false;
  }
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
  if (
    state.status === "checking" ||
    state.status === "downloading" ||
    state.status === "installing"
  ) {
    return;
  }
  set({ status: "checking", manualCheck: manual, error: null });
  try {
    const wantBeta = betaChannel();
    let beta = wantBeta;
    let update = await check(wantBeta ? BETA_HEADERS : undefined);
    if (!update && !wantBeta && (await runningPrerelease())) {
      beta = true;
      update = await check(BETA_HEADERS);
    }
    const plan = await readHandoffPlan(beta ? BETA_HEADERS : undefined).catch(() => null);
    if (plan) {
      handle = update ? (update as unknown as UpdateHandle) : null;
      const version = plan.version || update?.version || "";
      const dismissed = readDismissed();
      set({
        status: "available",
        version,
        notes: plan.notes ?? update?.body ?? null,
        handoff: plan,
        dismissed,
        panelOpen: manual || dismissed !== version,
      });
      return;
    }
    if (!update) {
      set({ status: "uptodate", version: null, notes: null, handoff: null });
      return;
    }
    handle = update as unknown as UpdateHandle;
    const dismissed = readDismissed();
    set({
      status: "available",
      version: update.version,
      notes: update.body ?? null,
      handoff: null,
      dismissed,
      panelOpen: manual || dismissed !== update.version,
    });
  } catch (e) {
    set({ status: "error", error: String(e) });
  }
}

export async function downloadUpdate(): Promise<void> {
  if (state.status === "downloading" || state.status === "installing") return;
  const plan = state.handoff;
  if (plan) {
    if (!plan.verifiable) {
      void openHandoffDownload();
      return;
    }
    set({
      status: "downloading",
      progress: 0,
      downloadedBytes: 0,
      totalBytes: plan.size ?? 0,
      error: null,
    });
    try {
      await stageHandoff(plan, ({ received, total, verifying }) => {
        const size = total ?? plan.size ?? 0;
        set({
          downloadedBytes: verifying ? size : received,
          totalBytes: size,
          progress: size > 0 ? Math.min(1, received / size) : 0,
        });
      });
      set({ status: "downloaded", progress: 1 });
    } catch (e) {
      set({ status: "error", error: String(e) });
    }
    return;
  }
  if (!handle) return;
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
  const plan = state.handoff;
  if (plan) {
    set({ status: "installing", error: null, installFailed: false });
    try {
      localStorage.setItem(
        PENDING_KEY,
        JSON.stringify({
          version: plan.version,
          payloadVersion: plan.payloadVersion,
          handoff: true,
          at: Date.now(),
        }),
      );
    } catch {
      clearPending();
    }
    try {
      await launchHandoff();
    } catch (e) {
      clearPending();
      set({ status: "error", error: String(e), installFailed: true, panelOpen: true });
    }
    return;
  }
  if (!handle) return;
  set({ status: "installing", error: null, installFailed: false });
  try {
    try {
      localStorage.setItem(
        PENDING_KEY,
        JSON.stringify({ version: handle.version, at: Date.now() }),
      );
    } catch {
      /* private mode: we just lose next-launch failure detection */
    }
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
    set({ status: "error", error: String(e), installFailed: true, panelOpen: true });
  }
}

function cmpVersion(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

export async function openManualDownload(): Promise<void> {
  const { openUrl } = await import("@/lib/window");
  let target = HARBOR_API_BASE;
  try {
    const { safeFetch } = await import("@/lib/safe-fetch");
    const beta = betaChannel() || (await runningPrerelease());
    const res = await safeFetch(
      `${HARBOR_API_BASE}/updates/latest.json`,
      beta ? BETA_HEADERS : undefined,
    );
    const manifest = (await res.json()) as { platforms?: Record<string, { url?: string }> };
    const platforms = manifest.platforms ?? {};
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const want = ua.includes("Windows") ? "windows" : ua.includes("Mac") ? "darwin" : "linux";
    const key =
      Object.keys(platforms).find((k) => k.toLowerCase().startsWith(want)) ??
      Object.keys(platforms)[0];
    const url = key ? platforms[key]?.url : undefined;
    if (typeof url === "string" && url) {
      target = url.endsWith(".app.tar.gz") ? `${url.slice(0, -".app.tar.gz".length)}.dmg` : url;
    }
  } catch {
    /* fall back to the site download */
  }
  openUrl(target);
}

export async function openHandoffDownload(): Promise<void> {
  const url = state.handoff?.url;
  const { openUrl } = await import("@/lib/window");
  openUrl(url || HARBOR_API_BASE);
}

function clearPending(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {}
}

async function detectFailedHandoff(pending: {
  version?: string;
  payloadVersion?: number;
}): Promise<boolean> {
  const probe = await probeHandoff();
  const want = pending.payloadVersion ?? 0;
  if (!probe || probe.payloadVersion >= want) {
    clearPending();
    return false;
  }
  clearPending();
  const plan = await readHandoffPlan(betaChannel() ? BETA_HEADERS : undefined).catch(() => null);
  set({
    status: "error",
    installFailed: true,
    version: pending.version ?? null,
    handoff: plan,
    error: t("Harbor Setup did not finish updating Harbor. Nothing was changed."),
    panelOpen: true,
  });
  return true;
}

async function detectFailedUpdate(): Promise<boolean> {
  if (!IS_TAURI) return false;
  let pending: { version?: string; payloadVersion?: number; handoff?: boolean } | null = null;
  try {
    pending = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null");
  } catch {
    pending = null;
  }
  if (pending?.handoff) return detectFailedHandoff(pending);
  if (!pending?.version) return false;
  let current: string | null = null;
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    current = await getVersion();
  } catch {
    current = null;
  }
  if (current && cmpVersion(current, pending.version) >= 0) {
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch {
      /* ignore */
    }
    return false;
  }
  set({
    status: "error",
    installFailed: true,
    version: pending.version,
    error: t("Harbor {version} downloaded but did not install on its own.", {
      version: pending.version,
    }),
    panelOpen: true,
  });
  return true;
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
    handoff: null,
  });
}

let started = false;
export function startUpdateWatcher(): void {
  if (started || !IS_TAURI) return;
  started = true;
  void (async () => {
    const failed = await detectFailedUpdate();
    if (!failed) void checkForUpdate(false);
    window.setInterval(() => void checkForUpdate(false), CHECK_INTERVAL_MS);
  })();
}
