import { activeProfileId } from "@/lib/active-profile-id";

import { malRequest, MalApiError } from "./client";
import { resolveMalMediaId } from "./mutations";
import { isAuthenticated } from "./session";

export type SyncEvent =
  | { kind: "syncing"; title: string; episode: number }
  | { kind: "ok"; title: string; episode: number }
  | { kind: "watching"; title: string }
  | { kind: "error"; title: string; message: string };

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
    const cur = await malRequest<EntryResponse>(`/anime/${malId}?fields=my_list_status`);
    if (cur?.my_list_status && cur.my_list_status.status !== "plan_to_watch") return;
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

export async function syncMalProgress(harborId: string, episode: number | undefined, title: string): Promise<void> {
  if (!isAuthenticated()) return;
  const ep = episode ?? 1;
  if (!Number.isFinite(ep) || ep < 1) return;

  const sent = loadSent();
  if ((sent[harborId] ?? 0) >= ep) return;

  const flightKey = `${harborId}|${ep}`;
  if (inflight.has(flightKey)) return;
  inflight.add(flightKey);

  try {
    const malId = await resolveMalMediaId(harborId);
    if (malId == null) return;

    const cur = await malRequest<EntryResponse>(`/anime/${malId}?fields=num_episodes,my_list_status`);

    const current = cur?.my_list_status?.num_episodes_watched ?? 0;
    if (ep <= current) {
      sent[harborId] = current;
      saveSent(sent);
      return;
    }

    const total = cur?.num_episodes ?? 0;
    const status = total > 0 && ep >= total ? "completed" : "watching";
    emit({ kind: "syncing", title, episode: ep });

    const saved = await malRequest<{ num_episodes_watched: number }>(`/anime/${malId}/my_list_status`, {
      method: "PATCH",
      body: new URLSearchParams({
        num_watched_episodes: String(ep),
        status,
      }),
    });

    if (saved?.num_episodes_watched === ep) {
      sent[harborId] = ep;
      saveSent(sent);
      emit({ kind: "ok", title, episode: ep });
    } else {
      emit({ kind: "error", title, message: "MAL did not confirm the update." });
    }
  } catch (e) {
    if (e instanceof MalApiError && e.status === 401) return;
    emit({ kind: "error", title, message: "Couldn't reach MyAnimeList." });
  } finally {
    inflight.delete(flightKey);
  }
}
