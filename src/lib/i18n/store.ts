import { useSyncExternalStore } from "react";
import { isRtl, normalizeLanguage, type UiLanguage } from "./languages";
import { resolveUiRegion } from "./regional-labels";

function applyDocument(lang: UiLanguage) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dir = isRtl(lang) ? "rtl" : "ltr";
  root.lang = lang;
}

function runtimeLocale(): string {
  return typeof navigator !== "undefined" && navigator.language
    ? navigator.language
    : Intl.DateTimeFormat().resolvedOptions().locale;
}

function storedUiLocale(): { language: UiLanguage; region?: string } {
  const fallback = { language: "en" as const, region: resolveUiRegion(undefined, runtimeLocale()) };
  if (typeof localStorage === "undefined") return fallback;
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
      const stored = JSON.parse(raw) as { uiLanguage?: unknown; region?: unknown };
      const lang = stored.uiLanguage;
      if (typeof lang === "string")
        return {
          language: normalizeLanguage(lang),
          region: resolveUiRegion(stored.region, lang) ?? fallback.region,
        };
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

const initial = storedUiLocale();
let current: UiLanguage = initial.language;
let currentRegion = initial.region;
const listeners = new Set<() => void>();
applyDocument(current);

export function getUiLanguage(): UiLanguage {
  return current;
}

export function getUiRegion(): string | undefined {
  return currentRegion;
}

export function setUiLanguage(lang: UiLanguage, region: string | undefined = currentRegion): void {
  const next = normalizeLanguage(lang);
  const nextRegion = resolveUiRegion(region, runtimeLocale());
  applyDocument(next);
  if (next === current && nextRegion === currentRegion) return;
  current = next;
  currentRegion = nextRegion;
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

export function useUiRegion(): string | undefined {
  return useSyncExternalStore(subscribe, getUiRegion, getUiRegion);
}
