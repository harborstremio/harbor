import type { SportsSlice } from "./hub-cache";
import { filterCachedTournament } from "./slice-calendar";
import { getSportsMetadata, putSportsMetadata } from "./artwork-storage";

const PREFIX = "harbor.sports.board.v3:";
const MAX_AGE = 7 * 86400_000;
const MAX_ENTRIES = 100;
const memory = new Map<string, SportsSlice>();
const writes = new Map<string, SportsSlice>();
let queued = false;
let pruned = false;
const SNAPSHOT_KEY = "harbor.sports.board-snapshot.v1";
let hydration: Promise<void> | undefined;
let snapshotTimer: ReturnType<typeof setTimeout> | undefined;

function validSlice(raw: unknown): raw is SportsSlice {
  const slice = raw as SportsSlice | null;
  return (
    !!slice &&
    Number.isFinite(slice.at) &&
    Date.now() - slice.at >= 0 &&
    Date.now() - slice.at < MAX_AGE &&
    Array.isArray(slice.games) &&
    slice.games.length <= 4000 &&
    slice.games.every(
      (game) =>
        game &&
        typeof game.id === "string" &&
        typeof game.league === "string" &&
        ["pre", "in", "post"].includes(game.state) &&
        game.home &&
        typeof game.home.name === "string" &&
        game.away &&
        typeof game.away.name === "string" &&
        Number.isFinite(game.startMs),
    )
  );
}

/** Disk fallback remains available when unrelated app data fills localStorage. */
export function hydrateSportsSlices() {
  if (!hydration)
    hydration = getSportsMetadata(SNAPSHOT_KEY)
      .then((value) => {
        if (!Array.isArray(value)) return;
        for (const entry of value.slice(-MAX_ENTRIES)) {
          if (
            !Array.isArray(entry) ||
            typeof entry[0] !== "string" ||
            entry[0].length > 100 ||
            !validSlice(entry[1])
          )
            continue;
          const [key, slice] = entry as [string, SportsSlice];
          if ((memory.get(key)?.at ?? 0) < slice.at)
            remember(key, {
              ...slice,
              games: filterCachedTournament(key, slice.games),
            });
        }
      })
      .catch(() => {});
  return hydration;
}

function persistSnapshot() {
  if (snapshotTimer) return;
  snapshotTimer = setTimeout(() => {
    snapshotTimer = undefined;
    const write = () => {
      void hydrateSportsSlices().then(() => putSportsMetadata(SNAPSHOT_KEY, [...memory]));
    };
    if (typeof requestIdleCallback === "function") requestIdleCallback(write, { timeout: 1500 });
    else write();
  }, 250);
}

function remember(key: string, value: SportsSlice) {
  memory.delete(key);
  memory.set(key, value);
  if (memory.size > MAX_ENTRIES) memory.delete(memory.keys().next().value!);
}

export function readSportsSlice(key: string): SportsSlice | undefined {
  const hit = memory.get(key);
  if (hit && Date.now() - hit.at < MAX_AGE) return hit;
  try {
    const raw = JSON.parse(localStorage.getItem(PREFIX + key) ?? "null") as SportsSlice | null;
    if (validSlice(raw)) {
      const slice = { ...raw, games: filterCachedTournament(key, raw.games) };
      remember(key, slice);
      return slice;
    }
  } catch {
    /* A private window, full disk or an older cache must not block the page. */
  }
}

function scheduleWrite() {
  if (queued || !writes.size) return;
  queued = true;
  if (typeof requestIdleCallback === "function") requestIdleCallback(writeOne, { timeout: 1500 });
  else setTimeout(writeOne, 100);
}

function writeOne() {
  queued = false;
  const entry = writes.entries().next().value;
  if (!entry) return;
  const [key, value] = entry;
  writes.delete(key);
  try {
    // Prune from key dates, never parse every stored scoreboard for every feed response.
    if (!pruned) {
      const keys = Object.keys(localStorage).filter((name) => name.startsWith(PREFIX));
      keys.sort((a, b) => (a.split("@")[1] ?? "").localeCompare(b.split("@")[1] ?? ""));
      for (const old of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES + writes.size + 1)))
        localStorage.removeItem(old);
      pruned = true;
    }
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    // A long-running session can visit new dates; eviction needs only names, not JSON bodies.
    const keys = Object.keys(localStorage).filter((name) => name.startsWith(PREFIX));
    if (keys.length > MAX_ENTRIES) {
      const old = keys
        .filter((name) => name !== PREFIX + key)
        .sort((a, b) => (a.split("@")[1] ?? "").localeCompare(b.split("@")[1] ?? ""));
      for (const name of old.slice(0, keys.length - MAX_ENTRIES)) localStorage.removeItem(name);
    }
  } catch {
    /* Memory remains usable if persistent storage is unavailable. */
  }
  scheduleWrite();
  persistSnapshot();
}

/** Score updates use memory immediately; serialize one coalesced slice per idle turn. */
export function saveSportsSlice(key: string, value: SportsSlice) {
  remember(key, value);
  writes.set(key, value);
  if (writes.size > MAX_ENTRIES) writes.delete(writes.keys().next().value!);
  scheduleWrite();
}
