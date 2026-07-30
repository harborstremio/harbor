import { loadStoredSettings } from "@/lib/settings/load";

let windowFullscreen = false;
let suppressNextExit = false;
let marathonReenter = false;
const subs = new Set<() => void>();

export function suppressFullscreenExitOnce(): void {
  suppressNextExit = true;
  setTimeout(() => {
    suppressNextExit = false;
  }, 1000);
}

export function beginMarathonAdvance(): void {
  suppressFullscreenExitOnce();
  marathonReenter = windowFullscreen;
  void isAnyFullscreen().then((fs) => {
    if (fs) marathonReenter = true;
  });
  setTimeout(() => {
    marathonReenter = false;
  }, 10000);
}

export function consumeMarathonReenter(): boolean {
  const v = marathonReenter;
  marathonReenter = false;
  return v;
}

function isTauri(): boolean {
  return typeof window !== "undefined" && ("__TAURI__" in window || "__TAURI_INTERNALS__" in window);
}

function emit(): void {
  for (const fn of subs) fn();
}

export function getWindowFullscreen(): boolean {
  return windowFullscreen;
}

export function subscribeFullscreen(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function setWindowFullscreen(v: boolean): void {
  if (windowFullscreen === v) return;
  windowFullscreen = v;
  emit();
}

async function maximizeInstead(on: boolean): Promise<boolean> {
  if (!isTauri()) return false;
  if (loadStoredSettings().fullscreenMode !== "maximized") return false;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const w = getCurrentWindow();
    if (await w.isFullscreen().catch(() => false)) await w.setFullscreen(false).catch(() => {});
    await (on ? w.maximize() : w.unmaximize()).catch(() => {});
  } catch {
    return false;
  }
  return true;
}

export async function enterWindowFullscreen(): Promise<void> {
  if (await maximizeInstead(true)) return;
  setWindowFullscreen(true);
  if (isTauri()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("window_fullscreen_enter");
    } catch {
      /* ignore */
    }
  } else if (document.documentElement.requestFullscreen) {
    void document.documentElement.requestFullscreen().catch(() => {});
  }
}

export async function exitWindowFullscreen(): Promise<void> {
  if (suppressNextExit) {
    suppressNextExit = false;
    return;
  }
  if (!windowFullscreen && (await maximizeInstead(false))) return;
  setWindowFullscreen(false);
  if (isTauri()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("window_fullscreen_exit", {
        restorePosition: loadStoredSettings().fullscreenRestorePosition !== false,
      });
    } catch {
      /* ignore */
    }
  } else if (document.fullscreenElement) {
    void document.exitFullscreen().catch(() => {});
  }
}

export async function exitWindowFullscreenOnPlayerClose(): Promise<void> {
  if (loadStoredSettings().keepFullscreenOnExit) return;
  await exitWindowFullscreen();
}

export async function toggleWindowFullscreen(): Promise<void> {
  if (windowFullscreen) await exitWindowFullscreen();
  else await enterWindowFullscreen();
}

async function osWindowFullscreen(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return await getCurrentWindow().isFullscreen().catch(() => false);
  } catch {
    return false;
  }
}

export async function isAnyFullscreen(): Promise<boolean> {
  if (windowFullscreen) return true;
  if (typeof document !== "undefined" && document.fullscreenElement) return true;
  return osWindowFullscreen();
}

export async function exitAnyFullscreen(): Promise<void> {
  if (typeof document !== "undefined" && document.fullscreenElement) {
    await document.exitFullscreen().catch(() => {});
  }
  if (isTauri()) {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const w = getCurrentWindow();
      if (await w.isFullscreen().catch(() => false)) await w.setFullscreen(false).catch(() => {});
    } catch {
      /* ignore */
    }
  }
  if (windowFullscreen) await exitWindowFullscreen();
}

if (isTauri()) {
  const before = windowFullscreen;
  void osWindowFullscreen().then((os) => {
    if (windowFullscreen === before && os !== windowFullscreen) setWindowFullscreen(os);
  });
}
