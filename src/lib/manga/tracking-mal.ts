import { malRequest } from "@/lib/mal/client";
import { isAuthenticated } from "@/lib/mal/session";
import { isConfidentTitleMatch } from "@/lib/manga-match";
import type { MangaCandidate } from "./sync";
import type { MangaPushOutcome } from "./tracking-anilist";

export function malMangaAuthed(): boolean {
  return isAuthenticated();
}

type MalSearchNode = {
  id: number;
  title: string;
  title_english?: string | null;
  main_picture: { medium: string; large?: string } | null;
  num_chapters: number | null;
  media_type: string | null;
  mean: number | null;
  start_date: string | null;
};

export async function searchMalMangaEntries(title: string): Promise<MangaCandidate[]> {
  const q = title.trim();
  if (q.length < 3) return [];
  const fields = "id,title,title_english,main_picture,num_chapters,media_type,mean,start_date";
  const path = `/manga?q=${encodeURIComponent(q.slice(0, 64))}&limit=10&fields=${fields}`;
  const data = await malRequest<{ data: { node: MalSearchNode }[] }>(path);
  if (!data?.data) return [];
  const TYPE_LABEL: Record<string, string> = {
    manga: "Manga",
    novel: "Novel",
    one_shot: "One-shot",
    doujinshi: "Doujinshi",
    manhwa: "Manhwa",
    manhua: "Manhua",
    oel: "OEL",
  };
  return data.data
    .map(({ node }) => ({
      id: String(node.id),
      title: node.title,
      cover: node.main_picture?.medium ?? node.main_picture?.large,
      chapters: node.num_chapters,
      type: TYPE_LABEL[node.media_type ?? ""],
      score: node.mean ?? null,
      releaseDate: node.start_date ?? undefined,
      altTitles: [node.title_english].filter((t): t is string => !!t),
    }))
    .filter((c) => !!c.title && !!c.id);
}

export async function pushMalManga(
  title: string,
  chapter: number,
  explicitId?: string,
): Promise<MangaPushOutcome> {
  try {
    let mangaId: string | null = explicitId ?? null;
    if (mangaId == null) {
      const hits = await searchMalMangaEntries(title);
      const hit = hits.find((h) => isConfidentTitleMatch(title, h.title, h.altTitles));
      if (!hit) return { result: "title-miss", id: null };
      mangaId = hit.id;
    }
    const cur = await malRequest<{
      num_chapters: number | null;
      my_list_status: { num_chapters_read: number } | null;
    }>(`/manga/${mangaId}?fields=num_chapters,my_list_status`);
    const existing = cur?.my_list_status?.num_chapters_read ?? 0;
    if (chapter <= existing) return { result: "noop", id: mangaId };
    const total = cur?.num_chapters ?? 0;
    const status = total > 0 && chapter >= total ? "completed" : "reading";
    const body = new URLSearchParams();
    body.set("status", status);
    body.set("num_chapters_read", String(chapter));
    const saved = await malRequest<{ num_chapters_read: number }>(
      `/manga/${mangaId}/my_list_status`,
      { method: "PATCH", body },
    );
    const result = saved?.num_chapters_read === chapter ? "synced" : "error";
    return { result, id: result === "error" ? null : mangaId };
  } catch {
    return { result: "error", id: null };
  }
}
