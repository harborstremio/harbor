export type LocalMode = "strip" | "single" | "double" | "book";

export type DesktopMode = "long" | "paged" | "double" | "book";

export const LOCAL_MODE_KEY = "harbor.localreader.mode.v1";

export const READER_BG_HEX = "#0b0b0d";

export function proxied(url: string): string {
  return `/manga-img?u=${encodeURIComponent(url)}`;
}

export function mapDesktopMode(mode: DesktopMode): LocalMode {
  if (mode === "paged") return "single";
  if (mode === "double") return "double";
  if (mode === "book") return "book";
  return "strip";
}

export function loadLocalMode(fallback: LocalMode): LocalMode {
  try {
    const v = localStorage.getItem(LOCAL_MODE_KEY);
    if (v === "strip" || v === "single" || v === "double" || v === "book") return v;
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
