import { useSyncExternalStore } from "react";
import { readMusicPreference, writeMusicPreference } from "./preferences";
import type { MusicCatalogItem } from "./types";

export type MusicSearchHistoryEntry = { id: string; query?: string; scope?: string | null; item?: Extract<MusicCatalogItem, { kind: "artist" | "album" | "track" }> };
const KEY = "harbor.music.search-history.v1";
const LIMIT = 12;
let entries: MusicSearchHistoryEntry[] | undefined;
const listeners = new Set<() => void>();
function snapshot(): MusicSearchHistoryEntry[] {
  if (entries) return entries;
  try {
    const saved: unknown = JSON.parse(readMusicPreference(KEY) ?? "[]");
    entries = Array.isArray(saved) ? saved.filter((entry) => entry && typeof entry.id === "string"
      && (typeof entry.query === "string" || (entry.item && ["artist", "track", "album"].includes(entry.item.kind)))) .slice(0, LIMIT) : [];
  } catch { entries = []; }
  return entries!;
}
export function prependMusicSearch(entries: MusicSearchHistoryEntry[], entry: MusicSearchHistoryEntry) {
  return [entry, ...entries.filter((current) => current.id !== entry.id)].slice(0, LIMIT);
}
function publish(next: MusicSearchHistoryEntry[]) {
  entries = next;
  writeMusicPreference(KEY, JSON.stringify(next));
  listeners.forEach((listener) => listener());
}
export function rememberMusicSearch(query: string, scope: string | null) {
  const trimmed = query.trim();
  if (!trimmed) return;
  publish(prependMusicSearch(snapshot(), { id: `query:${scope ?? ""}:${trimmed.toLowerCase()}`, query: trimmed, scope }));
}
export function rememberMusicSearchItem(item: MusicCatalogItem) {
  if (item.kind !== "artist" && item.kind !== "album" && item.kind !== "track") return;
  // Keep display/navigation metadata, never resolved playback URLs.
  const { kind, id, connectorId } = item;
  const saved: MusicCatalogItem = kind === "artist"
    ? { kind, id, connectorId, name: item.name, artwork: item.artwork, subtitle: item.subtitle }
    : kind === "album"
      ? { kind, id, connectorId, title: item.title, artist: item.artist, artwork: item.artwork, year: item.year, explicit: item.explicit }
      : { kind, id, connectorId, title: item.title, artist: item.artist, artwork: item.artwork, album: item.album, explicit: item.explicit, durationSeconds: item.durationSeconds, durationLabel: item.durationLabel, mediaKind: item.mediaKind };
  publish(prependMusicSearch(snapshot(), { id: `${kind}:${connectorId}:${id}`, item: saved }));
}
export function removeMusicSearch(id: string) { publish(snapshot().filter((entry) => entry.id !== id)); }
export function useMusicSearchHistory() {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, snapshot, snapshot);
}
