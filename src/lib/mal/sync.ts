import { activeProfileId } from "@/lib/active-profile-id";
import { malRequest, MalApiError } from "./client";
import { resolveMalMediaId } from "./mutations";
import { isAuthenticated } from "./session";

export type SyncError = "update-not-confirmed" | "unreachable";

export type SyncEvent =
  | { kind: "syncing"; title: string; episode: number }
  | { kind: "ok"; title: string; episode: number }
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

type EntryResponse = {
  num_episodes: number | null;
  my_list_status: { num_episodes_watched: number; status: string } | null;
};

type SaveResponse = {
  num_episodes_watched: number;
  status: string;
};

const inflight = new Set<string>();
const watchingMarked = new Set<string>();

export function resetForProfile(): void {
  inflight.clear();
  watchingMarked.clear();
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
): Promise<void> {
  if (!isAuthenticated()) return;
  const ep = episode ?? 1;
  if (!Number.isFinite(ep) || ep < 1) return;
  const abs =
    absoluteEpisode != null && Number.isFinite(absoluteEpisode) && absoluteEpisode > ep
      ? absoluteEpisode
      : null;

  const sent = loadSent();
  if ((sent[harborId] ?? 0) >= (abs ?? ep)) return;

  const flightKey = `${harborId}|${ep}|${abs ?? ""}`;
  if (inflight.has(flightKey)) return;
  inflight.add(flightKey);

  try {
    const malId = await resolveMalMediaId(harborId);
    if (malId == null) return;

    const cur = await malRequest<EntryResponse>(
      `/anime/${malId}?fields=num_episodes,my_list_status`,
    );

    const current = cur?.my_list_status?.num_episodes_watched ?? 0;
    const total = cur?.num_episodes ?? 0;
    let target = ep;
    if (abs != null && total > 0 && abs <= total && ep <= current && abs > current) target = abs;
    if (total > 0 && target > total) {
      if (target > total + 1) return;
      target = total;
    }
    if (target <= current) {
      sent[harborId] = Math.max(sent[harborId] ?? 0, current);
      saveSent(sent);
      return;
    }

    const status = total > 0 && target >= total ? "completed" : "watching";
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
      sent[harborId] = target;
      saveSent(sent);
      emit({ kind: "ok", title, episode: target });
    } else {
      sent[harborId] = Math.max(sent[harborId] ?? 0, target);
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
