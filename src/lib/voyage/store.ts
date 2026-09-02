import { useSyncExternalStore } from "react";
import type { Meta } from "@/lib/cinemeta";
import { getVoteEntries } from "@/lib/feed/preferences";
import { recentlyPlayed } from "@/lib/playback-history";
import { externalWatchedIds } from "@/lib/feed/external-watched";
import { isVoyageWatched, voyageProgress } from "./progress";
import { movieWatchedIds } from "@/lib/movie-watched";
import { watchedFlagIds } from "@/lib/watched-flag";
import { generatePool, usable, type PoolExclude } from "./generate";
import { ensureRelated, prefetchRelated, relatedResolved } from "./affinity";
import { themeById } from "./themes";
import type { StoredVoyage, Voyage, VoyageState, VoyageTheme } from "./types";

const KEY = "harbor.voyage.v1";

function dayKey(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function adopt(v: StoredVoyage): Voyage {
  if (v.phase) return { ...v, phase: v.phase, playedIds: v.playedIds ?? [] };
  if (v.routeIds.length === 0) return { ...v, phase: "building", playedIds: [] };
  return { ...v, phase: "sailing", playedIds: [...v.routeIds], targetLength: v.routeIds.length };
}

function load(): VoyageState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Omit<VoyageState, "active"> & { active: StoredVoyage | null };
      return { ...s, active: s.active ? adopt(s.active) : null };
    }
  } catch {
    /* ignore */
  }
  return { active: null, streak: 0, lastSail: null };
}

let state: VoyageState = load();
let open = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}
function set(next: Partial<VoyageState>) {
  state = { ...state, ...next };
  persist();
  emit();
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useVoyage(): VoyageState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
export function useVoyageOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open, () => open);
}

export function openVoyage() {
  open = true;
  emit();
}
export function closeVoyage() {
  open = false;
  emit();
}

function sailFields(): Pick<VoyageState, "streak" | "lastSail"> {
  const t = dayKey(0);
  if (state.lastSail === t) return { streak: state.streak, lastSail: t };
  const streak = state.lastSail === dayKey(-1) ? state.streak + 1 : 1;
  return { streak, lastSail: t };
}

function buildExclude(): PoolExclude {
  const ids = new Set<string>();
  for (const e of getVoteEntries()) {
    if (e.vote !== "down") continue;
    ids.add(e.id);
    if (e.altId) ids.add(e.altId);
  }
  const watched = recentlyPlayed();
  for (const id of watched.ids) ids.add(id);
  for (const id of movieWatchedIds()) ids.add(id);
  for (const id of watchedFlagIds()) ids.add(id);
  for (const id of externalWatchedIds()) ids.add(id);
  return { ids, titles: watched.titles };
}

function genreProfile(picked: Meta[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of picked) {
    for (const g of m.genres ?? []) map.set(g, (map.get(g) ?? 0) + 1);
  }
  return map;
}

