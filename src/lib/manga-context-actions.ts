import type { ContextAction } from "./context-actions";
import type { MangaProgressEntry } from "./manga-progress";
import type { MangaSource } from "./manga/sources";
import { chapterNumberKey } from "./manga/chapter-identity";

/** Catalog-only IDs must be resolved by their existing open callback first. */
export function mangaContextSource(
  id: string,
  sources: MangaSource[],
  activeSourceId: string,
): MangaSource | undefined {
  if (/^(anilist|mal):/.test(id)) return undefined;
  const separator = id.indexOf("::");
  const sourceId = separator < 0 ? activeSourceId : id.slice(0, separator);
  return sources.find((source) => source.id === sourceId && source.id !== "all");
}

export function mangaContextProgress(
  entries: MangaProgressEntry[],
  mangaId: string,
  sourceId?: string,
): MangaProgressEntry | undefined {
  // A title match can refer to another translation, provider, or server.
  const qualified = mangaId.includes("::") || !sourceId ? mangaId : `${sourceId}::${mangaId}`;
  return entries.find(
    (entry) =>
      (entry.id.includes("::") || !entry.sourceId || entry.sourceId === "all"
        ? entry.id
        : `${entry.sourceId}::${entry.id}`) === qualified &&
      !!entry.chapterId &&
      Number.isFinite(entry.page) &&
      entry.page >= 1 &&
      Number.isFinite(entry.totalPages) &&
      entry.totalPages > 0,
  );
}

export function mangaResumeChapterIndex(
  chapters: Array<{ id: string; chapter: string | null; title?: string | null }>,
  entry: MangaProgressEntry,
): number {
  const exact = chapters.findIndex((chapter) => chapter.id === entry.chapterId);
  if (exact >= 0) return exact;
  if (!entry.chapterId.includes("::") && entry.sourceId && entry.sourceId !== "all") {
    const qualified = chapters.findIndex(
      (chapter) => chapter.id === `${entry.sourceId}::${entry.chapterId}`,
    );
    if (qualified >= 0) return qualified;
  }
  // Keep the existing legacy number fallback, but never switch a qualified
  // saved chapter to another provider just because its number is the same.
  const separator = entry.chapterId.indexOf("::");
  const source = separator < 0 ? undefined : entry.chapterId.slice(0, separator + 2);
  const ownsRawChapter = source === `${entry.sourceId}::`;
  if (ownsRawChapter) {
    const raw = chapters.findIndex(
      (chapter) => chapter.id === entry.chapterId.slice(separator + 2),
    );
    if (raw >= 0) return raw;
  }
  const number = chapterNumberKey(entry.chapterNumber) ?? chapterNumberKey(entry.chapterLabel);
  return chapters.findIndex(
    (chapter) =>
      (!source ||
        chapter.id.startsWith(source) ||
        (ownsRawChapter && !chapter.id.includes("::"))) &&
      ((number != null && chapterNumberKey(chapter.chapter ?? chapter.title) === number) ||
        (entry.chapterNumber != null && chapter.chapter === entry.chapterNumber)),
  );
}

export function mangaTitleActions(input: {
  id: string;
  t: (label: string) => string;
  favorite: boolean;
  open?: () => void | Promise<void>;
  toggleFavorite: () => void;
  resume?: () => void | Promise<void>;
  download?: () => void;
}): ContextAction[] {
  const actions: ContextAction[] = [];
  if (input.open)
    actions.push({
      id: `manga:details:${input.id}`,
      label: input.t("View details"),
      run: input.open,
    });
  actions.push({
    id: `manga:favorite:${input.id}`,
    label: input.t(input.favorite ? "Remove from favorites" : "Add to favorites"),
    checked: input.favorite,
    run: input.toggleFavorite,
  });
  if (input.resume)
    actions.push({
      id: `manga:resume:${input.id}`,
      label: input.t("Resume reading"),
      run: input.resume,
    });
  if (input.download)
    actions.push({
      id: `manga:download:${input.id}`,
      label: input.t("Download chapters"),
      run: input.download,
      restoreFocus: false,
    });
  return actions;
}
