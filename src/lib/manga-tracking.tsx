import { useEffect } from "react";
import {
  listMangaProgress,
  subscribeMangaProgress,
  type MangaProgressEntry,
} from "@/lib/manga-progress";
import {
  anilistMangaAuthed,
  pushAnilistManga,
  type MangaPushOutcome,
} from "@/lib/manga/tracking-anilist";
import { malMangaAuthed, pushMalManga } from "@/lib/manga/tracking-mal";
import { emitMangaSync, type MangaPushResult, type MangaTracker } from "@/lib/manga/sync";
import {
  getMangaMatchEntry,
  getMangaMatchTitle,
  normalizeTitle,
} from "@/lib/manga-match";
import { getMangaReading, subscribeMangaReading } from "@/lib/manga-reading-state";
import { useProfiles } from "@/lib/profiles";

const pushed: Record<MangaTracker, Map<string, number>> = {
  anilist: new Map(),
  mal: new Map(),
};
const inflight = new Set<string>();

// Bound the whole push so a tracker that hangs (e.g. an unreachable host that
// never rejects its request) still resolves and clears the "Syncing" toast
// instead of spinning forever. A time-out is surfaced as an unreachable error.
const PUSH_TIMEOUT_MS = 20_000;

function withPushTimeout(p: Promise<MangaPushOutcome>): Promise<MangaPushOutcome> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ result: "error", id: null }), PUSH_TIMEOUT_MS);
    p.then(
      (r) => {
        clearTimeout(timer);
        resolve(r);
      },
      () => {
        clearTimeout(timer);
        resolve({ result: "error", id: null });
      },
    );
  });
}

function chapterValue(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
}

function titleKeyOf(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * A chapter is a sync candidate once the reader has actually read most of it
 * (~80%, mirroring the app's anime "watched" threshold). Merely starting a
 * chapter is not enough; backwards/no-op pushes are filtered inside the push
 * modules (remote-behind) based on the tracker's recorded progress.
 */
function candidateChapter(entry: MangaProgressEntry): number | null {
  const cur = chapterValue(entry.chapterNumber);
  if (cur == null) return null;
  if (entry.totalPages <= 0) return cur;
  return entry.page / entry.totalPages >= 0.8 ? cur : null;
}

async function pushOne(
  tracker: MangaTracker,
  entry: MangaProgressEntry,
  chapter: number,
  pid: string,
  explicitId?: string,
): Promise<MangaPushResult | null> {
  const flight = `${tracker}:${entry.id}:${chapter}`;
  if (inflight.has(flight)) return null;
  inflight.add(flight);
  // Toast the tracker entry the user pinned (if any) rather than the local
  // title, so an explicit repair pick is reflected back even when the local
  // title names a different work.
  const displayTitle = getMangaMatchTitle(pid, tracker, titleKeyOf(entry.title)) ?? entry.title;
  emitMangaSync(tracker, { kind: "syncing", title: displayTitle, chapter });
  const outcome = await withPushTimeout(
    tracker === "anilist"
      ? pushAnilistManga(entry.title, chapter, explicitId)
      : pushMalManga(entry.title, chapter, explicitId),
  );
  // Auto-matched mappings are intentionally not persisted. Only the user's
  // explicit picks from the manual match picker are stored (as confirmed), so a
  // wrong auto-match can never become a sticky mapping that is reused forever.
  // Record the attempt for this chapter on every outcome so a title that
  // cannot be matched (or a transient failure) is not retried on every page
  // turn within the same session.
  pushed[tracker].set(entry.id, chapter);
  if (outcome.result === "synced" || outcome.result === "noop") {
    // Emit ok for "noop" too (tracker already has this chapter) so a "syncing"
    // toast for an already-synced chapter is not left hanging with no terminal event.
    emitMangaSync(tracker, { kind: "ok", title: displayTitle, chapter });
  } else if (outcome.result === "title-miss") {
    emitMangaSync(tracker, {
      kind: "error",
      title: displayTitle,
      error: "title-miss",
    });
  } else if (outcome.result === "error") {
    emitMangaSync(tracker, {
      kind: "error",
      title: displayTitle,
      error: "unreachable",
    });
  }
  inflight.delete(flight);
  return outcome.result;
}

// Only the manga currently open in the reader is allowed to trigger the manual
// match picker on first sync. Backlog progress entries (everything synced on
// app start or while browsing) are not a match target, so a freshly added
// tracker does not pop a picker for every partially-read title at once.
function isReading(entry: MangaProgressEntry): boolean {
  const reading = getMangaReading();
  if (!reading || !reading.title) return false;
  return normalizeTitle(reading.title) === normalizeTitle(entry.title);
}

function run(pid: string): void {
  const anilistOn = anilistMangaAuthed();
  const malOn = malMangaAuthed();
  if (!anilistOn && !malOn) return;
  const upcoming = [
    anilistOn ? ("anilist" as const) : null,
    malOn ? ("mal" as const) : null,
  ].filter((t): t is MangaTracker => t !== null);
  for (const entry of listMangaProgress(pid)) {
    if (!entry.title || !isReading(entry)) continue;
    const chapter = candidateChapter(entry);
    if (chapter == null) continue;
    const titleKey = titleKeyOf(entry.title);
    for (const tracker of upcoming) {
      if (chapter <= (pushed[tracker].get(entry.id) ?? 0)) continue;
      const map = getMangaMatchEntry(pid, tracker, titleKey);
      if (map && map.id == null) continue; // dismissed, do not re-prompt
      if (map && map.confirmed && map.id != null) {
        void pushOne(tracker, entry, chapter, pid, map.id);
      }
    }
  }
}

export function MangaTrackingRunner() {
  const { activeId } = useProfiles();
  useEffect(() => {
    const pid = activeId ?? "default";
    pushed.anilist.clear();
    pushed.mal.clear();
    inflight.clear();
    const tick = () => run(pid);
    tick();
    const offProgress = subscribeMangaProgress(tick);
    // Re-evaluate as soon as a manga starts being read, so the sync runner can
    // push confirmed picks for the chapter being opened.
    const offReading = subscribeMangaReading(tick);
    return () => {
      offProgress();
      offReading();
    };
  }, [activeId]);
  return null;
}
