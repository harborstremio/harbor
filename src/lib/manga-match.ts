import { activeProfileId } from "@/lib/active-profile-id";
import type { MangaTracker } from "@/lib/manga/sync";

// Per-title -> tracker mangaId mapping, so a local title that matches the wrong
// tracker entry (e.g. "Revenge of the Iron-Blooded Sword Hound" bumping a
// differently-titled tracker series) can be pinned once and reused on later
// syncs. Stored per profile, per tracker, as a Record<normalizedTitle, entry>.
function storageKeyFor(tracker: MangaTracker, pid: string): string {
  return `harbor.manga.match.${tracker}.v2.${pid}`;
}

function legacyStorageKeyFor(tracker: MangaTracker, pid: string): string {
  return `harbor.manga.match.${tracker}.v1.${pid}`;
}

// A mapping entry. `confirmed` is true only when the user picked the entry in
// the manual match picker; auto-derived mappings are never stored, and legacy
// v1 entries migrate as unconfirmed so they are re-validated (a v1 wrong match
// like an auto-picked "Survival" for "Survivalism" is dropped, not re-trusted).
// `id === null` means the user deliberately dismissed the picker for this title
// on this tracker, so the runner skips it instead of re-prompting.
type MangaMatchEntry = { id: string | null; title?: string; confirmed: boolean };
function readMap(pid: string, tracker: MangaTracker): Record<string, MangaMatchEntry> {
  try {
    let raw = localStorage.getItem(storageKeyFor(tracker, pid));
    if (raw == null) {
      const legacy = localStorage.getItem(legacyStorageKeyFor(tracker, pid));
      if (legacy != null) {
        raw = migrateLegacy(legacy);
        localStorage.setItem(storageKeyFor(tracker, pid), raw);
        localStorage.removeItem(legacyStorageKeyFor(tracker, pid));
      } else {
        return {};
      }
    }
    const parsed = JSON.parse(raw) as Record<string, MangaMatchEntry>;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, MangaMatchEntry> = {};
    for (const key of Object.keys(parsed)) {
      const v = parsed[key];
      if (v && typeof v === "object" && "id" in v) {
        out[key] = { id: v.id ?? null, title: v.title, confirmed: v.confirmed === true };
      } else if (typeof v === "string") {
        out[key] = { id: v, confirmed: false };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function migrateLegacy(legacy: string): string {
  try {
    const parsed = JSON.parse(legacy) as Record<string, unknown>;
    const out: Record<string, MangaMatchEntry> = {};
    for (const key of Object.keys(parsed)) {
      const v = parsed[key];
      let id: string | null = null;
      if (typeof v === "string") id = v;
      else if (v && typeof v === "object" && "id" in (v as Record<string, unknown>)) {
        id = String((v as { id: unknown }).id);
      }
      if (id != null) out[key] = { id, confirmed: false };
    }
    return JSON.stringify(out);
  } catch {
    return "{}";
  }
}

export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function titleVariants(candidate: string, altTitles?: string[]): string[] {
  return [candidate, ...(altTitles ?? [])].filter((t): t is string => !!t).map(normalizeTitle);
}

// Decides whether a tracker search result is the same series as the local title
// we are trying to sync. Auto-match only pushes a result we are confident about;
// a wrong-but-first hit (e.g. "Survival" topping a search for "Survivalism")
// must not be silently synced. It passes on an exact normalized match against
// the primary or any alternate title (synonym / translated name), or when every
// meaningful word of the query appears in one of those titles.
export function isConfidentTitleMatch(query: string, candidate: string, altTitles?: string[]): boolean {
  const variants = titleVariants(candidate, altTitles);
  const qt = query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  if (qt.length === 0) return false;
  for (const v of variants) {
    const vq = normalizeTitle(v);
    if (vq === normalizeTitle(query)) return true;
    const vt = new Set(v.toLowerCase().split(/[^a-z0-9]+/));
    if (qt.every((w) => vt.has(w))) return true;
  }
  return false;
}

export function getMangaMatch(pid: string, tracker: MangaTracker, titleKey: string): string | null {
  return readMap(pid, tracker)[titleKey]?.id ?? null;
}

export function getMangaMatchTitle(
  pid: string,
  tracker: MangaTracker,
  titleKey: string,
): string | null {
  return readMap(pid, tracker)[titleKey]?.title ?? null;
}

export function getMangaMatchEntry(
  pid: string,
  tracker: MangaTracker,
  titleKey: string,
): { id: string | null; confirmed: boolean } | null {
  const e = readMap(pid, tracker)[titleKey];
  return e ? { id: e.id, confirmed: e.confirmed } : null;
}

export function setMangaMatch(
  pid: string,
  tracker: MangaTracker,
  titleKey: string,
  mangaId: string,
  title?: string,
  confirmed = true,
): void {
  try {
    const map = readMap(pid, tracker);
    map[titleKey] = { id: String(mangaId), title, confirmed };
    localStorage.setItem(storageKeyFor(tracker, pid), JSON.stringify(map));
  } catch {
    return;
  }
}

export function setMangaMatchDismissed(
  pid: string,
  tracker: MangaTracker,
  titleKey: string,
): void {
  try {
    const map = readMap(pid, tracker);
    map[titleKey] = { id: null, confirmed: true };
    localStorage.setItem(storageKeyFor(tracker, pid), JSON.stringify(map));
  } catch {
    return;
  }
}

// A "needs a manual match" request emitted by the sync runner when the manga
// that is currently being read has no saved mapping and cannot be pushed to a
// confident first search hit. The reader subscribes and opens the picker so the
// user can choose the correct tracker entry without leaving the chapter.
export type MangaMatchRequest = {
  tracker: MangaTracker;
  title: string;
  chapter: number;
};

const matchListeners = new Set<(req: MangaMatchRequest) => void>();

export function subscribeMangaMatchRequest(cb: (req: MangaMatchRequest) => void): () => void {
  matchListeners.add(cb);
  return () => {
    matchListeners.delete(cb);
  };
}

export function emitMangaMatchRequest(req: MangaMatchRequest): void {
  for (const cb of matchListeners) cb(req);
}

// Convenience for plain (non-hook) callers that resolve the active profile id.
export function getActiveMatch(tracker: MangaTracker, titleKey: string): string | null {
  return getMangaMatch(activeProfileId(), tracker, titleKey);
}
