import { parseLibraryArtwork, type LibraryArtwork } from "./igdb-artwork";
import { isSourceListingId } from "./source-listing";
import { isLauncherGameId } from "./launchers";
import { isSteamShortcutId } from "./steam-shortcuts";
import { LIBRARY_PLAY_STATUSES, type LibraryPlayStatus } from "./library-status";
import { parseLibraryTitleRules, validLibraryTitle, type LibraryTitleRules } from "./library-titles";
import { validLibraryLinkOrder, type LibraryLinkChange } from "./library-links";
import { libraryMetadataMatch, type LibraryMetadataMatch } from "./library-metadata";
export type LibraryPreference = { pinned: boolean; hidden: boolean; cover: string | null; playStatus?: LibraryPlayStatus; title?: string | null; linkOrder?: string[]; metadata?: LibraryMetadataMatch; artwork?: LibraryArtwork };
export type LibraryPreferences = { version: 1; entries: Record<string, LibraryPreference>; titleRules?: LibraryTitleRules };
export type LibraryVisibility = "visible" | "pinned" | "hidden";
export const emptyLibraryPreferences = (): LibraryPreferences => ({ version: 1, entries: {} });
export const libraryPreferenceKey = (profile: string) => `harbor.games.presentation.v1:${encodeURIComponent(profile)}`;
export const LIBRARY_PREFERENCES_CHANGED = "harbor:library-preferences-changed";
export const defaultLibraryPreference = (): LibraryPreference => ({ pinned: false, hidden: false, cover: null });
export const romPreferenceId = (system: number, path: string) => `rom:${system}:${path}`;
const MAX_BYTES = 2 * 1024 * 1024;
function validId(id: string) { if (id.startsWith("source:")) return isSourceListingId(id); if (id.startsWith("steam-shortcut:")) return isSteamShortcutId(id); if (/^(?:battlenet|ea|ubisoft|epic|gog|riot|rockstar|rsi|bsg|itch):/.test(id)) return isLauncherGameId(id); return /^(?:steam|igdb):[1-9]\d{0,12}$/.test(id) || /^custom:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) || /^rom:[1-9]\d{0,3}:.+$/.test(id) && id.length <= 4200 && !/[\x00-\x1f]/.test(id); }
function validCover(value: unknown): value is string { return typeof value === "string" && value.length <= 4096 && /^(?:[a-z]:[\\/]|[\\/])/i.test(value) && !/[\x00-\x1f]/.test(value); }
export function parseLibraryPreferences(raw: string | null): LibraryPreferences {
  if (raw === null) return emptyLibraryPreferences(); if (raw.length > MAX_BYTES) throw Error("library_prefs_limit");
  let value: LibraryPreferences; try { value = JSON.parse(raw); } catch { throw Error("library_prefs_read"); }
  if (!value || value.version !== 1 || !value.entries || typeof value.entries !== "object" || Array.isArray(value.entries)) throw Error("library_prefs_read");
  const entries = Object.entries(value.entries); if (entries.length > 5000) throw Error("library_prefs_limit");
  const clean: Record<string, LibraryPreference> = {};
  for (const [id, item] of entries) {
    if (!validId(id) || !item || typeof item.pinned !== "boolean" || typeof item.hidden !== "boolean" || item.cover !== null && !validCover(item.cover)
      || item.playStatus !== undefined && !LIBRARY_PLAY_STATUSES.includes(item.playStatus)
      || item.title !== undefined && item.title !== null && !validLibraryTitle(item.title)
      || item.linkOrder !== undefined && !validLibraryLinkOrder(item.linkOrder)) throw Error("library_prefs_read");
    clean[id] = { pinned: item.pinned, hidden: item.hidden, cover: item.cover, ...(item.playStatus && item.playStatus !== "unset" ? {playStatus:item.playStatus} : {}), ...(item.title !== undefined ? {title:item.title} : {}), ...(item.linkOrder?.length ? {linkOrder:[...item.linkOrder]} : {}), ...(item.metadata !== undefined ? {metadata:libraryMetadataMatch(item.metadata)} : {}), ...(item.artwork !== undefined ? {artwork:parseLibraryArtwork(item.artwork)} : {}) };
  }
  return { version: 1, entries: clean, ...(value.titleRules !== undefined ? {titleRules:parseLibraryTitleRules(value.titleRules,validId)} : {}) };
}
export function patchLibraryPreferences(store: LibraryPreferences, ids: string[], patch: Partial<LibraryPreference>): LibraryPreferences {
  if (!ids.length || ids.length > 5000 || ids.some(id => !validId(id))) throw Error("library_prefs_read");
  if (patch.playStatus !== undefined && !LIBRARY_PLAY_STATUSES.includes(patch.playStatus)) throw Error("library_prefs_read");
  if (patch.linkOrder !== undefined && !validLibraryLinkOrder(patch.linkOrder)) throw Error("library_prefs_read");
  const entries = { ...store.entries };
  for (const id of new Set(ids)) { const next = { ...(entries[id] ?? defaultLibraryPreference()), ...patch }; if (!next.pinned && !next.hidden && !next.cover && (!next.playStatus || next.playStatus === "unset") && next.title === undefined && !next.linkOrder?.length && !next.metadata && !next.artwork) delete entries[id]; else entries[id] = next; }
  return parseLibraryPreferences(JSON.stringify({ ...store, entries }));
}
export function libraryPreferenceVisible(preference: LibraryPreference | undefined, visibility: LibraryVisibility) { return visibility === "hidden" ? !!preference?.hidden : !preference?.hidden && (visibility !== "pinned" || !!preference?.pinned); }
export function readLibraryPreferences(profile: string) { return parseLibraryPreferences(localStorage.getItem(libraryPreferenceKey(profile))); }
const writes = new Map<string, Promise<unknown>>();
export function changeLibraryPreferences(profile: string, ids: string[], patch: Partial<LibraryPreference>): Promise<LibraryPreferences> {
  return writeLibraryPreferences(profile, store => patchLibraryPreferences(store,ids,patch));
}
function writeLibraryPreferences(profile: string, transform: (store: LibraryPreferences) => LibraryPreferences): Promise<LibraryPreferences> {
  const key = libraryPreferenceKey(profile), commit = () => { const next = transform(readLibraryPreferences(profile)), raw = JSON.stringify(next); if (new TextEncoder().encode(raw).length > MAX_BYTES) throw Error("library_prefs_limit"); localStorage.setItem(key, raw); if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(LIBRARY_PREFERENCES_CHANGED,{detail:profile})); return next; };
  const pending = (writes.get(key) ?? Promise.resolve()).catch(() => {}).then(() => typeof navigator !== "undefined" && navigator.locks ? navigator.locks.request(key, commit) : commit());
  writes.set(key, pending); void pending.finally(() => { if (writes.get(key) === pending) writes.delete(key); }).catch(() => {}); return pending;
}
export type LibraryTitleChange = { id: string; title: string | null; expectedTitle?: string | null };
export function patchLibraryTitles(store: LibraryPreferences, changes: LibraryTitleChange[], rules: LibraryTitleRules, expectedRules: LibraryTitleRules | undefined): LibraryPreferences {
  if (changes.length > 5000 || new Set(changes.map(change=>change.id)).size !== changes.length) throw Error("library_prefs_limit");
  if (JSON.stringify(store.titleRules) !== JSON.stringify(expectedRules)) throw Error("library_title_conflict");
  const titleRules = parseLibraryTitleRules(rules,validId), entries = {...store.entries};
  for (const change of changes) {
    if (!validId(change.id) || change.title !== null && !validLibraryTitle(change.title)) throw Error("library_prefs_read");
    if (entries[change.id]?.title !== change.expectedTitle) throw Error("library_title_conflict");
    entries[change.id] = {...(entries[change.id] ?? defaultLibraryPreference()), title:change.title};
  }
  return parseLibraryPreferences(JSON.stringify({...store,entries,titleRules}));
}
export function changeLibraryTitles(profile: string, changes: LibraryTitleChange[], rules: LibraryTitleRules, expectedRules: LibraryTitleRules | undefined): Promise<LibraryPreferences> {
  return writeLibraryPreferences(profile,store=>patchLibraryTitles(store,changes,rules,expectedRules));
}
export function patchLibraryLinkOrders(store: LibraryPreferences, changes: LibraryLinkChange[]): LibraryPreferences {
  if (changes.length > 5000 || new Set(changes.map(change=>change.id)).size !== changes.length) throw Error("library_prefs_limit");
  const entries = {...store.entries};
  for (const change of changes) {
    if (!validId(change.id) || !validLibraryLinkOrder(change.order)) throw Error("library_prefs_read");
    if (JSON.stringify(store.entries[change.id]?.linkOrder) !== JSON.stringify(change.expectedOrder)) throw Error("library_links_conflict");
    const next = {...(entries[change.id] ?? defaultLibraryPreference()),linkOrder:change.order};
    if (!next.pinned && !next.hidden && !next.cover && (!next.playStatus || next.playStatus === "unset") && next.title === undefined && !next.linkOrder.length && !next.metadata && !next.artwork) delete entries[change.id];
    else entries[change.id] = next;
  }
  return parseLibraryPreferences(JSON.stringify({...store,entries}));
}
export function changeLibraryLinkOrders(profile: string, changes: LibraryLinkChange[]): Promise<LibraryPreferences> {
  return changes.length ? writeLibraryPreferences(profile,store=>patchLibraryLinkOrders(store,changes)) : Promise.resolve(readLibraryPreferences(profile));
}
export function patchLibraryMetadata(store: LibraryPreferences, id: string, match: LibraryMetadataMatch | null, expected?: LibraryMetadataMatch): LibraryPreferences {
  if (JSON.stringify(store.entries[id]?.metadata) !== JSON.stringify(expected)) throw Error("library_metadata_conflict");
  return patchLibraryPreferences(store,[id],{metadata:match===null?undefined:libraryMetadataMatch(match)});
}
export function changeLibraryMetadata(profile: string, id: string, match: LibraryMetadataMatch | null, expected?: LibraryMetadataMatch, signal?: AbortSignal) {
  return writeLibraryPreferences(profile,store=>{ signal?.throwIfAborted(); return patchLibraryMetadata(store,id,match,expected); });
}

export function patchLibraryArtwork(store: LibraryPreferences, id: string, artwork: LibraryArtwork | null, expected?: LibraryArtwork, expectedMetadata?: LibraryMetadataMatch): LibraryPreferences {
  if (JSON.stringify(store.entries[id]?.artwork) !== JSON.stringify(expected ? parseLibraryArtwork(expected) : undefined) || JSON.stringify(store.entries[id]?.metadata) !== JSON.stringify(expectedMetadata)) throw Error("library_artwork_conflict");
  return patchLibraryPreferences(store, [id], { artwork: artwork === null ? undefined : parseLibraryArtwork(artwork) });
}
export function changeLibraryArtwork(profile: string, id: string, artwork: LibraryArtwork | null, expected?: LibraryArtwork, expectedMetadata?: LibraryMetadataMatch) {
  return writeLibraryPreferences(profile, store => patchLibraryArtwork(store, id, artwork, expected, expectedMetadata));
}
