import { useEffect, useSyncExternalStore } from "react";
import { getSession as getAnilistSession, subscribeSession as subscribeAnilistSession } from "@/lib/anilist/session";
import { getSession as getMalSession, subscribeSession as subscribeMalSession } from "@/lib/mal/session";
import { loadEffective } from "@/lib/settings/profile-store";
import { getSession as getSimklSession, subscribeSession as subscribeSimklSession } from "@/lib/simkl/session";
import { getSession as getTraktSession, subscribeSession as subscribeTraktSession } from "@/lib/trakt/session";
import type { LibraryItem } from "@/lib/stremio";
import { fetchAnilistAnimeProgress } from "./adapters/anilist";
import { fetchMalAnimeProgress } from "./adapters/mal";
import { fetchSimklAnimeProgress } from "./adapters/simkl";
import { fetchTraktAnimeProgress } from "./adapters/trakt";
import { buildCatalogForCandidate } from "./catalog";
import { expandMappedIds, memoizeMapping, resolveCandidates } from "./id-resolve";
import type { EpisodeCatalog } from "./normalize";
import {
  groupProgress,
  planGroup,
  type MergedGroup,
} from "./plan";
import { sortImported } from "./to-cw";
import type {
  AnimeProgressConflict,
  NormalizedAnimeProgress,
} from "./types";

const STALE_MS = 300_000;
// Shorter than STALE_MS so returning to the window picks up tracker-side
// changes quickly; uniform with the trakt/simkl feed in feed/external-cw.ts.
const FOCUS_STALE_MS = 30_000;
const RETRY_DELAYS_MS = [1000, 4000, 10000];
const EMPTY: LibraryItem[] = [];
const MAX_GROUPS_PER_REFRESH = 30;
const PERSIST_KEY = "harbor.animecw.items.v1";

let items: LibraryItem[] = loadPersistedItems();
let fetchedAt = 0;
let inflight: Promise<void> | null = null;
let conflicts: AnimeProgressConflict[] = [];
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;
let refreshGen = 0;
const subs = new Set<() => void>();

function loadPersistedItems(): LibraryItem[] {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LibraryItem[]) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function persistItems(next: LibraryItem[]): void {
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / serialization errors
  }
}

export type AnimeCwSources = { trakt: boolean; simkl: boolean; mal: boolean; anilist: boolean };

let sourceMask: AnimeCwSources = { trakt: false, simkl: false, mal: false, anilist: false };
let includeSpecials = false;

function emit(): void {
  for (const fn of subs) fn();
}

function setItems(next: LibraryItem[]): void {
  if (next.length === 0 && items.length === 0) return;
  items = next;
  persistItems(next);
  emit();
}

export function animeCwConnected(): boolean {
  return (
    (sourceMask.trakt && !!getTraktSession()) ||
    (sourceMask.simkl && !!getSimklSession()) ||
    (sourceMask.mal && !!getMalSession()) ||
    (sourceMask.anilist && !!getAnilistSession())
  );
}

export function setAnimeCwSources(mask: AnimeCwSources): void {
  if (
    mask.trakt === sourceMask.trakt &&
    mask.simkl === sourceMask.simkl &&
    mask.mal === sourceMask.mal &&
    mask.anilist === sourceMask.anilist
  ) {
    return;
  }
  sourceMask = { ...mask };
  fetchedAt = 0;
  if (!animeCwConnected()) setItems(EMPTY);
  void refreshAnimeCw(true);
}

function activeSettings(): ReturnType<typeof loadEffective> {
  try {
    const raw = localStorage.getItem("harbor.profiles.v1");
    if (!raw) return loadEffective("default", true);
    const s = JSON.parse(raw) as {
      profiles?: Array<{ id: string; settingsLinked?: boolean }>;
      activeId?: string | null;
    };
    const id = s.activeId || "default";
    const p = s.profiles?.find((x) => x.id === id);
    return loadEffective(id, p?.settingsLinked !== false);
  } catch {
    return loadEffective("default", true);
  }
}

