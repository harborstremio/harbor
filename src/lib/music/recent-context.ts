import { useSyncExternalStore } from "react";
import { requestMusicExplore, type MusicExploreRequest } from "./navigation";
import {
  hydrateJsonStore,
  readJsonStore,
  readLocalJson,
  writeLocalJson,
} from "./local-store";
import { musicTrackKeys } from "./playlist-membership";
import { dedupeMusicTracks } from "./track-identity";
import type { MusicTrack } from "./types";

export type MusicTrackIdentity = Pick<MusicTrack, "id" | "connectorId" | "title" | "artist">;

const KEY = "harbor.music.recent-contexts.v1";
const CONTEXT_LIMIT = 200;
const LINK_LIMIT = 8000;
const LINKS_PER_CONTEXT = 120;
const ARTWORK_LIMIT = 4;

export type MusicRecentContextKind = "playlist" | "similar";

export type MusicRecentContext = {
  kind: MusicRecentContextKind;
  id: string;
  name: string;
  artwork: string[];
  at: number;
  seed?: MusicTrack;
};

type MusicRecentLink = { key: string; kind: MusicRecentContextKind; id: string };

type MusicRecentContextStore = { contexts: MusicRecentContext[]; links: MusicRecentLink[] };

const EMPTY: MusicRecentContextStore = { contexts: [], links: [] };

function contextKey(kind: MusicRecentContextKind, id: string): string {
  return `${kind}:${id}`;
}

const MIX_STORE = "context-tracks";
const HELD_LIMIT = 24;
const SURPRISE_TRACK_LIMIT = 100;
const heldTracks = new Map<string, MusicTrack[]>();
const trackListeners = new Set<() => void>();
let hydration: Promise<void> | undefined;
const persistentMix = (key: string) => key.startsWith("similar:mix:surprise:");
const publishTracks = () => { for (const listener of trackListeners) listener(); };

function persistHeld(): void {
  writeLocalJson(MIX_STORE, Object.fromEntries(heldTracks));
}

export function hydrateMusicContextTracks(): Promise<void> {
  return hydration ??= (async () => {
    const saved = await readLocalJson<Record<string, MusicTrack[]>>(MIX_STORE);
    if (!saved) return;
    let merged = false;
    for (const [key, tracks] of Object.entries(saved)) {
      if (!Array.isArray(tracks) || !tracks.length) continue;
      if (persistentMix(key)) {
        const current = heldTracks.get(key);
        const next = dedupeMusicTracks([...tracks, ...(current ?? [])]).slice(-SURPRISE_TRACK_LIMIT);
        heldTracks.set(key, next);
        merged ||= !!current || next.length !== tracks.length;
      } else if (!heldTracks.has(key)) heldTracks.set(key, tracks);
    }
    if (merged) persistHeld();
    publishTracks();
  })();
}

export function rememberMusicContextTracks(
  kind: MusicRecentContextKind,
  id: string,
  tracks: readonly MusicTrack[],
): void {
  if (!tracks.length) return;
  const key = contextKey(kind, id);
  const current = heldTracks.get(key);
  // Keep one rolling Surprise mix per profile without evicting it with ordinary snapshots.
  const next = persistentMix(key) ? dedupeMusicTracks([...(current ?? []), ...tracks]).slice(-SURPRISE_TRACK_LIMIT) : [...tracks];
  if (persistentMix(key) && current?.length === next.length && current.every((track, at) => track === next[at])) return;
  heldTracks.delete(key);
  heldTracks.set(key, next);
  const snapshots = [...heldTracks.keys()].filter(value => !persistentMix(value));
  for (const stale of snapshots.slice(0, Math.max(0, snapshots.length - HELD_LIMIT))) heldTracks.delete(stale);
  persistHeld();
  publishTracks();
}

export function heldMusicContextTracks(
  kind: MusicRecentContextKind,
  id: string,
): MusicTrack[] | null {
  return heldTracks.get(contextKey(kind, id)) ?? null;
}

export function useMusicContextTracks(kind: MusicRecentContextKind, id: string | undefined): MusicTrack[] | null {
  const snapshot = () => id ? heldMusicContextTracks(kind, id) : null;
  return useSyncExternalStore(
    listener => { trackListeners.add(listener); return () => { trackListeners.delete(listener); }; },
    snapshot,
    snapshot,
  );
}

function isKind(value: unknown): value is MusicRecentContextKind {
  return value === "playlist" || value === "similar";
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseContext(value: unknown): MusicRecentContext | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  if (!isKind(entry.kind)) return null;
  const id = text(entry.id).trim();
  const name = text(entry.name).trim();
  if (!id || !name) return null;
  const artwork = Array.isArray(entry.artwork)
    ? entry.artwork.filter((url): url is string => typeof url === "string" && url.length > 0)
    : [];
  const seed =
    entry.seed && typeof entry.seed === "object" && text((entry.seed as MusicTrack).id)
      ? (entry.seed as MusicTrack)
      : undefined;
  if (entry.kind === "similar" && !seed) return null;
  return {
    kind: entry.kind,
    id,
    name,
    artwork: artwork.slice(0, ARTWORK_LIMIT),
    at: typeof entry.at === "number" ? entry.at : 0,
    seed,
  };
}

