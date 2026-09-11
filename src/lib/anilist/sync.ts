import { activeProfileId } from "@/lib/active-profile-id";
import { kitsuToAnilist } from "@/lib/providers/anime-mapping";
import { AnilistApiError, anilistRequest } from "./client";
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
    const total = cur?.Media?.episodes ?? 0;
    if (entry && total > 0 && entry.progress >= total) return;
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

export async function syncAnimeProgress(
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
    const mediaId = await resolveAnilistMediaId(harborId);
    if (mediaId == null) return;

    const cur = await anilistRequest<EntryResponse>(ENTRY_QUERY, { id: mediaId });
    const media = cur?.Media;
    if (!media) return;

    // Never overwrite an entry the user deliberately moved to Completed or
    // Re-watching; auto-sync would otherwise flip it back to CURRENT.
    const entryStatus = media.mediaListEntry?.status;
    if (entryStatus === "COMPLETED" || entryStatus === "REPEATING") return;

    const current = media.mediaListEntry?.progress ?? 0;
    const total = media.episodes ?? 0;
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

    const status = total > 0 && target >= total ? "COMPLETED" : "CURRENT";
    emit({ kind: "syncing", title, episode: target });

    const saved = await anilistRequest<SaveResponse>(SAVE_MUTATION, {
      mediaId,
      progress: target,
      status,
    });

    if (saved?.SaveMediaListEntry?.progress === target) {
      sent[harborId] = target;
      saveSent(sent);
      emit({ kind: "ok", title, episode: target });
    } else {
      sent[harborId] = Math.max(sent[harborId] ?? 0, target);
      saveSent(sent);
      emit({ kind: "error", title, error: "update-not-confirmed" });
    }
  } catch (e) {
    if (e instanceof AnilistApiError && e.status === 401) return;
    emit({ kind: "error", title, error: "unreachable" });
  } finally {
    inflight.delete(flightKey);
  }
}
