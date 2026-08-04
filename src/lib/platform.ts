import { platform as nativePlatform } from "@tauri-apps/plugin-os";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

type DesktopPlatform = "linux" | "macos" | "windows" | null;

function detectedDesktopPlatform(): DesktopPlatform {
  if (!isTauri()) return null;

  const platform = nativePlatform();
  if (platform === "linux" || platform === "macos" || platform === "windows") {
    return platform;
  }
  return null;
}

export function isWeb(): boolean {
  return typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window);
}

export function isLinuxDesktop(): boolean {
  return detectedDesktopPlatform() === "linux";
}

export function isMacDesktop(): boolean {
  return detectedDesktopPlatform() === "macos";
}

export function isWindowsDesktop(): boolean {
  return detectedDesktopPlatform() === "windows";
}

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|iPad/i.test(ua)) return true;
  if (/Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1) return true;
  if (
    (navigator.maxTouchPoints ?? 0) > 0 &&
    Math.min(window.innerWidth, window.innerHeight) < 640
  ) {
    return true;
  }
  return false;
}

export function isMangaReaderRoute(): boolean {
  try {
    const path = window.location.pathname.replace(/\/+$/, "") || "/";
    if (path === "/reader" || path.endsWith("/reader")) return true;
    return new URLSearchParams(window.location.search).get("reader") === "1";
  } catch {
    return false;
  }
}

export function isRemoteRoute(): boolean {
  try {
    const path = window.location.pathname.replace(/\/+$/, "") || "/";
    if (path === "/remote" || path.endsWith("/remote")) return true;
    if (path === "/reader" || path.endsWith("/reader")) return true;
    const q = new URLSearchParams(window.location.search);
    return q.get("remote") === "1" || q.get("reader") === "1";
  } catch {
    return false;
  }
}

let mobileWebCache: boolean | null = null;

export function isMobileWeb(): boolean {
  if (mobileWebCache !== null) return mobileWebCache;
  let forcedOn = false;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("desktop") === "1") {
      mobileWebCache = false;
      return false;
    }
    if (q.get("mobile") === "1") forcedOn = true;
  } catch {
    /* ignore */
  }
  mobileWebCache = forcedOn || (isWeb() && isMobileDevice());
  return mobileWebCache;
}