function parseLink(value: unknown): MusicRecentLink | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  const key = text(entry.key).trim();
  const id = text(entry.id).trim();
  if (!key || !id || !isKind(entry.kind)) return null;
  return { key, kind: entry.kind, id };
}

const CONTEXT_STORE = "recent-contexts";

export async function hydrateMusicRecentContexts(): Promise<void> {
  await hydrateJsonStore(CONTEXT_STORE, KEY);
  store = read();
  index = buildIndex(store);
  for (const listener of listeners) listener();
}

function read(): MusicRecentContextStore {
  try {
    const parsed = readJsonStore<Record<string, unknown> | null>(CONTEXT_STORE, KEY, null);
    if (!parsed) return EMPTY;
    const contexts = Array.isArray(parsed?.contexts)
      ? parsed.contexts
          .map(parseContext)
          .filter((entry): entry is MusicRecentContext => entry !== null)
          .slice(0, CONTEXT_LIMIT)
      : [];
    const keys = new Set(contexts.map((entry) => contextKey(entry.kind, entry.id)));
    const links = Array.isArray(parsed?.links)
      ? parsed.links
          .map(parseLink)
          .filter((entry): entry is MusicRecentLink => entry !== null)
          .filter((entry) => keys.has(contextKey(entry.kind, entry.id)))
          .slice(0, LINK_LIMIT)
      : [];
    return contexts.length === 0 ? EMPTY : { contexts, links };
  } catch {
    return EMPTY;
  }
}

function buildIndex(store: MusicRecentContextStore): Map<string, MusicRecentContext> {
  const byKey = new Map(store.contexts.map((entry) => [contextKey(entry.kind, entry.id), entry]));
  const index = new Map<string, MusicRecentContext>();
  for (const link of store.links) {
    const context = byKey.get(contextKey(link.kind, link.id));
    if (context && !index.has(link.key)) index.set(link.key, context);
  }
  return index;
}

let store = read();
let index = buildIndex(store);
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function commit(next: MusicRecentContextStore): void {
  store = next;
  index = buildIndex(next);
  writeLocalJson(CONTEXT_STORE, next);
  for (const listener of listeners) listener();
}

export function recordMusicRecentContext(
  entry: Omit<MusicRecentContext, "at">,
  tracks: readonly MusicTrackIdentity[] = [],
): void {
  const id = entry.id.trim();
  const name = entry.name.trim();
  if (!id || !name) return;
  if (entry.kind === "similar" && !entry.seed) return;
  const key = contextKey(entry.kind, id);
  const context: MusicRecentContext = {
    ...entry,
    id,
    name,
    artwork: entry.artwork.filter((url) => url.trim().length > 0).slice(0, ARTWORK_LIMIT),
    at: Date.now(),
  };
  const contexts = [
    context,
    ...store.contexts.filter((item) => contextKey(item.kind, item.id) !== key),
  ].slice(0, CONTEXT_LIMIT);
  const keys = new Set(contexts.map((item) => contextKey(item.kind, item.id)));
  const seen = new Set<string>();
  const fresh: MusicRecentLink[] = [];
  for (const track of tracks) {
    for (const value of musicTrackKeys(track)) {
      if (seen.has(value)) continue;
      seen.add(value);
      fresh.push({ key: value, kind: entry.kind, id });
    }
    if (fresh.length >= LINKS_PER_CONTEXT) break;
  }
  const links = [...fresh, ...store.links.filter((link) => !seen.has(link.key))]
    .filter((link) => keys.has(contextKey(link.kind, link.id)))
    .slice(0, LINK_LIMIT);
  commit({ contexts, links });
}

export function refreshMusicRecentContextArtwork(updates: Map<string, string[]>): void {
  let changed = false;
  const contexts = store.contexts.map((context) => {
    const next = updates.get(context.id);
    if (!next?.length || next.join("|") === context.artwork.join("|")) return context;
    changed = true;
    return { ...context, artwork: next.slice(0, ARTWORK_LIMIT) };
  });
  if (changed) commit({ contexts, links: store.links });
}

export function musicContextArtwork(tracks: readonly MusicTrack[]): string[] {
  const seen = new Set<string>();
  const covers: string[] = [];
  for (const track of tracks) {
    const url = track.artwork?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    covers.push(url);
    if (covers.length === ARTWORK_LIMIT) break;
  }
  return covers;
}

export function getMusicRecentContexts(): MusicRecentContext[] {
  return store.contexts;
}

