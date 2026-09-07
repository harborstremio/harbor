import { anilistRequest } from "@/lib/anilist/client";
import { isAuthenticated } from "@/lib/anilist/session";
import { isConfidentTitleMatch } from "@/lib/manga-match";
import type { MangaCandidate, MangaPushResult } from "./sync";

const SEARCH = `query ($q: String) {
  Page(perPage: 10) {
    media(search: $q, type: MANGA, sort: SEARCH_MATCH) {
      id
      idMal
      title { romaji english }
      synonyms
      coverImage { medium large }
      chapters
      format
      countryOfOrigin
      averageScore
      startDate { year month day }
    }
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

type AniSearchMedia = {
  id: number;
  idMal: number | null;
  title: { romaji: string; english: string | null };
  synonyms: string[] | null;
  coverImage: { medium: string; large: string };
  chapters: number | null;
  format: string | null;
  countryOfOrigin: string | null;
  averageScore: number | null;
  startDate: { year: number | null; month: number | null; day: number | null };
} | null;

export function anilistMangaAuthed(): boolean {
  return isAuthenticated();
}

export async function searchAnilistMangaEntries(title: string): Promise<MangaCandidate[]> {
  const q = title.trim();
  if (q.length < 2) return [];
  const data = await anilistRequest<{ Page: { media: AniSearchMedia[] } | null }>(
    SEARCH,
    { q },
    undefined,
    true,
  );
  const media = data?.Page?.media ?? [];
  const COUNTRY_LABEL: Record<string, string> = { KR: "Manhwa", CN: "Manhua" };
  const FORMAT_LABEL: Record<string, string> = {
    NOVEL: "Light Novel",
    ONE_SHOT: "One-shot",
  };
  return media
    .filter((m): m is NonNullable<AniSearchMedia> => !!m)
    .map((m) => ({
      id: String(m.id),
      title: m.title.english || m.title.romaji || "",
      cover: m.coverImage.medium ?? m.coverImage.large,
      chapters: m.chapters,
      malId: m.idMal,
      type: COUNTRY_LABEL[m.countryOfOrigin ?? ""] ?? FORMAT_LABEL[m.format ?? ""] ?? "Manga",
      score: m.averageScore,
      releaseDate: buildReleaseDate(m.startDate),
      altTitles: [m.title.romaji, m.title.english, ...(m.synonyms ?? [])].filter(
        (t): t is string => !!t,
      ),
    }))
    .filter((c) => !!c.title && !!c.id);
}

function buildReleaseDate(d: { year: number | null; month: number | null; day: number | null }): string | undefined {
  if (!d?.year) return undefined;
  const month = d.month ?? 1;
  const day = d.day ?? 1;
  return `${d.year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export type MangaPushOutcome = { result: MangaPushResult; id: string | null };

export async function pushAnilistManga(
  title: string,
  chapter: number,
  explicitId?: string,
): Promise<MangaPushOutcome> {
  try {
    let mediaIdStr: string | null = explicitId ?? null;
    if (mediaIdStr == null) {
      const hits = await searchAnilistMangaEntries(title);
      const hit = hits.find((h) => isConfidentTitleMatch(title, h.title, h.altTitles));
      if (!hit) return { result: "title-miss", id: null };
      mediaIdStr = hit.id;
    }
    const mediaId = Number(mediaIdStr);
    if (!Number.isFinite(mediaId)) return { result: "title-miss", id: null };
    const cur = await anilistRequest<{
      Media: { chapters: number | null; mediaListEntry: { progress: number } | null } | null;
    }>(ENTRY, { id: mediaId });
    const media = cur?.Media;
    if (!media) return { result: "title-miss", id: null };
    const existing = media.mediaListEntry?.progress ?? 0;
    if (chapter <= existing) return { result: "noop", id: mediaIdStr };
    const total = media.chapters ?? 0;
    const status = total > 0 && chapter >= total ? "COMPLETED" : "CURRENT";
    const saved = await anilistRequest<{ SaveMediaListEntry: { progress: number } | null }>(SAVE, {
      mediaId,
      progress: chapter,
      status,
    });
    const result = saved?.SaveMediaListEntry?.progress === chapter ? "synced" : "error";
    return { result, id: result === "error" ? null : mediaIdStr };
  } catch {
    return { result: "error", id: null };
  }
}
