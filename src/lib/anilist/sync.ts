import { activeProfileId } from "@/lib/active-profile-id";
import { kitsuToAnilist } from "@/lib/providers/anime-mapping";

import { AnilistApiError, anilistRequest } from "./client";
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

const SENT_KEY_BASE = "harbor.anilist.synced.v1";
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

function leadingInt(value: string): number | null {
  const n = Number(value.split(":")[0]);
  return Number.isFinite(n) ? n : null;
}

const MAL_QUERY = `query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { id } }`;

async function malToAnilist(idMal: number): Promise<number | null> {
  try {
    const data = await anilistRequest<{ Media: { id: number } | null }>(MAL_QUERY, { idMal });
    return data?.Media?.id ?? null;
  } catch {
    return null;
  }
}

export async function resolveAnilistMediaId(harborId: string): Promise<number | null> {
  if (harborId.startsWith("anilist:")) return leadingInt(harborId.slice(8));
  if (harborId.startsWith("kitsu:")) {
    const k = leadingInt(harborId.slice(6));
    return k != null ? kitsuToAnilist(k) : null;
  }
  if (harborId.startsWith("mal:")) {
    const m = leadingInt(harborId.slice(4));
    return m != null ? malToAnilist(m) : null;
  }
  return null;
}

const ENTRY_QUERY = `query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    episodes
    mediaListEntry { id progress status }
  }
}`;

const SAVE_MUTATION = `mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus) {
  SaveMediaListEntry(mediaId: $mediaId, progress: $progress, status: $status) {
    id
    progress
    status
  }
}`;

const SAVE_STATUS_MUTATION = `mutation ($mediaId: Int, $status: MediaListStatus) {
  SaveMediaListEntry(mediaId: $mediaId, status: $status) {
    id
    status
  }
}`;

type EntryResponse = {
  Media: {
    id: number;
    episodes: number | null;
    mediaListEntry: { id: number; progress: number; status: string } | null;
  } | null;
};

type SaveResponse = {
  SaveMediaListEntry: { id: number; progress: number; status: string } | null;
};

const inflight = new Set<string>();
const watchingMarked = new Set<string>();

export function resetForProfile(): void {
  inflight.clear();
  watchingMarked.clear();
}

export async function markAnimeWatching(harborId: string, title: string): Promise<void> {
  if (!isAuthenticated()) return;
  if (watchingMarked.has(harborId)) return;
  watchingMarked.add(harborId);
  try {
    const mediaId = await resolveAnilistMediaId(harborId);
    if (mediaId == null) {
      watchingMarked.delete(harborId);
      return;
    }
    const cur = await anilistRequest<EntryResponse>(ENTRY_QUERY, { id: mediaId });
    const entry = cur?.Media?.mediaListEntry;
    if (entry && entry.status !== "PLANNING") return;
    await anilistRequest<{ SaveMediaListEntry: { id: number } | null }>(SAVE_STATUS_MUTATION, {
      mediaId,
      status: "CURRENT",
    });
    emit({ kind: "watching", title });
  } catch (e) {
    watchingMarked.delete(harborId);
    if (e instanceof AnilistApiError && e.status === 401) return;
  }
}

export async function syncAnimeProgress(harborId: string, episode: number | undefined, title: string): Promise<void> {
  if (!isAuthenticated()) return;
  const ep = episode ?? 1;
  if (!Number.isFinite(ep) || ep < 1) return;

  const sent = loadSent();
  if ((sent[harborId] ?? 0) >= ep) return;

  const flightKey = `${harborId}|${ep}`;
  if (inflight.has(flightKey)) return;
  inflight.add(flightKey);

  try {
    const mediaId = await resolveAnilistMediaId(harborId);
    if (mediaId == null) return;

    const cur = await anilistRequest<EntryResponse>(ENTRY_QUERY, { id: mediaId });
    const media = cur?.Media;
    if (!media) return;

    const current = media.mediaListEntry?.progress ?? 0;
    if (ep <= current) {
      sent[harborId] = current;
      saveSent(sent);
      return;
    }

    const total = media.episodes ?? 0;
    const status = total > 0 && ep >= total ? "COMPLETED" : "CURRENT";
    emit({ kind: "syncing", title, episode: ep });

    const saved = await anilistRequest<SaveResponse>(SAVE_MUTATION, {
      mediaId,
      progress: ep,
      status,
    });

    if (saved?.SaveMediaListEntry?.progress === ep) {
      sent[harborId] = ep;
      saveSent(sent);
      emit({ kind: "ok", title, episode: ep });
    } else {
      emit({ kind: "error", title, message: "AniList did not confirm the update." });
    }
  } catch (e) {
    if (e instanceof AnilistApiError && e.status === 401) return;
    emit({ kind: "error", title, message: "Couldn't reach AniList." });
  } finally {
    inflight.delete(flightKey);
  }
}
