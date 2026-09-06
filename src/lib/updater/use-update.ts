import { useSyncExternalStore } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";
import { t } from "@/lib/i18n";
import {
  normalUpdateChannel,
  readChannelPreference,
  selectedUpdateChannel,
  updateHeaders,
  writeUpdateChannel,
  UPDATE_CHANNEL_KEY,
  type UpdateChannel,
} from "./channel";
import {
  experimentalHandoff,
  parseExperimentalRelease,
  sameExperimentalRelease,
  type ExperimentalRelease,
} from "./experimental";
import {
  currentExperimentalAccess,
  subscribeExperimentalAccess,
  verifyExperimentalAccess,
} from "./experimental-access";
import {
  betaReturnSupported,
  parseBetaReturnTargets,
  readBetaReturnContext,
  returnedToExactVersion,
  saveBetaReturnContext,
} from "./beta-return";
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
  | "unavailable"
  | "error";

export type UpdateState = {
  intent: "update" | "return-beta";
  channel: UpdateChannel;
  buildId: string | null;
  experimentalVersion: string | null;
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

function readDismissed(channel = selectedUpdateChannel()): string | null {
  try {
    if (channel === "experimental") return localStorage.getItem(`${DISMISS_KEY}.experimental`);
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

let state: UpdateState = {
  intent: "update",
  channel: selectedUpdateChannel(),
  buildId: null,
  experimentalVersion: null,
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
  rawJson?: Record<string, unknown>;
  download: (onEvent: (e: DownloadEvent) => void) => Promise<void>;
  install: () => Promise<void>;
  close: () => Promise<void>;
};

type DownloadEvent =
  | { event: "Started"; data?: { contentLength?: number } }
  | { event: "Progress"; data?: { chunkLength?: number } }
  | { event: "Finished" };

let handle: UpdateHandle | null = null;
let experimentalRelease: ExperimentalRelease | null = null;
let revision = 0;
let checkedChannel = selectedUpdateChannel();
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

function currentRequest(request: number, channel: UpdateChannel): boolean {
  return request === revision && channel === selectedUpdateChannel();
}

function revokeExperimentalAccess(): void {
  if (selectedUpdateChannel() !== "experimental" && state.channel !== "experimental") return;
  if (selectedUpdateChannel() === "experimental") {
    writeUpdateChannel(normalUpdateChannel());
  }
  revision += 1;
  experimentalRelease = null;
  checkedChannel = selectedUpdateChannel();
  if (handle) {
    void handle.close().catch(() => {});
    handle = null;
  }
  set({
    intent: "update",
    channel: selectedUpdateChannel(),
    buildId: null,
    experimentalVersion: null,
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
  });
}

async function verifyExperimentalAction(
  request: number,
  selected: UpdateChannel,
): Promise<boolean> {
  const access = await verifyExperimentalAccess();
  if (access === "denied") {
    revokeExperimentalAccess();
    return false;
  }
  if (!currentRequest(request, selected)) return false;
  if (access === "unavailable") {
    set({
      status: "error",
      error: t("Couldn't verify your Harbor account access. Check your connection and try again."),
    });
    return false;
  }
  return true;
}

export function updateChannelLocked(): boolean {
  return state.status === "downloading" || state.status === "installing";
}

export function setUpdateChannel(channel: UpdateChannel): boolean {
  if (channel === "experimental" && !currentExperimentalAccess()) return false;
  if (updateChannelLocked() || !writeUpdateChannel(channel)) return false;
  clearStagedUpdate();
  return true;
}

export function setExperimentalUpdates(enabled: boolean): boolean {
  return setUpdateChannel(enabled ? "experimental" : normalUpdateChannel());
}

async function runningPrerelease(): Promise<boolean> {
  try {
    const [{ getVersion }, { safeFetch }] = await Promise.all([
      import("@tauri-apps/api/app"),
      import("@/lib/safe-fetch"),
    ]);
    const res = await safeFetch(`${HARBOR_API_BASE}/updates/latest.json`, { cache: "no-store" });
    if (!res.ok) return false;
    const stable = (await res.json()) as { version?: string };
    if (!stable.version) return false;
    return cmpVersion(await getVersion(), stable.version) > 0;
  } catch {
    return false;
  }
}

async function readExperimentalManifest(path = "latest-experimental.json"): Promise<unknown> {
  // AbortSignal.timeout is unavailable in older supported macOS WebViews.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    // Immutable history has no guaranteed browser CORS headers. Use native HTTP
    // for that recheck without changing normal-channel routes or proxying it.
    const manifestFetch =
      path === "latest-experimental.json" ? fetch : (await import("@tauri-apps/plugin-http")).fetch;
    const response = await manifestFetch(`${HARBOR_API_BASE}/updates/${path}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    return response.ok && response.status !== 204 ? await response.json().catch(() => null) : null;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkForUpdate(manual = false): Promise<void> {
  if (!IS_TAURI) return;
  if (
    state.status === "checking" ||
    state.status === "downloading" ||
    state.status === "downloaded" ||
    state.status === "installing"
  ) {
    return;
  }
  clearStagedUpdate();
  const request = revision;
  const selected = selectedUpdateChannel();
  checkedChannel = selected;
  set({
    status: "checking",
    channel: selected,
    experimentalVersion: null,
    manualCheck: manual,
    error: null,
  });
  let candidate: UpdateHandle | null = null;
  try {
    if (selected === "experimental") {
      if (!(await verifyExperimentalAction(request, selected))) return;
      const [probe, raw] = await Promise.all([probeHandoff(), readExperimentalManifest()]);
      if (!currentRequest(request, selected)) return;
      const release = probe ? parseExperimentalRelease(raw, probe.platformKey) : null;
      if (!release || !probe) {
        set({
          status: "unavailable",
          error: t("No verified experimental build is available for this device yet."),
        });
        return;
      }
      const { getVersion } = await import("@tauri-apps/api/app");
      const installedVersion = await getVersion();
      if (!currentRequest(request, selected)) return;
      if (cmpVersion(release.version, installedVersion) <= 0) {
        set({ status: "uptodate" });
        return;
      }
      const plan = experimentalHandoff(release, probe);
      const returnTargets = parseBetaReturnTargets(
        release.returnToBeta,
        release.version,
        probe.platformKey,
      );
      if (!betaReturnSupported(probe) || !returnTargets.length) {
        set({
          status: "unavailable",
          error: t("No tested return to beta is available for this build."),
        });
        return;
      }
      if (!plan || plan.recoveryProtocol !== 1) {
        set({
          status: "unavailable",
          error: t("No verified experimental build is available for this device yet."),
        });
        return;
      }
      if (!plan) {
        candidate = (await check({
          ...updateHeaders("experimental"),
          timeout: 15_000,
        })) as UpdateHandle | null;
        if (!currentRequest(request, selected)) return;
        const checked = candidate
          ? parseExperimentalRelease(candidate.rawJson, probe.platformKey)
          : null;
        if (
          !checked ||
          !sameExperimentalRelease(release, checked) ||
          candidate?.version !== release.version
        ) {
          set({
            status: "unavailable",
            error: t(
              "The experimental build changed during the check. Check again before downloading.",
            ),
          });
          return;
        }
      }
      const dismissed = readDismissed("experimental");
      handle = candidate;
      experimentalRelease = release;
      candidate = null;
      set({
        status: "available",
        version: release.version,
        experimentalVersion: release.experimentalVersion,
        buildId: release.buildId,
        notes: release.notes,
        handoff: plan,
        dismissed,
        panelOpen: manual || dismissed !== release.version,
      });
      return;
    }
    const wantBeta = selected === "beta";
    let beta = wantBeta;
    candidate = (await check(wantBeta ? BETA_HEADERS : undefined)) as UpdateHandle | null;
    if (!currentRequest(request, selected)) return;
    if (!candidate && !wantBeta && !readChannelPreference() && (await runningPrerelease())) {
      if (!currentRequest(request, selected)) return;
      beta = true;
      candidate = (await check(BETA_HEADERS)) as UpdateHandle | null;
    }
    if (!currentRequest(request, selected)) return;
    const plan = await readHandoffPlan(beta ? BETA_HEADERS : undefined).catch((e) => {
      console.warn("installer handoff unavailable, falling back to nsis", e);
      return null;
    });
    if (!currentRequest(request, selected)) return;
    const update = candidate;
    set({ channel: beta ? "beta" : "stable" });
    if (plan) {
      handle = update;
      candidate = null;
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
    handle = update;
    candidate = null;
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
    if (currentRequest(request, selected)) {
      set({
        status: "error",
        error:
          selected === "experimental"
            ? t("Couldn't check experimental builds. Check your connection and try again.")
            : String(e),
      });
    }
  } finally {
    if (candidate) void candidate.close().catch(() => {});
    if (request === revision && selected !== selectedUpdateChannel()) clearStagedUpdate();
  }
}

export async function prepareBetaReturn(version: string): Promise<void> {
  if (!IS_TAURI || updateChannelLocked() || state.status === "checking") return;
  clearStagedUpdate();
  const request = revision;
  const selected = selectedUpdateChannel();
  set({
    intent: "return-beta",
    channel: "beta",
    status: "checking",
    version,
    experimentalVersion: null,
    manualCheck: true,
  });
  try {
    const [{ getVersion }, probe] = await Promise.all([
      import("@tauri-apps/api/app"),
      probeHandoff(),
    ]);
    const installed = await getVersion();
    const context = readBetaReturnContext(installed);
    if (!currentRequest(request, selected)) return;
    if (
      !context ||
      installed !== context.version ||
      !betaReturnSupported(probe) ||
      probe?.platformKey !== context.platformKey
    )
      throw new Error("unavailable");
    const saved = context.targets.find((entry) => entry.version === version);
    // Re-read the source build's immutable approval, not today's experimental
    // latest pointer, which may already describe another build.
    const raw = await readExperimentalManifest(
      `experimental/${context.version}/${context.buildId}/manifest.json`,
    );
    if (!currentRequest(request, selected)) return;
    const release = parseExperimentalRelease(raw, context.platformKey);
    const target =
      release?.version === context.version &&
      release.experimentalVersion === context.experimentalVersion &&
      release.buildId === context.buildId
        ? parseBetaReturnTargets(release.returnToBeta, context.version, context.platformKey).find(
            (entry) => entry.version === version,
          )
        : null;
    if (!saved || !target || JSON.stringify(saved) !== JSON.stringify(target))
      throw new Error("changed");
    set({ status: "available", handoff: target, notes: target.notes, panelOpen: false });
  } catch {
    if (currentRequest(request, selected))
      set({
        status: "error",
        error: t("Couldn't verify this return to beta. Check your connection and try again."),
      });
  }
}

async function saveTransitionBackup(): Promise<void> {
  const [{ buildBackup }, { invoke }] = await Promise.all([
    import("@/lib/backup"),
    import("@tauri-apps/api/core"),
  ]);
  const backup = await buildBackup();
  await invoke("handoff_save_backup", { content: JSON.stringify(backup) });
}

export async function downloadUpdate(): Promise<void> {
  if (state.status !== "available") return;
  const request = revision;
  const selected = checkedChannel;
  if (!currentRequest(request, selected)) {
    clearStagedUpdate();
    return;
  }
  if (
    state.intent === "update" &&
    state.channel === "experimental" &&
    !(await verifyExperimentalAction(request, selected))
  ) {
    return;
  }
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
        if (!currentRequest(request, selected)) return;
        const size = total ?? plan.size ?? 0;
        set({
          downloadedBytes: verifying ? size : received,
          totalBytes: size,
          progress: size > 0 ? Math.min(1, received / size) : 0,
        });
      });
      if (currentRequest(request, selected)) set({ status: "downloaded", progress: 1 });
      else {
        set({ status: "idle" });
        clearStagedUpdate();
      }
    } catch (e) {
      set({ status: "error", error: String(e) });
      if (!currentRequest(request, selected)) clearStagedUpdate();
    }
    return;
  }
  if (!handle) return;
  set({ status: "downloading", progress: 0, downloadedBytes: 0, totalBytes: 0, error: null });
  try {
    let total = 0;
    let got = 0;
    await handle.download((e) => {
      if (!currentRequest(request, selected)) return;
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
    if (currentRequest(request, selected)) set({ status: "downloaded", progress: 1 });
    else {
      set({ status: "idle" });
      clearStagedUpdate();
    }
  } catch (e) {
    set({ status: "error", error: String(e) });
    if (!currentRequest(request, selected)) clearStagedUpdate();
  }
}

export async function installUpdate(): Promise<void> {
  if (state.status !== "downloaded") return;
  const request = revision;
  const selected = checkedChannel;
  if (!currentRequest(request, selected)) {
    clearStagedUpdate();
    return;
  }
  if (
    state.intent === "update" &&
    state.channel === "experimental" &&
    !(await verifyExperimentalAction(request, selected))
  ) {
    return;
  }
  const plan = state.handoff;
  if (plan) {
    set({ status: "installing", error: null, installFailed: false });
    try {
      if (state.intent === "return-beta" || state.channel === "experimental") {
        if (plan.recoveryProtocol !== 1) throw new Error("A recoverable installer is required.");
        await saveTransitionBackup();
        if (!currentRequest(request, selected)) throw new Error("The update channel changed.");
        if (state.channel === "experimental") {
          const probe = await probeHandoff();
          if (!experimentalRelease || !probe || !currentRequest(request, selected))
            throw new Error("The update changed.");
          saveBetaReturnContext(
            experimentalRelease.version,
            experimentalRelease.experimentalVersion,
            experimentalRelease.buildId,
            probe.platformKey,
            experimentalRelease.returnToBeta,
          );
        }
      }
      localStorage.setItem(
        PENDING_KEY,
        JSON.stringify({
          version: plan.version,
          payloadVersion: plan.payloadVersion,
          handoff: true,
          intent: state.intent,
          recoverable: plan.recoveryProtocol === 1,
          channel: state.channel,
          buildId: state.buildId,
          experimentalVersion: state.experimentalVersion,
          at: Date.now(),
        }),
      );
    } catch {
      clearPending();
      if (state.intent === "return-beta" || state.channel === "experimental") {
        set({
          status: "error",
          error: t("Couldn't save the recovery backup. Free some storage and try again."),
          panelOpen: false,
        });
        return;
      }
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
        JSON.stringify({
          version: handle.version,
          channel: state.channel,
          buildId: state.buildId,
          at: Date.now(),
        }),
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
    if (!currentRequest(request, selected)) {
      clearPending();
      set({ status: "idle" });
      clearStagedUpdate();
      return;
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
  // Experimental downloads must go through signature verification in the app.
  if (selectedUpdateChannel() === "experimental" || state.channel === "experimental") {
    await checkForUpdate(true);
    return;
  }
  const { openUrl } = await import("@/lib/window");
  let target = HARBOR_API_BASE;
  try {
    const { safeFetch } = await import("@/lib/safe-fetch");
    const beta =
      selectedUpdateChannel() === "beta" ||
      (!readChannelPreference() && (await runningPrerelease()));
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
  if (state.channel === "experimental") {
    await checkForUpdate(true);
    return;
  }
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
  channel?: UpdateChannel;
  intent?: "update" | "return-beta";
  recoverable?: boolean;
  experimentalVersion?: string;
  returnPreferenceUndo?: unknown;
}): Promise<boolean> {
  if (pending.intent === "return-beta") {
    const { getVersion } = await import("@tauri-apps/api/app");
    if (
      pending.version &&
      returnedToExactVersion(await getVersion(), pending.version) &&
      selectedUpdateChannel() === "beta"
    ) {
      return false;
    }
    // Keep the undo journal if a quota/write error prevented restoring channel
    // flags, or while the target is still waiting for its startup acknowledgement.
    if (!pending.returnPreferenceUndo) clearPending();
    set({
      intent: "return-beta",
      status: "error",
      installFailed: true,
      version: pending.version ?? null,
      experimentalVersion: pending.experimentalVersion ?? null,
      channel: selectedUpdateChannel(),
      error: t(
        "Return to beta did not finish. Your recovery files have been kept. Try again from Experimental builds.",
      ),
      panelOpen: true,
    });
    return true;
  }
  const probe = await probeHandoff();
  const want = pending.payloadVersion ?? 0;
  if (!probe || probe.payloadVersion >= want) {
    if (!pending.recoverable) clearPending();
    return false;
  }
  clearPending();
  const experimental = pending.channel === "experimental";
  const plan = experimental
    ? null
    : await readHandoffPlan(selectedUpdateChannel() === "beta" ? BETA_HEADERS : undefined).catch(
        (e) => {
          console.warn("installer handoff unavailable, falling back to nsis", e);
          return null;
        },
      );
  set({
    status: "error",
    installFailed: true,
    version: pending.version ?? null,
    experimentalVersion: pending.experimentalVersion ?? null,
    handoff: plan,
    error: t("Harbor Setup did not finish updating Harbor. Check for updates to try again."),
    channel: pending.channel ?? selectedUpdateChannel(),
    panelOpen: true,
  });
  return true;
}

async function detectFailedUpdate(): Promise<boolean> {
  if (!IS_TAURI) return false;
  let pending: {
    version?: string;
    payloadVersion?: number;
    handoff?: boolean;
    channel?: UpdateChannel;
    intent?: "update" | "return-beta";
    recoverable?: boolean;
    experimentalVersion?: string;
  } | null = null;
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
    channel: pending.channel ?? selectedUpdateChannel(),
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
      localStorage.setItem(
        state.channel === "experimental" ? `${DISMISS_KEY}.experimental` : DISMISS_KEY,
        state.version,
      );
    } catch {
      /* private mode */
    }
  }
  set({ dismissed: state.version, panelOpen: false });
}

export function clearStagedUpdate(): void {
  if (updateChannelLocked()) return;
  revision += 1;
  experimentalRelease = null;
  checkedChannel = selectedUpdateChannel();
  if (handle) {
    void handle.close().catch(() => {});
    handle = null;
  }
  set({
    intent: "update",
    status: "idle",
    version: null,
    experimentalVersion: null,
    notes: null,
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    error: null,
    panelOpen: false,
    handoff: null,
    buildId: null,
    channel: selectedUpdateChannel(),
    dismissed: readDismissed(),
    installFailed: false,
    manualCheck: false,
  });
}

let started = false;
export function startUpdateWatcher(): void {
  if (started || !IS_TAURI) return;
  started = true;
  subscribeExperimentalAccess(() => {
    if (!currentExperimentalAccess()) revokeExperimentalAccess();
  });
  if (!currentExperimentalAccess()) revokeExperimentalAccess();
  window.addEventListener("storage", (event) => {
    if (event.key !== UPDATE_CHANNEL_KEY && event.key !== null) return;
    // An auxiliary window may change consent while a native download is in
    // flight. Let verification finish, but invalidate its install permission.
    if (updateChannelLocked()) revision += 1;
    else clearStagedUpdate();
  });
  void (async () => {
    const failed = await detectFailedUpdate();
    if (!failed) void checkForUpdate(false);
    window.setInterval(() => void checkForUpdate(false), CHECK_INTERVAL_MS);
  })();
}
