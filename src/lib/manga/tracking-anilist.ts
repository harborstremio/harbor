import { anilistRequest } from "@/lib/anilist/client";
import { isAuthenticated } from "@/lib/anilist/session";

const SEARCH = `query ($q: String) {
  Page(perPage: 1) {
    media(search: $q, type: MANGA, sort: SEARCH_MATCH) { id }
  }
}`;

const ENTRY = `query ($id: Int) {
  Media(id: $id, type: MANGA) {
    chapters
    mediaListEntry { progress }
  }
}`;

const SAVE = `mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus) {
  SaveMediaListEntry(mediaId: $mediaId, progress: $progress, status: $status) { progress }
}`;

const idCache = new Map<string, number | null>();

export function anilistMangaAuthed(): boolean {
  return isAuthenticated();
}

async function resolveMediaId(titleKey: string, title: string): Promise<number | null> {
  if (idCache.has(titleKey)) return idCache.get(titleKey) ?? null;
  const q = title.trim();
  if (q.length < 2) {
    idCache.set(titleKey, null);
    return null;
  }
  const data = await anilistRequest<{ Page: { media: { id: number }[] } | null }>(
    SEARCH,
    { q },
    undefined,
    true,
  );
  const id = data?.Page?.media?.[0]?.id ?? null;
  idCache.set(titleKey, id);
  return id;
}

export async function pushAnilistManga(
  titleKey: string,
  title: string,
  chapter: number,
): Promise<boolean> {
  try {
    const mediaId = await resolveMediaId(titleKey, title);
    if (mediaId == null) return false;
    const cur = await anilistRequest<{
      Media: { chapters: number | null; mediaListEntry: { progress: number } | null } | null;
    }>(ENTRY, { id: mediaId });
    const media = cur?.Media;
    if (!media) return false;
    const existing = media.mediaListEntry?.progress ?? 0;
    if (chapter <= existing) return true;
    const total = media.chapters ?? 0;
    const status = total > 0 && chapter >= total ? "COMPLETED" : "CURRENT";
    const saved = await anilistRequest<{ SaveMediaListEntry: { progress: number } | null }>(SAVE, {
      mediaId,
      progress: chapter,
      status,
    });
    return saved?.SaveMediaListEntry?.progress === chapter;
  } catch {
    return false;
  }
}
