import { useSyncExternalStore } from "react";

const CATALOG_KEY = "harbor.downloads.catalog.v1";
const CATALOG_EVENT = "harbor:downloads-catalog";

export type CatalogEntry = {
  t: number;
  deleted?: 1;
  metaId: string;
  metaType: string | null;
  title: string;
  subtitle: string | null;
  poster: string | null;
  season: number | null;
  episode: number | null;
  streamLabel: string | null;
};

type CatalogRecord = Record<string, CatalogEntry>;

type CatalogDownload = {
  metaId: string;
  title: string;
  subtitle: string | null;
  poster: string | null;
  season: number | null;
  episode: number | null;
  streamLabel: string | null;
};

let catalog: CatalogRecord = {};
let snapshot: CatalogEntry[] = [];
let subscriptions = 0;
const listeners = new Set<() => void>();

function isCatalogEntry(value: unknown): value is CatalogEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.t === "number" &&
    typeof entry.metaId === "string" &&
    (typeof entry.metaType === "string" || entry.metaType === null) &&
    typeof entry.title === "string" &&
    (typeof entry.subtitle === "string" || entry.subtitle === null) &&
    (typeof entry.poster === "string" || entry.poster === null) &&
    (typeof entry.season === "number" || entry.season === null) &&
    (typeof entry.episode === "number" || entry.episode === null) &&
    (typeof entry.streamLabel === "string" || entry.streamLabel === null) &&
    (entry.deleted === undefined || entry.deleted === 1)
  );
}

function readCatalog(): CatalogRecord {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const next: CatalogRecord = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isCatalogEntry(value)) next[key] = value;
    }
    return next;
  } catch {
    return {};
  }
}

function refreshCatalog(): void {
  catalog = readCatalog();
  snapshot = Object.values(catalog)
    .filter((entry) => entry.deleted !== 1)
    .sort((a, b) => b.t - a.t);
}

function notify(): void {
  for (const listener of listeners) listener();
}

function refreshFromExternalEvent(): void {
  refreshCatalog();
  notify();
}

function writeCatalog(next: CatalogRecord): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify(next));
  } catch {
    return;
  }
  refreshCatalog();
  notify();
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CATALOG_EVENT));
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  subscriptions += 1;
  if (subscriptions === 1 && typeof window !== "undefined") {
    window.addEventListener("focus", refreshFromExternalEvent);
    window.addEventListener(CATALOG_EVENT, refreshFromExternalEvent);
  }
  return () => {
    listeners.delete(listener);
    subscriptions -= 1;
    if (subscriptions === 0 && typeof window !== "undefined") {
      window.removeEventListener("focus", refreshFromExternalEvent);
      window.removeEventListener(CATALOG_EVENT, refreshFromExternalEvent);
    }
  };
}

export function recordDownloadInCatalog(item: CatalogDownload, metaType: string | null): void {
  refreshCatalog();
  const entryKey = `${item.metaId}|${item.season ?? ""}|${item.episode ?? ""}`;
  const next: CatalogRecord = {
    ...catalog,
    [entryKey]: {
      t: Date.now(),
      metaId: item.metaId,
      metaType,
      title: item.title,
      subtitle: item.subtitle,
      poster: item.poster,
      season: item.season,
      episode: item.episode,
      streamLabel: item.streamLabel,
    },
  };
  writeCatalog(next);
}

export function tombstoneDownloadInCatalog(
  metaId: string,
  season: number | null,
  episode: number | null,
): void {
  refreshCatalog();
  const entryKey = `${metaId}|${season ?? ""}|${episode ?? ""}`;
  const entry = catalog[entryKey];
  if (!entry) return;
  writeCatalog({
    ...catalog,
    [entryKey]: { ...entry, t: Date.now(), deleted: 1 },
  });
}

refreshCatalog();

export function useDownloadCatalog(): CatalogEntry[] {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}
