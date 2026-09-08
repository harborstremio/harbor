import { anilistRequest } from "./client";
import type { MediaListStatus } from "./types";

const SAVE_ENTRY = `mutation ($mediaId: Int, $status: MediaListStatus, $progress: Int) {
  SaveMediaListEntry(mediaId: $mediaId, status: $status, progress: $progress) {
    id
    status
    progress
  }
}`;

const DELETE_ENTRY = `mutation ($id: Int) {
  DeleteMediaListEntry(id: $id) { deleted }
}`;

const LIST_ENTRY = `query ($mediaId: Int) {
  Media(id: $mediaId, type: ANIME) {
    episodes
    mediaListEntry { id status progress }
  }
}`;

export type SavedEntry = {
  id: number;
  status: MediaListStatus;
  progress: number;
};

export type ListEntryInfo = {
  episodes: number | null;
  entry: { id: number; status: MediaListStatus; progress: number } | null;
};

export async function saveListEntry(input: {
  mediaId: number;
  status?: MediaListStatus;
  progress?: number;
}): Promise<SavedEntry> {
  const data = await anilistRequest<{ SaveMediaListEntry: SavedEntry }>(SAVE_ENTRY, input);
  return data.SaveMediaListEntry;
}

export async function deleteListEntry(id: number): Promise<boolean> {
  const data = await anilistRequest<{ DeleteMediaListEntry: { deleted: boolean } }>(DELETE_ENTRY, {
    id,
  });
  return data.DeleteMediaListEntry?.deleted ?? false;
}

export async function fetchListEntry(mediaId: number, strict = false): Promise<ListEntryInfo> {
  const data = await anilistRequest<{
    Media: {
      episodes: number | null;
      mediaListEntry: { id: number; status: MediaListStatus; progress: number } | null;
    } | null;
  }>(LIST_ENTRY, { mediaId });
  const media = data?.Media;
  if (
    strict &&
    (!media ||
      !Object.hasOwn(media, "mediaListEntry") ||
      (media.episodes !== null && (!Number.isInteger(media.episodes) || media.episodes < 0)) ||
      (media.mediaListEntry !== null &&
        (!media.mediaListEntry ||
          !["CURRENT", "PLANNING", "COMPLETED", "DROPPED", "PAUSED", "REPEATING"].includes(
            media.mediaListEntry.status,
          ) ||
          !Number.isInteger(media.mediaListEntry.progress) ||
          media.mediaListEntry.progress < 0)))
  )
    throw new Error("The current AniList watched state could not be read safely.");
  return {
    episodes: data.Media?.episodes ?? null,
    entry: data.Media?.mediaListEntry ?? null,
  };
}
