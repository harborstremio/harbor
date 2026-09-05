import { useSyncExternalStore } from "react";
import { clearResume, readResumeEntry } from "./resume";
import { setItemWithRecovery } from "./storage-recovery";
import { episodeFromVideoId, type LibraryItem } from "./stremio";
import { cloudLibraryPut } from "./stremio-write-queue";

const SIMKL_KEY = "harbor.cw.dismissed.simkl";
const DISMISS_KEY = "harbor.cw.dismissed.v1";
const dismissed = new Map<string, number>();
const dismissedVid = new Map<string, string>();
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
            const vid = (v as { v?: unknown }).v;
            if (typeof vid === "string" && vid) dismissedVid.set(k, vid);
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
    const out: Record<string, number | { t: number; v: string }> = {};
    for (const [k, t] of dismissed) {
      const v = dismissedVid.get(k);
      out[k] = v ? { t, v } : t;
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

function itemActivity(item: LibraryItem): number {
  const t = Math.max(parseMs(item._mtime), parseMs(item.state?.lastWatched));
  if (t > 0) return t;
  const vid = item.state?.video_id ?? "";
  const kitsuThreeSeg = /^(kitsu|mal|anilist|anidb):/.test(item._id) && vid.split(":").length === 3;
  const se = kitsuThreeSeg ? null : episodeFromVideoId(item.state?.video_id);
  const entry = readResumeEntry(
    item._id,
    item.state?.season ?? (kitsuThreeSeg ? 1 : se?.season),
    item.state?.episode ?? (kitsuThreeSeg ? Number(vid.split(":")[2]) : se?.episode),
  );
  return entry?.t ?? 0;
}

export function isCwDismissed(item: LibraryItem): boolean {
  const plain = dismissed.get(item._id);
  const ext = item.external ? dismissed.get(`${item.external}|${item._id}`) : undefined;
  const dismissedAt = Math.max(plain ?? -1, ext ?? -1);
  if (dismissedAt < 0) return false;
  const vid = dismissedVid.get(item._id);
  const curVid = item.state?.video_id;
  if (vid && typeof curVid === "string" && curVid) return vid === curVid;
  const activity = itemActivity(item);
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
  if (item.external) {
    dismissed.set(`${item.external}|${id}`, nowMs);
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
