import { useSyncExternalStore } from "react";

export type CountryPrefs = { selected: string[] };

const KEY = "harbor.iptv.countryPrefs.v1";
const EMPTY: CountryPrefs = { selected: [] };

let cache: Record<string, CountryPrefs> | null = null;
const listeners = new Set<() => void>();

function load(): Record<string, CountryPrefs> {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    cache = parsed && typeof parsed === "object" ? (parsed as Record<string, CountryPrefs>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function persist(next: Record<string, CountryPrefs>) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  for (const l of listeners) l();
}

function update(sourceId: string, fn: (p: CountryPrefs) => CountryPrefs) {
  if (!sourceId) return;
  const map = { ...load() };
  map[sourceId] = fn(map[sourceId] ?? EMPTY);
  persist(map);
}

export function toggleCountry(sourceId: string, code: string): void {
  update(sourceId, (p) => ({
    selected: p.selected.includes(code) ? p.selected.filter((c) => c !== code) : [...p.selected, code],
  }));
}

export function clearCountries(sourceId: string): void {
  update(sourceId, () => ({ selected: [] }));
}

export function removeCountryPrefs(sourceId: string): void {
  if (!sourceId) return;
  const map = load();
  if (!(sourceId in map)) return;
  const next = { ...map };
  delete next[sourceId];
  persist(next);
}

export function useCountryPrefs(sourceId: string): CountryPrefs {
  const map = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    load,
    load,
  );
  return map[sourceId] ?? EMPTY;
}
