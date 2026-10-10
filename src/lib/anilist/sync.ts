import { activeProfileId } from "@/lib/active-profile-id";
import { kitsuToAnilist } from "@/lib/providers/anime-mapping";
import { AnilistApiError, anilistRequest } from "./client";
import { isAuthenticated, getSession } from "./session";

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

const SENT_KEY_BASE = "harbor.anilist.synced.v1";
function sentKey(): string {
  return `${SENT_KEY_BASE}.${activeProfileId()}`;
}
type SentValue = number | { p: number; t: number };
type SentMap = Record<string, SentValue>;

// Only collapses the per-tick writes of one playback session. Kept indefinitely it
// outlives the server, so removing the entry there could never be re-synced.
const SENT_TTL_MS = 60 * 1000;

function sentProgress(map: SentMap, key: string): { p: number; t: number } | null {
  const value = map[key];
  if (typeof value === "number") return { p: value, t: 0 };
  if (value && typeof value === "object" && typeof value.p === "number") {
    return { p: value.p, t: typeof value.t === "number" ? value.t : 0 };
  }
  return null;
}

function rememberSent(map: SentMap, key: string, progress: number): void {
  map[key] = { p: progress, t: Date.now() };
}

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
  const profile = activeProfileId();
  const session = getSession();
  const owned = () => activeProfileId() === profile && getSession() === session;
  if (watchingMarked.has(harborId)) return;
  watchingMarked.add(harborId);
  try {
    const mediaId = await resolveAnilistMediaId(harborId);
    if (!owned() || mediaId == null) {
      watchingMarked.delete(harborId);
      return;
    }
    const cur = await anilistRequest<EntryResponse>(ENTRY_QUERY, { id: mediaId });
    if (!owned()) return;
    const entry = cur?.Media?.mediaListEntry;
    if (entry && entry.status !== "PLANNING") return;
    const total = cur?.Media?.episodes ?? 0;
    if (entry && total > 0 && entry.progress >= total) return;
    await anilistRequest<{ SaveMediaListEntry: { id: number } | null }>(SAVE_STATUS_MUTATION, {
      mediaId,
      status: "CURRENT",
    });
    if (owned()) emit({ kind: "watching", title });
  } catch (e) {
    watchingMarked.delete(harborId);
    if (e instanceof AnilistApiError && e.status === 401) return;
  }
}

/** Lowers progress to the last episode still watched; leaves completed and repeating entries alone. */
export async function rewindAnimeProgress(harborId: string, target: number): Promise<void> {
  if (!isAuthenticated() || !Number.isInteger(target) || target < 0) return;
  const profile = activeProfileId();
  const session = getSession();
  const owned = () => activeProfileId() === profile && getSession() === session;
  try {
    const mediaId = await resolveAnilistMediaId(harborId);
    if (!owned() || mediaId == null) return;
    const cur = await anilistRequest<EntryResponse>(ENTRY_QUERY, { id: mediaId });
    const entry = cur?.Media?.mediaListEntry;
    if (!owned() || !entry) return;
    if (entry.status === "COMPLETED" || entry.status === "REPEATING") return;
    if (entry.progress <= target) return;
    await anilistRequest<SaveResponse>(SAVE_MUTATION, {
      mediaId,
      progress: target,
      status: entry.status,
    });
    // Forget sent ticks above the new count so replaying those episodes syncs again.
    const sent = loadSent();
    for (const key of Object.keys(sent)) {
      if (key.startsWith(`${harborId}|`) && (sentProgress(sent, key)?.p ?? 0) > target)
        delete sent[key];
    }
    saveSent(sent);
  } catch {
    return;
  }
}

export async function syncAnimeProgress(
  harborId: string,
  episode: number | undefined,
  title: string,
  season?: number,
): Promise<void> {
  if (!isAuthenticated()) return;
  const profile = activeProfileId();
  const session = getSession();
  const owned = () => activeProfileId() === profile && getSession() === session;
  const ep = episode ?? 1;
  if (!Number.isInteger(ep) || ep < 1) return;

  const sent = loadSent();
  const sentKey = `${harborId}|${season ?? ""}|${ep}`;
  const prevSent = sentProgress(sent, sentKey);
  if (prevSent && Date.now() - prevSent.t < SENT_TTL_MS && prevSent.p >= ep) {
    return;
  }

  const flightKey = `${profile}|${harborId}|${ep}`;
  if (inflight.has(flightKey)) {
    return;
  }
  inflight.add(flightKey);

  try {
    const mediaId = await resolveAnilistMediaId(harborId);
    if (!owned() || mediaId == null) return;

    const cur = await anilistRequest<EntryResponse>(ENTRY_QUERY, { id: mediaId });
    if (!owned()) return;
    const media = cur?.Media;
    if (!media) return;

    // Never overwrite an entry the user deliberately moved to Completed or
    // Re-watching; auto-sync would otherwise flip it back to CURRENT.
    const entryStatus = media.mediaListEntry?.status;
    if (entryStatus === "COMPLETED" || entryStatus === "REPEATING") {
      return;
    }

    const current = media.mediaListEntry?.progress ?? 0;
    const total = media.episodes ?? 0;
    // The caller resolves entry-relative numbering before reaching this layer.
    const target = ep;
    if (total > 0 && target > total) return;
    if (target <= current) {
      rememberSent(sent, sentKey, Math.max(prevSent?.p ?? 0, current));
      saveSent(sent);
      return;
    }

    const status = total > 0 && target >= total ? "COMPLETED" : "CURRENT";
    emit({ kind: "syncing", title, episode: target });

    const saved = await anilistRequest<SaveResponse>(SAVE_MUTATION, {
      mediaId,
      progress: target,
      status,
    });

    if (!owned()) return;
    if (saved?.SaveMediaListEntry?.progress === target) {
      rememberSent(sent, sentKey, target);
      saveSent(sent);
      emit({ kind: "ok", title, episode: target });
    } else {
      // Unconfirmed writes stay retryable; recording them as sent would suppress retries.
      emit({ kind: "error", title, error: "update-not-confirmed" });
    }
  } catch (e) {
    if (!owned()) return;
    if (e instanceof AnilistApiError && e.status === 401) return;
    emit({ kind: "error", title, error: "unreachable" });
  } finally {
    inflight.delete(flightKey);
  }
}
