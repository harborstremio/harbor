export type LocalMode = "strip" | "strip-h" | "single" | "double" | "book";

export type DesktopMode = "long" | "long-h" | "paged" | "double" | "book";

export const LOCAL_MODE_KEY = "harbor.localreader.mode.v1";

export const READER_BG_HEX = "#0b0b0d";

export function proxied(url: string): string {
  return `/manga-img?u=${encodeURIComponent(url)}`;
}

export function mapDesktopMode(mode: DesktopMode): LocalMode {
  if (mode === "paged") return "single";
  if (mode === "double") return "double";
  if (mode === "book") return "book";
  if (mode === "long-h") return "strip-h";
  return "strip";
}

export function mapLocalToDesktopMode(mode: LocalMode): DesktopMode {
  if (mode === "single") return "paged";
  if (mode === "double") return "double";
  if (mode === "book") return "book";
  if (mode === "strip-h") return "long-h";
  return "long";
}

export function loadLocalMode(fallback: LocalMode): LocalMode {
  try {
    const v = localStorage.getItem(LOCAL_MODE_KEY);
    if (v === "strip" || v === "strip-h" || v === "single" || v === "double" || v === "book") return v;
  } catch {
    return fallback;
  }
  return fallback;
}

export function saveLocalMode(mode: LocalMode): void {
  try {
    localStorage.setItem(LOCAL_MODE_KEY, mode);
  } catch {
    return;
  }
}

export const STRIP_PREVIEW_KEY = "harbor.remote-reader.strip-preview.v1";

export function loadStripPreview(): boolean {
  try {
    return localStorage.getItem(STRIP_PREVIEW_KEY) === "on";
  } catch {
    return false;
  }
}

export function saveStripPreview(show: boolean): void {
  try {
    localStorage.setItem(STRIP_PREVIEW_KEY, show ? "on" : "off");
  } catch {
    return;
  }
}

export const LOCAL_ZOOM_KEY = "harbor.localreader.zoom.v1";
export function loadLocalZoom(): number {
  try {
    const v = Number(localStorage.getItem(LOCAL_ZOOM_KEY));
    if (Number.isFinite(v)) return Math.max(0.5, Math.min(3, v));
  } catch {
    return 1;
  }
  return 1;
}

export function saveLocalZoom(zoom: number): void {
  try {
    localStorage.setItem(LOCAL_ZOOM_KEY, String(zoom));
  } catch {
    return;
  }
}

export const LOCAL_RTL_KEY = "harbor.localreader.rtl.v1";

export function loadLocalRtl(): boolean | null {
  try {
    const v = localStorage.getItem(LOCAL_RTL_KEY);
    if (v === "rtl") return true;
    if (v === "ltr") return false;
  } catch {
    return null;
  }
  return null;
}

export function saveLocalRtl(rtl: boolean): void {
  try {
    localStorage.setItem(LOCAL_RTL_KEY, rtl ? "rtl" : "ltr");
  } catch {
    return;
  }
}