function rankHeadings(
  pool: Meta[],
  picked: Meta[],
  votes: Record<string, number>,
  used: Set<string>,
  seen: Set<string>,
  n = 3,
): string[] {
  const blocked = buildExclude().ids ?? new Set<string>();
  const eligible = pool.filter((m) => !used.has(m.id) && !blocked.has(m.id));
  if (eligible.length === 0) return [];
  const profile = genreProfile(picked);
  const score = (m: Meta) => {
    let g = 0;
    for (const gen of m.genres ?? []) g += profile.get(gen) ?? 0;
    const unseen = seen.has(m.id) ? 0 : 1;
    return (votes[m.id] ?? 0) * 6 + g * 1.5 + unseen * 2 + Math.random();
  };
  return eligible
    .map((m) => ({ id: m.id, s: score(m) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.id);
}

function onTheme(m: Meta, genre?: string): boolean {
  if (!genre) return true;
  const want = genre.toLowerCase();
  return (m.genres ?? []).some((g) => g.toLowerCase() === want);
}

function mergeRelated(
  v: Voyage,
  related: Meta[],
): { pool: Meta[]; recVotes: Record<string, number> } {
  const exclude = buildExclude();
  const genre = themeById(v.themeId)?.genre;
  const have = new Set(v.pool.map((m) => m.id));
  const pool = v.pool.slice();
  const recVotes = { ...(v.recVotes ?? {}) };
  for (const m of related) {
    if (!usable(m, exclude)) continue;
    if (!onTheme(m, genre)) continue;
    recVotes[m.id] = (recVotes[m.id] ?? 0) + 1;
    if (!have.has(m.id)) {
      have.add(m.id);
      pool.push(m);
    }
  }
  return { pool, recVotes };
}

function pickedMetasOf(v: Voyage, routeIds: string[]): Meta[] {
  return routeIds.map((id) => metaById(v, id)).filter((m): m is Meta => !!m);
}

function headingMetas(v: Voyage, ids: string[]): Meta[] {
  return ids.map((id) => metaById(v, id)).filter((m): m is Meta => !!m);
}

export async function startVoyage(
  theme: VoyageTheme,
  targetLength = 5,
  key = "",
): Promise<boolean> {
  const pool = await generatePool(theme, buildExclude());
  if (pool.length < 4) return false;
  const headingIds = rankHeadings(pool, [], {}, new Set(), new Set(), 3);
  const voyage: Voyage = {
    id: `v-${Date.now()}`,
    themeId: theme.id,
    themeLabel: theme.label,
    tagline: theme.tagline,
    accent: theme.accent,
    createdAt: Date.now(),
    targetLength,
    phase: "building",
    pool,
    routeIds: [],
    playedIds: [],
    headingIds,
    seen: [...headingIds],
    recVotes: {},
    enrichedPicks: [],
  };
  set({ active: voyage, ...sailFields() });
  prefetchRelated(headingMetas(voyage, headingIds), key);
  return true;
}

export function chooseHeading(id: string, key = "") {
  const v = state.active;
  if (!v || v.phase !== "building" || v.routeIds.includes(id)) return;
  const routeIds = [...v.routeIds, id];
  const full = routeIds.length >= v.targetLength;
  const picked = metaById(v, id);
  const enriched = new Set(v.enrichedPicks ?? []);

  let base: Voyage = { ...v, routeIds };
  if (picked && !enriched.has(id)) {
    const related = relatedResolved(id);
    if (related && related.length) {
      const merged = mergeRelated(v, related);
      base = {
        ...base,
        pool: merged.pool,
        recVotes: merged.recVotes,
        enrichedPicks: [...enriched, id],
      };
    }
  }

  const used = new Set(routeIds);
  const seen = new Set(v.seen ?? []);
  const headingIds = full
    ? []
    : rankHeadings(base.pool, pickedMetasOf(base, routeIds), base.recVotes ?? {}, used, seen, 3);
  const nextSeen = full ? (v.seen ?? []) : [...new Set([...(v.seen ?? []), ...headingIds])];
  set({ active: { ...base, headingIds, seen: nextSeen }, ...sailFields() });

  if (!full) {
    prefetchRelated(headingMetas(base, headingIds), key);
    if (picked && !(base.enrichedPicks ?? []).includes(id)) {
      void ensureRelated(picked, key).then((related) =>
        refineAfterPick(v.id, routeIds, id, related, key),
      );
    }
  }
}

function refineAfterPick(
  voyageId: string,
  routeIds: string[],
  pickedId: string,
  related: Meta[],
  key: string,
) {
  if (!related.length) return;
  const v = state.active;
  if (!v || v.id !== voyageId || v.phase !== "building") return;
  if (v.routeIds.length !== routeIds.length) return;
  if ((v.enrichedPicks ?? []).includes(pickedId)) return;
  const merged = mergeRelated(v, related);
  const base: Voyage = {
    ...v,
    pool: merged.pool,
    recVotes: merged.recVotes,
    enrichedPicks: [...(v.enrichedPicks ?? []), pickedId],
  };
  const headingIds = rankHeadings(
    base.pool,
    pickedMetasOf(base, base.routeIds),
    base.recVotes ?? {},
    new Set(base.routeIds),
    new Set(base.seen ?? []),
    3,
  );
  const nextSeen = [...new Set([...(base.seen ?? []), ...headingIds])];
  set({ active: { ...base, headingIds, seen: nextSeen } });
  prefetchRelated(headingMetas(base, headingIds), key);
}

export function undoPick(key = "") {
  const v = state.active;
  if (!v || v.phase !== "building" || v.routeIds.length === 0) return;
  const routeIds = v.routeIds.slice(0, -1);
  const headingIds = rankHeadings(
    v.pool,
    pickedMetasOf(v, routeIds),
    v.recVotes ?? {},
    new Set(routeIds),
    new Set(v.seen ?? []),
    3,
  );
  const nextSeen = [...new Set([...(v.seen ?? []), ...headingIds])];
  set({ active: { ...v, routeIds, headingIds, seen: nextSeen } });
  prefetchRelated(headingMetas(v, headingIds), key);
}

export function launchVoyage() {
  const v = state.active;
  if (!v || v.phase !== "building" || v.routeIds.length === 0) return;
  set({
    active: { ...v, phase: "sailing", headingIds: [], targetLength: v.routeIds.length },
    ...sailFields(),
  });
}

export function markPlayed(id: string) {
  const v = state.active;
  if (!v || v.playedIds.includes(id)) return;
  set({ active: { ...v, playedIds: [...v.playedIds, id] }, ...sailFields() });
}

export function voyageReady(v: Voyage): boolean {
  return v.phase === "building" && v.routeIds.length >= v.targetLength;
}

export function nextUnplayedId(v: Voyage): string | undefined {
  const partial = v.routeIds.find(
    (id) => !isVoyageWatched(id, metaById(v, id)) && voyageProgress(id, metaById(v, id)) > 0,
  );
  if (partial) return partial;
  return v.routeIds.find((id) => !isVoyageWatched(id, metaById(v, id)));
}

export function rerollHeadings(key = "") {
  const v = state.active;
  if (!v || v.phase !== "building") return;
  const used = new Set([...v.routeIds, ...v.headingIds]);
  const headingIds = rankHeadings(
    v.pool,
    pickedMetasOf(v, v.routeIds),
    v.recVotes ?? {},
    used,
    new Set(v.seen ?? []),
    3,
  );
  if (headingIds.length === 0) return;
  const nextSeen = [...new Set([...(v.seen ?? []), ...headingIds])];
  set({ active: { ...v, headingIds, seen: nextSeen } });
  prefetchRelated(headingMetas(v, headingIds), key);
}

export function endVoyage() {
  set({ active: null });
}

export function metaById(v: Voyage, id: string): Meta | undefined {
  return v.pool.find((m) => m.id === id);
}
