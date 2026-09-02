import { platform as nativePlatform } from "@tauri-apps/plugin-os";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function isWeb(): boolean {
  return typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window);
}

export type OsClass = "linux" | "macos" | "windows" | "android" | "web";

function detectOs(): OsClass {
  if (!isTauri()) return "web";
  const platform = nativePlatform();
  if (platform === "linux") return "linux";
  if (platform === "macos") return "macos";
  if (platform === "windows") return "windows";
  if (platform === "android") return "android";
  return "web";
}

let cachedOs: OsClass | null = null;

export function osClass(): OsClass {
  if (cachedOs === null) cachedOs = detectOs();
  return cachedOs;
}

export function applyOsDataset(): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.os = osClass();
}

export function isLinuxDesktop(): boolean {
  return osClass() === "linux";
}

export function isMacDesktop(): boolean {
  return osClass() === "macos";
}

export function isWindowsDesktop(): boolean {
  return osClass() === "windows";
}

export function isAndroid(): boolean {
  return osClass() === "android";
}

// Every other platform answers from plugin-os, which reports only "android" for
// a phone and a television alike. Leanback is not an OS, so the panel can only
// be told apart by the strings the WebView carries.
const TV_UA = /\b(tv|leanback|androidtv|aft[a-z]*|bravia|firetv|googletv|shield)\b/;

let cachedTv: boolean | null = null;

export function isAndroidTv(): boolean {
  if (cachedTv !== null) return cachedTv;
  if (!isAndroid() || typeof navigator === "undefined") {
    cachedTv = false;
    return false;
  }
  const ua = (navigator.userAgent || "").toLowerCase();
  cachedTv = TV_UA.test(ua) || ua.includes("android tv") || ua.includes("google tv");
  return cachedTv;
}

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  // A television reports Android and answers the touch heuristics below with a
  // 1080p viewport, so without this it is classed as a phone and served the
  // mobile remote instead of Big Picture.
  if (isAndroidTv()) return false;
  const ua = navigator.userAgent || "";
  if (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|iPad/i.test(ua)) return true;
  if (/Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1) return true;
  if ((navigator.maxTouchPoints ?? 0) > 0 && Math.min(window.innerWidth, window.innerHeight) < 640) {
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
    if (path === "/setup" || path.endsWith("/setup")) return true;
    if (path === "/reader" || path.endsWith("/reader")) return true;
    const q = new URLSearchParams(window.location.search);
    return q.get("remote") === "1" || q.get("reader") === "1" || q.get("setup") !== null;
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

export function isSetupRoute(): boolean {
  try {
    const path = window.location.pathname.replace(/\/+$/, "") || "/";
    return path === "/setup" || path.endsWith("/setup");
  } catch {
    return false;
  }
}