export function useMusicRecentContexts(): MusicRecentContext[] {
  return useSyncExternalStore(subscribe, getMusicRecentContexts, getMusicRecentContexts);
}

export function getMusicTrackContext(
  track: MusicTrackIdentity | null | undefined,
): MusicRecentContext | null {
  if (!track) return null;
  for (const key of musicTrackKeys(track)) {
    const found = index.get(key);
    if (found) return found;
  }
  return null;
}

export function useMusicTrackContext(
  track: MusicTrackIdentity | null | undefined,
): MusicRecentContext | null {
  return useSyncExternalStore(
    subscribe,
    () => getMusicTrackContext(track),
    () => getMusicTrackContext(track),
  );
}

export async function reopenMusicMix(
  context: MusicRecentContext,
  open: (request: MusicExploreRequest) => void = requestMusicExplore,
): Promise<void> {
  const seed = context.seed;
  if (!seed) return;
  if (context.id.startsWith("mix:personal:v2:")) {
    const { activeProfileId } = await import("@/lib/active-profile-id");
    const mix = await (await import("./made-for-you")).readMadeForYouMix(context.id, activeProfileId());
    await hydrateMusicContextTracks();
    const { mixRecordings } = await import("./mix-quality");
    const { filterBlockedTracks } = await import("./artist-blocks");
    const { dailyMixHasVariety, dailyArtistKey } = await import("./daily-discovery-selection");
    const queue = mix?.tracks ?? mixRecordings(filterBlockedTracks(filterBlockedTracks(heldMusicContextTracks("similar", context.id) ?? [], "show"), "play"));
    if (context.id.endsWith(":artist") ? queue.length < 5 || new Set(queue.map(dailyArtistKey)).size !== 1 : !dailyMixHasVariety(queue)) throw new Error("Music mix unavailable");
    open({ kind: "similar", track: queue[0], queue, label: context.name, contextId: context.id });
    return;
  }
  if (context.id.startsWith("mix:discovery:")) {
    const mix = await (await import("./daily-discovery")).loadDailyDiscoveryMix(context.id);
    if (!mix) throw new Error("Music mix unavailable");
    open({ kind: "similar", track: mix.tracks[0], queue: mix.tracks, label: context.name, contextId: context.id });
    return;
  }
  if (context.id.startsWith("mix:genre:")) {
    const { loadDailyDiscoveryMix, planDailyDiscovery } = await import("./daily-discovery");
    const { dailyDayKey } = await import("./daily-discovery-selection");
    const { activeProfileId } = await import("@/lib/active-profile-id");
    const genreId = Number(context.id.slice("mix:genre:".length));
    const plan = planDailyDiscovery([genreId], dailyDayKey(), activeProfileId()).find(value => value.genreId === genreId);
    const mix = plan ? await loadDailyDiscoveryMix(plan.id) : null;
    if (!mix) throw new Error("Music mix unavailable");
    const label = (await import("@/lib/i18n")).t("music.madeForYou.namedMix", { name: mix.name });
    open({ kind: "similar", track: mix.tracks[0], queue: mix.tracks, label, contextId: mix.id });
    return;
  }
  await hydrateMusicContextTracks();
  const held = heldMusicContextTracks("similar", context.id);
  if (context.id.startsWith("mix:daily:")) {
    const { loadDailyMixTracks, mixArtistKey } = await import("./daily-mixes");
    const artists = context.id.startsWith("mix:daily:v2:")
      ? context.id.slice("mix:daily:v2:".length).split("|").map(decodeURIComponent)
      : [mixArtistKey(seed)];
    const queue = await loadDailyMixTracks({ id: context.id, index: 1, artists, seeds: [seed], artwork: context.artwork });
    const { dailyArtistKey, dailyArtistName } = await import("./daily-discovery-selection");
    const artistOnly = queue.length > 0 && new Set(queue.map(dailyArtistKey)).size === 1;
    const label = artistOnly ? (await import("@/lib/i18n")).t("music.madeForYou.namedMix", { name: dailyArtistName(queue[0]) }) : context.name;
    if (artistOnly && label !== context.name) recordMusicRecentContext({ ...context, name: label }, queue);
    open({ kind: "similar", track: seed, queue, label, contextId: context.id });
    return;
  }
  if (held?.length) {
    const queue = held;
    if (queue.length) {
      open({ kind: "similar", track: seed, queue, label: context.name, contextId: context.id });
      return;
    }
  }
  const named = context.id.startsWith("mix:artist:");
  const mix = named
    ? await (await import("./personal-mixes")).reloadPersonalMix(context.id, seed)
    : await (await import("./player")).musicSimilarTracks(seed);
  if (named && !mix.length) throw new Error("Music mix unavailable");
  const queue = mix.length > 0 ? mix : [seed];
  rememberMusicContextTracks("similar", context.id, queue);
  open({ kind: "similar", track: seed, queue, label: context.name, contextId: context.id });
}
