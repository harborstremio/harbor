import { activeProfileId } from "@/lib/active-profile-id";
import { malRequest, MalApiError } from "./client";
import { resolveMalMediaId } from "./mutations";
import { isAuthenticated } from "./session";

export type SyncError = "update-not-confirmed" | "unreachable";

export type SyncEvent =
  | { kind: "syncing"; title: string; episode: number; rewatch?: boolean }
  | { kind: "ok"; title: string; episode: number; rewatch?: boolean }
  | { kind: "watching"; title: string }
  | { kind: "error"; title: string; error: SyncError };

const listeners = new Set<(e: SyncEvent) => void>();
let last: SyncEvent | null = null;

export function subscribeSync(fn: (e: SyncEvent) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getLastSync(): SyncEvent | null {
  return last;
}

function emit(e: SyncEvent): void {
  last = e;
  for (const fn of listeners) fn(e);
}

const SENT_KEY_BASE = "harbor.mal.synced.v1";
function sentKey(): string {
  return `${SENT_KEY_BASE}.${activeProfileId()}`;
}
type SentMap = Record<string, number>;

function loadSent(): SentMap {
  try {
    return JSON.parse(localStorage.getItem(sentKey()) ?? "{}") as SentMap;
  } catch {
    return {};
  }
}

function saveSent(map: SentMap): void {
  try {
    localStorage.setItem(sentKey(), JSON.stringify(map));
  } catch {
    return;
  }
}

// Titles that have ever been completed/rewatching. The `sent` map is keyed by
// episode, so it cannot tell a first watch from a rewatch — once a title is known
// to be finished, the per-episode fast-path steps aside so a second pass over an
// already-pinned episode is not skipped forever.
const REWATCH_KEY_BASE = "harbor.mal.rewatch.v1";
function rewatchKey(): string {
  return `${REWATCH_KEY_BASE}.${activeProfileId()}`;
}
type RewatchMap = Record<string, true>;

function loadRewatch(): RewatchMap {
  try {
    return JSON.parse(localStorage.getItem(rewatchKey()) ?? "{}") as RewatchMap;
  } catch {
    return {};
  }
}

function saveRewatch(map: RewatchMap): void {
  try {
    localStorage.setItem(rewatchKey(), JSON.stringify(map));
  } catch {
    return;
  }
}

type EntryResponse = {
  num_episodes: number | null;
  my_list_status: {
    num_episodes_watched: number;
    status: string;
    is_rewatching: boolean;
    num_times_rewatched: number;
  } | null;
};

type SaveResponse = {
  num_episodes_watched: number;
  status: string;
};

const inflight = new Set<string>();
const watchingMarked = new Set<string>();
// A rewatch we just finished keeps its finale emitting progress events; without
// this the next tick would read completed and start the rewatch all over again.
const rewatchCompleted = new Map<string, number>();

export function resetForProfile(): void {
  inflight.clear();
  watchingMarked.clear();
  rewatchCompleted.clear();
}

export async function markMalWatching(harborId: string, title: string): Promise<void> {
  if (!isAuthenticated()) return;
  if (watchingMarked.has(harborId)) return;
  watchingMarked.add(harborId);
  try {
    const malId = await resolveMalMediaId(harborId);
    if (malId == null) {
      watchingMarked.delete(harborId);
      return;
    }
    const cur = await malRequest<EntryResponse>(
      `/anime/${malId}?fields=num_episodes,my_list_status`,
    );
    if (cur?.my_list_status && cur.my_list_status.status !== "plan_to_watch") return;
    const total = cur?.num_episodes ?? 0;
    if (cur?.my_list_status && total > 0 && cur.my_list_status.num_episodes_watched >= total)
      return;
    await malRequest<SaveResponse>(`/anime/${malId}/my_list_status`, {
      method: "PATCH",
      body: new URLSearchParams({ status: "watching" }),
    });
    emit({ kind: "watching", title });
  } catch (e) {
    watchingMarked.delete(harborId);
    if (e instanceof MalApiError && e.status === 401) return;
  }
}

export async function syncMalProgress(
  harborId: string,
  episode: number | undefined,
  title: string,
  absoluteEpisode?: number,
  season?: number,
  countRewatches = true,
): Promise<void> {
  if (!isAuthenticated()) return;
  const ep = episode ?? 1;
  if (!Number.isFinite(ep) || ep < 1) return;
  const abs =
    absoluteEpisode != null && Number.isFinite(absoluteEpisode) && absoluteEpisode > ep
      ? absoluteEpisode
      : null;

  const sent = loadSent();
  const sentKey = `${harborId}|${season ?? ""}|${ep}`;
  const rewatch = loadRewatch();
  // Finished/rewatching titles skip the per-episode fast-path (see RewatchMap).
  if (rewatch[harborId] !== true && (sent[sentKey] ?? 0) >= (abs ?? ep)) return;

  const flightKey = `${harborId}|${ep}|${abs ?? ""}`;
  if (inflight.has(flightKey)) return;
  inflight.add(flightKey);

  try {
    const malId = await resolveMalMediaId(harborId);
    if (malId == null) return;

    const cur = await malRequest<EntryResponse>(
      `/anime/${malId}?fields=num_episodes,my_list_status`,
    );

    const listStatus = cur?.my_list_status;
    const current = listStatus?.num_episodes_watched ?? 0;
    const total = cur?.num_episodes ?? 0;

    // The user already finished (or is rewatching) this title. A plain watching
    // push would drop it back to "watching" and overwrite the progress, so keep
    // the rewatch flag set and only move the rewatch counter forward.
    if (listStatus && (listStatus.status === "completed" || listStatus.is_rewatching)) {
      // Rewatch recording is off: leave the finished entry exactly as the user
      // set it, the way the sync behaved before rewatches were supported.
      if (!countRewatches) return;
      if (rewatch[harborId] !== true) {
        rewatch[harborId] = true;
        saveRewatch(rewatch);
      }
      let target = ep;
      if (abs != null && (total === 0 || abs <= total) && abs > target) target = abs;
      if (total > 0 && target > total) {
        if (target > total + 1) return;
        target = total;
      }
      // The finale of a rewatch we just finished keeps emitting progress; without
      // this the next tick would read completed and start the rewatch over.
      const completedEp = rewatchCompleted.get(harborId);
      if (completedEp != null && listStatus.status === "completed" && ep >= completedEp) return;

      // Watching the finale while rewatching finishes the pass. MAL counts a
      // finished rewatch as completed with `num_times_rewatched` bumped, and the
      // counter is a plain field — completing alone does not increment it.
      if (listStatus.is_rewatching && total > 0 && target >= total) {
        const timesRewatched = (listStatus.num_times_rewatched ?? 0) + 1;
        emit({ kind: "syncing", title, episode: total, rewatch: true });
        const saved = await malRequest<SaveResponse>(`/anime/${malId}/my_list_status`, {
          method: "PATCH",
          body: new URLSearchParams({
            num_watched_episodes: String(total),
            status: "completed",
            is_rewatching: "false",
            num_times_rewatched: String(timesRewatched),
          }),
        });
        if (saved?.num_episodes_watched === total) {
          rewatchCompleted.set(harborId, ep);
          emit({ kind: "ok", title, episode: total, rewatch: true });
        } else {
          emit({ kind: "error", title, error: "update-not-confirmed" });
        }
        return;
      }

      // Starting a rewatch ignores the completed progress; continuing one is
      // forward-only, where equal is not backwards. A new pass clears the guard.
      if (listStatus.is_rewatching && target <= current) return;
      rewatchCompleted.delete(harborId);
      emit({ kind: "syncing", title, episode: target, rewatch: true });
      const saved = await malRequest<SaveResponse>(`/anime/${malId}/my_list_status`, {
        method: "PATCH",
        body: new URLSearchParams({
          num_watched_episodes: String(target),
          status: "watching",
          is_rewatching: "true",
        }),
      });
      if (saved?.num_episodes_watched === target) {
        emit({ kind: "ok", title, episode: target, rewatch: true });
      } else {
        emit({ kind: "error", title, error: "update-not-confirmed" });
      }
      return;
    }

    let target = ep;
    if (abs != null && total > 0 && abs <= total && ep <= current && abs > current) target = abs;
    if (total > 0 && target > total) {
      if (target > total + 1) return;
      target = total;
    }
    if (target <= current) {
      sent[sentKey] = Math.max(sent[sentKey] ?? 0, current);
      saveSent(sent);
      return;
    }

    const status = total > 0 && target >= total ? "completed" : "watching";
    // Mark the title finished so a later rewatch is not swallowed by this
    // episode's first-watch entry in the fast-path above.
    if (status === "completed") {
      rewatch[harborId] = true;
      saveRewatch(rewatch);
    }
    emit({ kind: "syncing", title, episode: target });

    const saved = await malRequest<{ num_episodes_watched: number }>(
      `/anime/${malId}/my_list_status`,
      {
        method: "PATCH",
        body: new URLSearchParams({
          num_watched_episodes: String(target),
          status,
        }),
      },
    );

    if (saved?.num_episodes_watched === target) {
      sent[sentKey] = target;
      saveSent(sent);
      emit({ kind: "ok", title, episode: target });
    } else {
      sent[sentKey] = Math.max(sent[sentKey] ?? 0, target);
      saveSent(sent);
      emit({ kind: "error", title, error: "update-not-confirmed" });
    }
  } catch (e) {
    if (e instanceof MalApiError && e.status === 401) return;
    emit({ kind: "error", title, error: "unreachable" });
  } finally {
    inflight.delete(flightKey);
  }
}
