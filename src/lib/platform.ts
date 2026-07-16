import { platform as nativePlatform } from "@tauri-apps/plugin-os";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

type DesktopPlatform = "linux" | "macos" | "windows" | null;

function detectedDesktopPlatform(): DesktopPlatform {
  if (!isTauri()) return null;

  try {
    const platform = nativePlatform();
    if (platform === "linux" || platform === "macos" || platform === "windows") {
      return platform;
    }
  } catch {}
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
  if ((navigator.maxTouchPoints ?? 0) > 0 && Math.min(window.innerWidth, window.innerHeight) < 640) {
    return true;
  }
  return false;
}
