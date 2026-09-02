import { useSyncExternalStore } from "react";
import { isRtl, normalizeLanguage, type UiLanguage } from "./languages";

function applyDocument(lang: UiLanguage) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dir = isRtl(lang) ? "rtl" : "ltr";
  root.lang = lang;
}

function storedUiLanguage(): UiLanguage {
  if (typeof localStorage === "undefined") return "en";
  try {
    const profileState = JSON.parse(localStorage.getItem("harbor.profiles.v1") ?? "null") as {
      activeId?: string | null;
      profiles?: Array<{ id: string; settingsLinked?: boolean }>;
    } | null;
    const activeId = profileState?.activeId ?? "default";
    const activeProfile = profileState?.profiles?.find((p) => p.id === activeId);
    const preferredKey =
      activeProfile?.settingsLinked === false
        ? `harbor.settings.${activeId}`
        : "harbor.settings.shared";
    for (const key of [preferredKey, "harbor.settings.shared", "harbor.settings"]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const lang = (JSON.parse(raw) as { uiLanguage?: unknown }).uiLanguage;
      if (typeof lang === "string") return normalizeLanguage(lang);
    }
  } catch {
    /* ignore */
  }
  return "en";
}

let current: UiLanguage = storedUiLanguage();
const listeners = new Set<() => void>();
applyDocument(current);

export function getUiLanguage(): UiLanguage {
  return current;
}

export function setUiLanguage(lang: UiLanguage): void {
  const next = normalizeLanguage(lang);
  applyDocument(next);
  if (next === current) return;
  current = next;
  for (const l of listeners) l();
  if (next !== "en")
    void import("./load-locale").then(({ ensureUiLocale }) => ensureUiLocale(next));
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useUiLanguage(): UiLanguage {
  return useSyncExternalStore(subscribe, getUiLanguage, getUiLanguage);
}
