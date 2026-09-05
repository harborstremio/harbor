import { loadStoredSettings } from "@/lib/settings/load";

export type FullscreenMode = "fullscreen" | "borderless" | "maximized";

type Geometry = { x: number; y: number; w: number; h: number };

let windowFullscreen = false;
let suppressNextExit = false;
let marathonReenter = false;
let borderlessActive = false;
let borderlessSaved: Geometry | null = null;
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

export function normalizeFullscreenMode(value: string | null | undefined): FullscreenMode {
  return value === "maximized" || value === "borderless" ? value : "fullscreen";
}

export function fullscreenMode(): FullscreenMode {
  return normalizeFullscreenMode(loadStoredSettings().fullscreenMode);
}

export function isBorderlessFullscreen(): boolean {
  return borderlessActive;
}

async function setMaximized(on: boolean): Promise<boolean> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    if (await win.isFullscreen().catch(() => false)) await win.setFullscreen(false).catch(() => {});
    if ((await win.isMaximized().catch(() => false)) !== on) await win.toggleMaximize();
  } catch {
    return false;
  }
  return true;
}

async function enterBorderless(): Promise<boolean> {
  if (borderlessActive) {
    await reassertBorderless();
    return true;
  }
  try {
    const { currentMonitor, getCurrentWindow, PhysicalPosition, PhysicalSize } = await import(
      "@tauri-apps/api/window"
    );
    const win = getCurrentWindow();
    const monitor = await currentMonitor().catch(() => null);
    if (!monitor) return false;
    if (await win.isFullscreen().catch(() => false)) await win.setFullscreen(false).catch(() => {});
    if (await win.isMaximized().catch(() => false)) await win.toggleMaximize().catch(() => {});
    const [pos, size] = await Promise.all([
      win.outerPosition().catch(() => null),
      win.innerSize().catch(() => null),
    ]);
    borderlessSaved =
      pos && size ? { x: pos.x, y: pos.y, w: size.width, h: size.height } : borderlessSaved;
    await win.setDecorations(false).catch(() => {});
    await win
      .setPosition(new PhysicalPosition(monitor.position.x, monitor.position.y))
      .catch(() => {});
    await win.setSize(new PhysicalSize(monitor.size.width, monitor.size.height)).catch(() => {});
    borderlessActive = true;
  } catch {
    return false;
  }
  return true;
}

async function reassertBorderless(): Promise<void> {
  if (!borderlessActive) return;
  try {
    const { currentMonitor, getCurrentWindow, PhysicalPosition, PhysicalSize } = await import(
      "@tauri-apps/api/window"
    );
    const win = getCurrentWindow();
    const monitor = await currentMonitor().catch(() => null);
    if (!monitor) return;
    if (await win.isFullscreen().catch(() => false)) await win.setFullscreen(false).catch(() => {});
    if (await win.isDecorated().catch(() => false)) await win.setDecorations(false).catch(() => {});
    const [pos, size] = await Promise.all([
      win.outerPosition().catch(() => null),
      win.innerSize().catch(() => null),
    ]);
    const covered =
      !!pos &&
      !!size &&
      pos.x === monitor.position.x &&
      pos.y === monitor.position.y &&
      size.width === monitor.size.width &&
      size.height === monitor.size.height;
    if (covered) return;
    await win
      .setPosition(new PhysicalPosition(monitor.position.x, monitor.position.y))
      .catch(() => {});
    await win.setSize(new PhysicalSize(monitor.size.width, monitor.size.height)).catch(() => {});
  } catch {
    /* ignore */
  }
}

async function exitBorderless(): Promise<boolean> {
  const saved = borderlessSaved;
  borderlessSaved = null;
  borderlessActive = false;
  try {
    const { currentMonitor, getCurrentWindow, PhysicalPosition, PhysicalSize } = await import(
      "@tauri-apps/api/window"
    );
    const win = getCurrentWindow();
    await win.setDecorations(loadStoredSettings().useNativeTitleBar === true).catch(() => {});
    if (!saved) return true;
    await win.setSize(new PhysicalSize(saved.w, saved.h)).catch(() => {});
    let { x, y } = saved;
    if (loadStoredSettings().fullscreenRestorePosition === false) {
      const monitor = await currentMonitor().catch(() => null);
      if (monitor) {
        x = monitor.position.x + Math.max(0, Math.round((monitor.size.width - saved.w) / 2));
        y = monitor.position.y + Math.max(0, Math.round((monitor.size.height - saved.h) / 2));
      }
    }
    await win.setPosition(new PhysicalPosition(x, y)).catch(() => {});
  } catch {
    return false;
  }
  return true;
}

export async function reassertFullscreenMode(): Promise<void> {
  if (!isTauri()) return;
  if (borderlessActive) {
    await reassertBorderless();
    return;
  }
  if (!windowFullscreen) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("window_fullscreen_enter").catch(() => {});
  } catch {
    /* not tauri */
  }
}

export async function enterWindowFullscreen(): Promise<void> {
  if (isTauri()) {
    const mode = fullscreenMode();
    if (mode === "borderless" && (await enterBorderless())) {
      setWindowFullscreen(true);
      return;
    }
    if (mode === "maximized" && (await setMaximized(true))) return;
  }
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
  if (borderlessActive) {
    setWindowFullscreen(false);
    if (await exitBorderless()) return;
  }
  if (!windowFullscreen && isTauri() && fullscreenMode() === "maximized") {
    if (await setMaximized(false)) return;
  }
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
  if (windowFullscreen || borderlessActive) await exitWindowFullscreen();
}

if (isTauri()) {
  const before = windowFullscreen;
  void osWindowFullscreen().then((os) => {
    if (windowFullscreen === before && os !== windowFullscreen) setWindowFullscreen(os);
  });
}