async function runPipeline(): Promise<{
  items: LibraryItem[];
  conflicts: AnimeProgressConflict[];
  ok: boolean;
}> {
  const skipped = Promise.resolve({
    attempted: false,
    ok: true,
    v: [] as NormalizedAnimeProgress[],
  });
  const lists = await Promise.all([
    sourceMask.trakt && !!getTraktSession()
      ? fetchTraktAnimeProgress().then(
          (v) => ({ attempted: true, ok: true, v }),
          () => ({ attempted: true, ok: false, v: [] as NormalizedAnimeProgress[] }),
        )
      : skipped,
    sourceMask.simkl && !!getSimklSession()
      ? fetchSimklAnimeProgress().then(
          (v) => ({ attempted: true, ok: true, v }),
          () => ({ attempted: true, ok: false, v: [] as NormalizedAnimeProgress[] }),
        )
      : skipped,
    sourceMask.mal && !!getMalSession()
      ? fetchMalAnimeProgress().then(
          (v) => ({ attempted: true, ok: true, v }),
          () => ({ attempted: true, ok: false, v: [] as NormalizedAnimeProgress[] }),
        )
      : skipped,
    sourceMask.anilist && !!getAnilistSession()
      ? fetchAnilistAnimeProgress().then(
          (v) => ({ attempted: true, ok: true, v }),
          () => ({ attempted: true, ok: false, v: [] as NormalizedAnimeProgress[] }),
        )
      : skipped,
  ]);
  const flat = lists.flatMap((r) => r.v);
  // Uniform with the trakt/simkl feed: the refresh only counts as failed when
  // no enabled source succeeded, so one healthy tracker still populates the row.
  const ok = lists.some((r) => r.attempted && r.ok);
  if (flat.length === 0) return { items: [], conflicts: [], ok };
  const groups = groupProgress(flat);
  groups.sort((a, b) => {
    const last = (g: MergedGroup) => {
      let best = 0;
      for (const e of g.entries) {
        const t = e.updatedAt ? Date.parse(e.updatedAt) : NaN;
        if (Number.isFinite(t) && t > best) best = t;
      }
      return best;
    };
    return last(b) - last(a);
  });
  const tmdbKey = activeSettings().tmdbKey;
  const out: LibraryItem[] = [];
  const foundConflicts: AnimeProgressConflict[] = [];
  const seen = new Set<string>();
  for (const g of groups.slice(0, MAX_GROUPS_PER_REFRESH)) {
    const first = g.entries[0];
    const memoized = resolveCandidates(first);
    const candidates: string[] = memoized.ok ? [...memoized.candidates] : [];
    let catalog: EpisodeCatalog | null = null;
    let metaId: string | null = null;
    const tryCandidates = async (list: string[]): Promise<boolean> => {
      for (const candidate of list) {
        const c = await buildCatalogForCandidate(candidate, g.title, undefined, tmdbKey).catch(
          () => null,
        );
        if (c) {
          catalog = c;
          metaId = candidate;
          void memoizeMapping(first, [candidate]);
          return true;
        }
      }
      return false;
    };
    if (candidates.length > 0) await tryCandidates(candidates);
    if (catalog == null) {
      // Sources that only report a MAL id (MAL itself) still need the shared-id
      // expansion before an episode list can be resolved, exactly like an entry
      // with no direct Stremio candidate.
      const expanded = await expandMappedIds(first).catch(() => [] as string[]);
      const extra = expanded.filter((id) => !candidates.includes(id));
      if (extra.length > 0) await tryCandidates(extra);
    }
    const decision = planGroup(g, catalog, { metaId, includeSpecials });
    if (decision.kind === "entry") {
      const key = `${decision.item._id}|${decision.item.state?.season ?? 0}|${decision.item.state?.episode ?? 0}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(decision.item);
      }
    } else if (decision.kind === "conflict") {
      foundConflicts.push({
        key: g.key,
        titles: first.titles,
        sources: [...new Set(g.entries.map((e) => e.source))],
        detail: decision.detail,
      });
    }
  }
  return { items: sortImported(out), conflicts: foundConflicts, ok: true };
}

function cancelRetry(): void {
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  retryAttempt = 0;
}

// Runs the pipeline once and applies the result. Returns false on total
// failure and leaves the stored items untouched, so the retry ladder or the
// next refresh can recover instead of wiping the row on a transient error.
async function runPipelineOnce(): Promise<boolean> {
  const { items: next, conflicts: nextConflicts, ok } = await runPipeline();
  if (!ok) return false;
  fetchedAt = Date.now();
  conflicts = nextConflicts;
  setItems(next);
  return true;
}

// After a total failure, retry at 1s/4s/10s so a cold start with a dead network
// self-heals once connectivity returns instead of caching the failure for STALE_MS.
function scheduleRetry(): void {
  if (retryTimer !== null) return;
  if (retryAttempt >= RETRY_DELAYS_MS.length) return;
  const gen = refreshGen;
  const delay = RETRY_DELAYS_MS[retryAttempt];
  retryAttempt += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void (async () => {
      try {
        const ok = await runPipelineOnce();
        // A newer refresh supersedes this retry; let it own the outcome.
        if (gen !== refreshGen) return;
        if (!ok) scheduleRetry();
      } catch {
        if (gen !== refreshGen) return;
        scheduleRetry();
      }
    })();
  }, delay);
}

export function refreshAnimeCw(force = false): Promise<void> {
  refreshGen += 1;
  cancelRetry();
  if (!animeCwConnected()) {
    fetchedAt = 0;
    setItems(EMPTY);
    conflicts = [];
    return Promise.resolve();
  }
  if (inflight) return force ? inflight.then(() => refreshAnimeCw(true)) : inflight;
  if (!force && fetchedAt > 0 && Date.now() - fetchedAt < STALE_MS) return Promise.resolve();
  inflight = (async () => {
    const ok = await runPipelineOnce();
    if (!ok) scheduleRetry();
  })()
    .catch(() => {
      // Unexpected pipeline error: keep the previous items and let the ladder retry.
      scheduleRetry();
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function listAnimeCw(): LibraryItem[] {
  return items;
}

export function listAnimeCwConflicts(): AnimeProgressConflict[] {
  return conflicts;
}

export function subscribeAnimeCw(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

function connSignature(): string {
  const t = sourceMask.trakt && getTraktSession() ? "t" : "-";
  const s = sourceMask.simkl && getSimklSession() ? "s" : "-";
  const m = sourceMask.mal && getMalSession() ? "m" : "-";
  const a = sourceMask.anilist && getAnilistSession() ? "a" : "-";
  return `${t}${s}${m}${a}`;
}

let lastConn = "";

function onSessionChange(): void {
  const sig = connSignature();
  if (sig === lastConn) return;
  lastConn = sig;
  fetchedAt = 0;
  if (!animeCwConnected()) setItems(EMPTY);
  void refreshAnimeCw(true);
}

function onProfileChange(): void {
  lastConn = "";
  fetchedAt = 0;
  setItems(EMPTY);
  void refreshAnimeCw(true);
}

if (typeof window !== "undefined") {
  subscribeTraktSession(onSessionChange);
  subscribeSimklSession(onSessionChange);
  subscribeMalSession(onSessionChange);
  subscribeAnilistSession(onSessionChange);
  window.addEventListener("harbor:active-profile-changed", onProfileChange);
  window.addEventListener("harbor:profiles-updated", onProfileChange);
}

export function useExternalAnimeCw(
  enabled = true,
  opts: { includeSpecials?: boolean } = {},
): LibraryItem[] {
  const snapshot = useSyncExternalStore(subscribeAnimeCw, listAnimeCw, listAnimeCw);
  useEffect(() => {
    includeSpecials = opts.includeSpecials === true;
  }, [opts.includeSpecials]);
  useEffect(() => {
    if (!enabled) return;
    lastConn = connSignature();
    void refreshAnimeCw();
    const onFocus = (): void => {
      if (Date.now() - fetchedAt > FOCUS_STALE_MS) void refreshAnimeCw(true);
      else void refreshAnimeCw();
    };
    const onVisible = (): void => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - fetchedAt > FOCUS_STALE_MS) void refreshAnimeCw(true);
      else void refreshAnimeCw();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);
  return enabled ? snapshot : EMPTY;
}