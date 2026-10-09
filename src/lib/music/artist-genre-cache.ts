import { genreSearchKey } from "./genre-catalog";
import { readLocalJson, writeLocalJson } from "./local-store";

type Entry = { tags: string[]; at: number };
const STORE = "artist-genres-v1";
const MAX_ARTISTS = 1500;
const MAX_AGE = 30 * 24 * 60 * 60_000;
const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
let hydrated: Promise<void> | undefined;

export function subscribeArtistGenres(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function hydrate() {
  return hydrated ??= readLocalJson<[string, Entry][]>(STORE).then(saved => {
    if (!Array.isArray(saved)) return;
    for (const pair of saved.slice(-MAX_ARTISTS)) {
      if (!Array.isArray(pair)) continue;
      const [key, value] = pair;
      if (typeof key !== "string" || !value || !Number.isFinite(value.at) || Date.now() - value.at > MAX_AGE || !Array.isArray(value.tags)) continue;
      if (!entries.has(key)) entries.set(key, { at: value.at, tags: value.tags.filter(tag => typeof tag === "string").slice(0, 12) });
    }
  }).catch(() => {});
}

/** Reuse metadata fetched for artist pages; playlist filters never initiate a lookup. */
export function rememberArtistGenres(name: string, tags: readonly string[]) {
  const key = genreSearchKey(name);
  if (!key || !tags.length) return;
  const previous = entries.get(key)?.tags;
  entries.set(key, { tags: [...tags].slice(0, 12), at: Date.now() });
  if (!previous || previous.join("\n") !== tags.slice(0, 12).join("\n")) listeners.forEach(listener => listener());
  void hydrate().then(() => {
    const latest = [...entries].sort((a, b) => a[1].at - b[1].at).slice(-MAX_ARTISTS);
    entries.clear();
    for (const [artist, value] of latest) entries.set(artist, value);
    writeLocalJson(STORE, latest);
  });
}

export async function readArtistGenres(): Promise<ReadonlyMap<string, readonly string[]>> {
  await hydrate();
  return new Map([...entries].filter(([, entry]) => Date.now() - entry.at <= MAX_AGE).map(([key, entry]) => [key, entry.tags]));
}
