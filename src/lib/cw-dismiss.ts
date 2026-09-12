import { useSyncExternalStore } from "react";
import { clearResume, readResumeEntry } from "./resume";
import { setItemWithRecovery } from "./storage-recovery";
import { episodeFromVideoId, type LibraryItem } from "./stremio";
import { cloudLibraryPut } from "./stremio-write-queue";

const SIMKL_KEY = "harbor.cw.dismissed.simkl";
const DISMISS_KEY = "harbor.cw.dismissed.v1";
const dismissed = new Map<string, number>();
const dismissedVid = new Map<string, string>();
const dismissedPos = new Map<string, { s?: number; e?: number; p: number }>();
const listeners = new Set<() => void>();
let version = 0;

(() => {
  const loadNow = Date.now();
  const add = (k: string, ms: number) => {
    const prev = dismissed.get(k);
    if (prev == null || ms > prev) dismissed.set(k, ms);
  };
  let legacy = false;
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "null");
    if (Array.isArray(raw)) {
      for (const v of raw) if (typeof v === "string") add(v, loadNow);
      legacy = true;
    } else if (raw && typeof raw === "object") {
      for (const [k, v] of Object.entries(raw)) {
        if (typeof v === "number") {
          add(k, v);
        } else if (v && typeof v === "object") {
          const t = (v as { t?: unknown }).t;
          if (typeof t === "number") {
            add(k, t);
            const o = v as { v?: unknown; s?: unknown; e?: unknown; p?: unknown };
            if (typeof o.v === "string" && o.v) dismissedVid.set(k, o.v);
            if (typeof o.p === "number" && Number.isFinite(o.p)) {
              dismissedPos.set(k, {
                s: typeof o.s === "number" ? o.s : undefined,
                e: typeof o.e === "number" ? o.e : undefined,
                p: o.p,
              });
            }
          }
        }
      }
    }
  } catch {}
  try {
    const raw = JSON.parse(localStorage.getItem(SIMKL_KEY) ?? "[]");
    const arr = Array.isArray(raw) ? (raw as string[]) : [];
    for (const v of arr) {
      if (typeof v !== "string" || !v) continue;
      const key = v.startsWith("simkl|") ? v : `simkl|${v}`;
      if (!dismissed.has(key)) add(key, loadNow);
    }
    if (arr.length > 0) {
      localStorage.removeItem(SIMKL_KEY);
      legacy = true;
    }
  } catch {}
  if (legacy) persistDismissed();
})();

function persistDismissed(): void {
  try {
    const out: Record<
      string,
      number | { t: number; v?: string; s?: number; e?: number; p?: number }
    > = {};
    for (const [k, t] of dismissed) {
      const v = dismissedVid.get(k);
      const pos = dismissedPos.get(k);
      if (v || pos) {
        out[k] = { t };
        if (v) out[k].v = v;
        if (pos) {
          if (pos.s !== undefined) out[k].s = pos.s;
          if (pos.e !== undefined) out[k].e = pos.e;
          out[k].p = pos.p;
        }
      } else {
        out[k] = t;
      }
    }
    setItemWithRecovery(DISMISS_KEY, JSON.stringify(out));
  } catch {}
}

function emit(): void {
  version += 1;
  listeners.forEach((l) => l());
}

function parseMs(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const p = Date.parse(String(v ?? ""));
  return Number.isFinite(p) ? p : 0;
}

function resolveEpisode(item: LibraryItem): { season?: number; episode?: number } {
  const vid = item.state?.video_id ?? "";
  const kitsuThreeSeg = /^(kitsu|mal|anilist|anidb):/.test(item._id) && vid.split(":").length === 3;
  const se = kitsuThreeSeg ? null : episodeFromVideoId(item.state?.video_id);
  return {
    season: item.state?.season ?? (kitsuThreeSeg ? 1 : se?.season),
    episode: item.state?.episode ?? (kitsuThreeSeg ? Number(vid.split(":")[2]) : se?.episode),
  };
}

