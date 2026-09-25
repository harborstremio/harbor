import { useEffect, useMemo, useRef } from "react";
import { BookOpen, Bookmark, BookmarkCheck, Check, Download, EyeOff } from "lucide-react";
import { useContextTarget } from "./context-menu";
import { useProfiles } from "./profiles";
import { useT } from "./i18n";
import { mangaContextSource } from "./manga-context-actions";
import { activeMangaSourceId, listMangaSources } from "./manga/sources";
import { downloadChapter, mangaDownloadStatus } from "./manga-downloads";
import type { MangaChapter, MangaSummary } from "./manga/types";
import type { ContextAction } from "./context-actions";
import { addMangaBookmark, listMangaBookmarks, removeMangaBookmark } from "./manga-bookmarks";
import {
  listReadMangaChapters,
  recordMangaChapterRead,
  removeMangaChapterRead,
} from "./manga-progress";

export function useMangaChapterContext<T extends HTMLElement>(
  manga: Pick<MangaSummary, "id" | "title" | "cover">,
  chapter: MangaChapter,
  onRead?: () => void,
) {
  const t = useT();
  const { activeId } = useProfiles();
  const source = useMemo(
    () => mangaContextSource(chapter.id, listMangaSources(), activeMangaSourceId()),
    [chapter.id],
  );
  const latest = useRef({ manga, chapter, onRead, activeId });
  latest.current = { manga, chapter, onRead, activeId };
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return useContextTarget<T>(() => {
    const chapterId = chapter.id;
    const mangaId = manga.id;
    const profile = activeId;
    const valid = () =>
      mounted.current &&
      latest.current.chapter.id === chapterId &&
      latest.current.manga.id === mangaId &&
      latest.current.activeId === profile &&
      (!source ||
        listMangaSources().some(
          (item) =>
            item.id === source.id && item.baseUrl === source.baseUrl && item.kind === source.kind,
        )) &&
      (chapterId.includes("::") || !source || activeMangaSourceId() === source.id);
    return {
      kind: "actions",
      id: `manga-chapter:${profile}:${mangaId}:${chapterId}`,
      label:
        chapter.title ||
        (chapter.chapter == null ? t("Oneshot") : t("Chapter {n}", { n: chapter.chapter })),
      isValid: valid,
      actions: () => {
        if (!valid()) return [];
        const actions: ContextAction[] = [];
        const pid = profile ?? "default";
        const savedBookmark = listMangaBookmarks(pid).find(
          (item) => item.mangaId === mangaId && item.chapterId === chapterId,
        );
        const read =
          latest.current.chapter.serverRead === true ||
          listReadMangaChapters(pid, mangaId).includes(chapterId);
        if (latest.current.onRead)
          actions.push({
            id: `manga:read-chapter:${chapterId}`,
            icon: <BookOpen size={16} />,
            label: t("Read chapter"),
            run: latest.current.onRead,
          });
        actions.push(
          {
            id: `manga:bookmark:${chapterId}`,
            icon: savedBookmark ? <BookmarkCheck size={16} /> : <Bookmark size={16} />,
            label: t(savedBookmark ? "Bookmarked" : "Bookmark"),
            checked: !!savedBookmark,
            run: () => {
              if (savedBookmark) removeMangaBookmark(pid, savedBookmark.id);
              else
                addMangaBookmark(pid, {
                  mangaId,
                  title: manga.title,
                  cover: manga.cover,
                  sourceId: source?.id,
                  chapterId,
                  chapterNumber: chapter.chapter,
                  chapterLabel:
                    chapter.chapter == null
                      ? t("Oneshot")
                      : t("Chapter {n}", { n: chapter.chapter }),
                  page: 1,
                  totalPages: 1,
                });
              const present = listMangaBookmarks(pid).some(
                (item) => item.mangaId === mangaId && item.chapterId === chapterId,
              );
              if (present === !!savedBookmark)
                throw new Error(
                  t("Could not save the change. Check available storage and try again."),
                );
            },
          },
          {
            id: `manga:read-flag:${chapterId}`,
            icon: read ? <EyeOff size={16} /> : <Check size={16} />,
            label: t(read ? "Mark as unread" : "Mark as read"),
            checked: read,
            run: () => {
              if (read) removeMangaChapterRead(pid, mangaId, chapterId);
              else recordMangaChapterRead(pid, mangaId, chapterId);
              if (listReadMangaChapters(pid, mangaId).includes(chapterId) === read)
                throw new Error(
                  t("Could not save the change. Check available storage and try again."),
                );
            },
          },
        );
        const status = mangaDownloadStatus(chapterId).status;
        const available =
          source &&
          listMangaSources().some((s) => s.id === source.id && s.baseUrl === source.baseUrl);
        const native = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
        if (
          native &&
          (status === "done" ||
            latest.current.chapter.downloaded ||
            (available && source.kind !== "local"))
        ) {
          const saved = status === "done" || latest.current.chapter.downloaded;
          actions.push({
            id: `manga:download-chapter:${chapterId}`,
            icon: <Download size={16} />,
            label:
              status === "done"
                ? t("Downloaded")
                : latest.current.chapter.downloaded
                  ? t("Saved on your server")
                  : t("Download chapter"),
            disabled: saved || status === "downloading" || status === "paused",
            run: async () => {
              const ok = await downloadChapter(mangaId, chapterId, {
                title: manga.title,
                cover: manga.cover,
                chapter: chapter.chapter,
              });
              if (!ok) throw new Error(t("Manga download failed"));
            },
          });
        }
        return actions;
      },
    };
  });
}
