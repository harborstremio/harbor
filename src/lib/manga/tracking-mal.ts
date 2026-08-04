import { malRequest } from "@/lib/mal/client";
import { isAuthenticated } from "@/lib/mal/session";

const idCache = new Map<string, number | null>();

export function malMangaAuthed(): boolean {
  return isAuthenticated();
}

async function resolveMangaId(titleKey: string, title: string): Promise<number | null> {
  if (idCache.has(titleKey)) return idCache.get(titleKey) ?? null;
  const q = title.trim();
  if (q.length < 3) {
    idCache.set(titleKey, null);
    return null;
  }
  const path = `/manga?q=${encodeURIComponent(q.slice(0, 64))}&limit=1&fields=id`;
  const data = await malRequest<{ data: { node: { id: number } }[] }>(path);
  const id = data?.data?.[0]?.node?.id ?? null;
  idCache.set(titleKey, id);
  return id;
}

export async function pushMalManga(
  titleKey: string,
  title: string,
  chapter: number,
): Promise<boolean> {
  try {
    const mangaId = await resolveMangaId(titleKey, title);
    if (mangaId == null) return false;
    const cur = await malRequest<{
      num_chapters: number | null;
      my_list_status: { num_chapters_read: number } | null;
    }>(`/manga/${mangaId}?fields=num_chapters,my_list_status`);
    const existing = cur?.my_list_status?.num_chapters_read ?? 0;
    if (chapter <= existing) return true;
    const total = cur?.num_chapters ?? 0;
    const status = total > 0 && chapter >= total ? "completed" : "reading";
    const body = new URLSearchParams();
    body.set("status", status);
    body.set("num_chapters_read", String(chapter));
    const saved = await malRequest<{ num_chapters_read: number }>(
      `/manga/${mangaId}/my_list_status`,
      { method: "PATCH", body },
    );
    return saved?.num_chapters_read === chapter;
  } catch {
    return false;
  }
}