function itemActivity(item: LibraryItem): number {
  const t = Math.max(parseMs(item._mtime), parseMs(item.state?.lastWatched));
  const { season, episode } = resolveEpisode(item);
  const entry = readResumeEntry(item._id, season, episode);
  // Harbor's own resume (and external playback imports) write `harbor.resume` with
  // t=Date.now() without touching the Stremio cloud _mtime, so it must join the max
  // instead of being a fallback. Otherwise a same-episode resume after dismiss keeps
  // returning the dismissal-time _mtime and never un-dismisses.
  return Math.max(t, entry?.t ?? 0);
}

function progressRatio(item: LibraryItem): number {
  const duration = item.state?.duration ?? 0;
  if (!(duration > 0)) return 0;
  const { season, episode } = resolveEpisode(item);
  const resumeMs = readResumeEntry(item._id, season, episode)?.ms ?? 0;
  return Math.min(1, Math.max(item.state?.timeOffset ?? 0, resumeMs) / duration);
}

export function isCwDismissed(item: LibraryItem): boolean {
  const plain = dismissed.get(item._id);
  const ext = item.external ? dismissed.get(`${item.external}|${item._id}`) : undefined;
  const dismissedAt = Math.max(plain ?? -1, ext ?? -1);
  if (dismissedAt < 0) return false;
  // Newer progress from any source (Harbor resume, Stremio cloud _mtime/lastWatched,
  // Trakt paused_at, Simkl watched_at) un-dismisses even when the video_id is unchanged.
  const activity = itemActivity(item);
  if (activity > dismissedAt) return false;
  const vid = dismissedVid.get(item._id);
  const curVid = item.state?.video_id;
  const pos = dismissedPos.get(item._id);
  // Further-ahead position on the same episode un-dismisses even when its timestamp
  // predates the dismissal (e.g. dismissed after watching elsewhere).
  if (pos != null && progressRatio(item) > pos.p + 0.01) {
    if (vid && typeof curVid === "string" && curVid) {
      if (vid === curVid) return false;
    } else {
      const { season, episode } = resolveEpisode(item);
      if (season === pos.s && episode === pos.e) return false;
    }
  }
  if (vid && typeof curVid === "string" && curVid) {
    if (vid !== curVid) return false;
  } else if (pos != null) {
    const { season, episode } = resolveEpisode(item);
    if (season !== pos.s || episode !== pos.e) return false;
  }
  if (activity > 0) return activity <= dismissedAt;
  return true;
}

export function dismissCw(item: LibraryItem, authKey: string | null): void {
  const id = item._id;
  const now = new Date().toISOString();
  const nowMs = Date.parse(now);
  dismissed.set(id, nowMs);
  const dismissVid = item.state?.video_id;
  if (typeof dismissVid === "string" && dismissVid) dismissedVid.set(id, dismissVid);
  else dismissedVid.delete(id);
  if (item.state) {
    const { season, episode } = resolveEpisode(item);
    dismissedPos.set(id, { s: season, e: episode, p: progressRatio(item) });
  } else {
    dismissedPos.delete(id);
  }
  if (item.external) {
    dismissed.set(`${item.external}|${id}`, nowMs);
    const { season, episode } = resolveEpisode(item);
    clearResume(id, season, episode);
    persistDismissed();
    emit();
    return;
  }
  persistDismissed();
  emit();
  if (!authKey || !item.state) return;
  const vid = item.state.video_id ?? "";
  const kitsuThreeSeg =
    /^(kitsu|mal|anilist|anidb):/.test(id) && vid.split(":").length === 3;
  const se = kitsuThreeSeg ? null : episodeFromVideoId(item.state.video_id);
  clearResume(
    id,
    item.state.season ?? (kitsuThreeSeg ? 1 : se?.season),
    item.state.episode ?? (kitsuThreeSeg ? Number(vid.split(":")[2]) : se?.episode),
  );
  void cloudLibraryPut(authKey, {
    ...item,
    state: { ...item.state, timeOffset: 0 },
    _mtime: now,
  });
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useCwDismissVersion(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  );
}
