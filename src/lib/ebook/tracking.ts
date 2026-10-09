import { anilistRequest } from "@/lib/anilist/client";
import { getSession } from "@/lib/anilist/session";
import type { MediaListStatus } from "@/lib/anilist/types";
import type { EBook, RawEBook } from "./api";
import { mapEBook } from "./api";

export type EBookTracking = {
  entryId?: number;
  status: MediaListStatus;
  progress: number;
  progressVolumes: number;
  sync: "local" | "pending" | "synced";
};

export type EBookListGroup = {
  status: MediaListStatus;
  entries: Array<{ ebook: EBook; tracking: EBookTracking }>;
};

const KEY = "harbor.ebook.tracking.v1";
const LEGACY_KEY = "harbor.novel.tracking.v1";
const DEFAULT: EBookTracking = {
  status: "PLANNING",
  progress: 0,
  progressVolumes: 0,
  sync: "local",
};

const ENTRY = `query ($id: Int) {
  Media(id: $id, type: MANGA) {
    mediaListEntry { id status progress progressVolumes }
  }
}`;

const SAVE = `mutation ($mediaId: Int, $status: MediaListStatus, $progress: Int, $progressVolumes: Int) {
  SaveMediaListEntry(mediaId: $mediaId, status: $status, progress: $progress, progressVolumes: $progressVolumes) {
    id status progress progressVolumes
  }
}`;

const COLLECTION = `query ($userId: Int) {
  MediaListCollection(userId: $userId, type: MANGA) {
    lists {
      status
      isCustomList
      entries {
        id status progress progressVolumes
        media {
          id title { english romaji native }
          coverImage { extraLarge large }
          bannerImage description(asHtml: false) startDate { year }
          status genres chapters volumes averageScore siteUrl format
          staff(perPage: 10, sort: RELEVANCE) { edges { role node { name { full } } } }
        }
      }
    }
  }
}`;

function all(): Record<string, EBookTracking> {
  try {
    const stored = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY) ?? "{}";
    if (!localStorage.getItem(KEY) && stored !== "{}") localStorage.setItem(KEY, stored);
    return JSON.parse(stored) as Record<string, EBookTracking>;
  } catch {
    return {};
  }
}

function persist(id: string, value: EBookTracking): EBookTracking {
  localStorage.setItem(KEY, JSON.stringify({ ...all(), [id]: value }));
  window.dispatchEvent(new CustomEvent("harbor:ebook-tracking", { detail: id }));
  return value;
}

export function getEBookTracking(id: string): EBookTracking {
  return { ...DEFAULT, ...all()[id] };
}

export async function fetchEBookTracking(ebook: EBook): Promise<EBookTracking> {
  if (!ebook.anilistId || !getSession()) return getEBookTracking(ebook.id);
  const data = await anilistRequest<{
    Media: { mediaListEntry: Omit<EBookTracking, "sync"> | null } | null;
  }>(ENTRY, { id: ebook.anilistId });
  const entry = data.Media?.mediaListEntry;
  return entry ? persist(ebook.id, { ...entry, sync: "synced" }) : getEBookTracking(ebook.id);
}

export async function saveEBookTracking(
  ebook: EBook,
  patch: Partial<Pick<EBookTracking, "status" | "progress" | "progressVolumes">>,
): Promise<EBookTracking> {
  const next = { ...getEBookTracking(ebook.id), ...patch };
  if (!ebook.anilistId) return persist(ebook.id, { ...next, sync: "local" });
  if (!getSession()) return persist(ebook.id, { ...next, sync: "pending" });
  persist(ebook.id, { ...next, sync: "pending" });
  const data = await anilistRequest<{ SaveMediaListEntry: Omit<EBookTracking, "sync"> }>(SAVE, {
    mediaId: ebook.anilistId,
    status: next.status,
    progress: next.progress,
    progressVolumes: next.progressVolumes,
  });
  return persist(ebook.id, { ...data.SaveMediaListEntry, sync: "synced" });
}

export async function flushPendingEBookTracking(): Promise<void> {
  if (!getSession()) return;
  for (const [id, tracking] of Object.entries(all())) {
    if (tracking.sync !== "pending" || !id.startsWith("anilist:")) continue;
    const anilistId = Number(id.slice(8));
    if (!anilistId) continue;
    try {
      const data = await anilistRequest<{ SaveMediaListEntry: Omit<EBookTracking, "sync"> }>(SAVE, {
        mediaId: anilistId,
        status: tracking.status,
        progress: tracking.progress,
        progressVolumes: tracking.progressVolumes,
      });
      persist(id, { ...data.SaveMediaListEntry, sync: "synced" });
    } catch {}
  }
}

export async function fetchEBookListCollection(userId: number): Promise<EBookListGroup[]> {
  const data = await anilistRequest<{
    MediaListCollection: {
      lists: Array<{
        status: MediaListStatus | null;
        isCustomList: boolean;
        entries: Array<{
          id: number;
          status: MediaListStatus;
          progress: number;
          progressVolumes: number;
          media: RawEBook & { format: string | null };
        }>;
      }>;
    } | null;
  }>(COLLECTION, { userId });
  const tracked = all();
  const groups = (data.MediaListCollection?.lists ?? [])
    .filter((list) => !list.isCustomList && list.status)
    .map((list) => ({
      status: list.status!,
      entries: list.entries
        .filter((entry) => entry.media.format === "NOVEL")
        .map((entry) => {
          const ebook = mapEBook(entry.media);
          const tracking: EBookTracking = {
            entryId: entry.id,
            status: entry.status,
            progress: entry.progress,
            progressVolumes: entry.progressVolumes,
            sync: "synced",
          };
          tracked[ebook.id] = tracking;
          return { ebook, tracking };
        }),
    }))
    .filter((group) => group.entries.length > 0);
  localStorage.setItem(KEY, JSON.stringify(tracked));
  return groups;
}
