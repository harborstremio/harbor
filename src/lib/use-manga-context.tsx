import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { BookOpen, Download, Info } from "lucide-react";
import { UiIcon } from "@/components/ui-icon";
import { useContextTarget, type ContextMenuTarget } from "./context-menu";
import { useT } from "./i18n";
import { useProfiles } from "./profiles";
import { useMangaFavorites } from "./manga-favorites";
import { listMangaProgress, type MangaProgressEntry } from "./manga-progress";
import { activeMangaSourceId, listMangaSources, setActiveMangaSource } from "./manga/sources";
import {
  mangaContextProgress,
  mangaContextSource,
  mangaTitleActions,
} from "./manga-context-actions";
import { requestMangaChapterRead, setMangaReadIntent } from "./manga/read-intent";
import { resumeChapters } from "./manga/api";
import { resolveReaderChapters } from "./manga/chapter-identity";
import { useView } from "./view";
import type { MangaSummary } from "./manga/types";
import type { ContextAction } from "./context-actions";

export const MangaContextNavigation = createContext<{
  resume: (entry: MangaProgressEntry) => void | Promise<void>;
  download: (mangaId: string) => void;
} | null>(null);

export function useMangaContext<T extends HTMLElement = HTMLButtonElement>(
  manga: Pick<MangaSummary, "id" | "title" | "cover"> & { sourceId?: string },
  options: {
    open?: () => void | Promise<void>;
    resume?: (entry: MangaProgressEntry) => void | Promise<void>;
    download?: () => void;
    extra?: () => ContextAction[];
    disabled?: boolean;
  } = {},
) {
  const t = useT();
  const favorites = useMangaFavorites();
  const { activeId } = useProfiles();
  const pid = activeId ?? "default";
  const { openManga } = useView();
  const navigation = useContext(MangaContextNavigation);
  // Raw IDs are owned by the source that rendered them, even if another source
  // is selected while its old results are still on screen.
  const source = useMemo(
    () => mangaContextSource(manga.id, listMangaSources(), manga.sourceId ?? activeMangaSourceId()),
    [manga.id, manga.sourceId],
  );
  const current = useRef({ manga, options, favorites, pid, navigation, openManga });
  current.current = { manga, options, favorites, pid, navigation, openManga };
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const target = (): ContextMenuTarget => {
    const id = manga.id;
    const actor = pid;
    const sourceCurrent = () =>
      !source ||
      listMangaSources().some(
        (item) =>
          item.id === source.id && item.baseUrl === source.baseUrl && item.kind === source.kind,
      );
    const valid = () =>
      !!id &&
      mounted.current &&
      current.current.manga.id === id &&
      current.current.manga.sourceId === manga.sourceId &&
      current.current.pid === actor &&
      sourceCurrent() &&
      (id.includes("::") || !!manga.sourceId || !source || activeMangaSourceId() === source.id);
    return {
      kind: "actions",
      id: `manga:${source?.id ?? manga.sourceId ?? ""}:${id}:${actor}`,
      label: manga.title,
      manga: {
        id: source && !id.includes("::") ? `${source.id}::${id}` : id,
        title: manga.title,
        cover: manga.cover,
      },
      image: manga.cover ? { src: manga.cover, label: manga.title } : undefined,
      isValid: valid,
      actions: () => {
        if (!valid()) return [];
        const latest = current.current;
        const favorite = latest.favorites.has(id, source?.id ?? latest.manga.sourceId ?? "");
        const progress = mangaContextProgress(listMangaProgress(actor), id, source?.id);
        const available =
          source &&
          listMangaSources().some((s) => s.id === source.id && s.baseUrl === source.baseUrl);
        const native = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
        const openDownload =
          latest.options.download ??
          (latest.navigation ? () => latest.navigation!.download(id) : undefined);
        const download = openDownload
          ? () => {
              if (source && !id.includes("::")) setActiveMangaSource(source.id);
              openDownload();
            }
          : undefined;
        const actions = mangaTitleActions({
          id,
          t,
          favorite,
          open: latest.options.open ?? (() => latest.openManga(id)),
          toggleFavorite: () => {
            if (
              !latest.favorites.toggle({
                ...latest.manga,
                sourceId: source?.id ?? latest.manga.sourceId,
              })
            )
              throw new Error(
                t("Could not save the change. Check available storage and try again."),
              );
          },
          resume:
            progress && available
              ? () => {
                  const resume = latest.options.resume ?? latest.navigation?.resume;
                  if (resume) return resume(progress);
                  setMangaReadIntent(progress);
                  latest.openManga(progress.id);
                }
              : undefined,
          download: native && available && source.kind !== "local" ? download : undefined,
        });
        if (!progress && available) {
          actions.push({
            id: `manga:start:${id}`,
            label: t("Start reading"),
            icon: <BookOpen size={16} />,
            run: async () => {
              const mangaId = id.includes("::") ? id : `${source.id}::${id}`;
              const chapters = await resumeChapters(mangaId);
              if (!valid()) return;
              const first = resolveReaderChapters(chapters, { sourceId: source.id })[0];
              if (first) requestMangaChapterRead(mangaId, first.id);
              latest.openManga(mangaId);
            },
          });
        }
        return [...actions, ...(latest.options.extra?.() ?? [])].map((action) => ({
          ...action,
          disabled: action.disabled || latest.options.disabled,
          icon:
            action.icon ??
            (action.id.startsWith("manga:details:") ? (
              <Info size={16} />
            ) : action.id.startsWith("manga:favorite:") ? (
              <UiIcon name={favorite ? "unfavorite" : "favorite"} className="h-4 w-4" />
            ) : action.id.startsWith("manga:resume:") ? (
              <BookOpen size={16} />
            ) : (
              <Download size={16} />
            )),
        }));
      },
    };
  };
  const ref = useContextTarget<T>(target);
  return { ref, target };
}
