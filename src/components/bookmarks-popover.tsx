import { Bookmark, BookOpen, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { removeMangaBookmark, useMangaBookmarks, type MangaBookmark } from "@/lib/manga-bookmarks";
import { useT } from "@/lib/i18n";
import { setMangaReadIntent } from "@/lib/manga/read-intent";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";

type T = (key: string) => string;

export function BookmarksButton() {
  const bookmarks = useMangaBookmarks();
  const { settings } = useSettings();
  const { openManga } = useView();
  const { activeId } = useProfiles();
  const pid = activeId ?? "default";
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!settings.mangaEnabled || bookmarks.length === 0) return null;

  const openBookmark = (bookmark: MangaBookmark) => {
    setOpen(false);
    setMangaReadIntent({
      id: bookmark.mangaId,
      title: bookmark.title,
      cover: bookmark.cover,
      sourceId: bookmark.sourceId,
      chapterId: bookmark.chapterId,
      chapterNumber: bookmark.chapterNumber,
      chapterLabel: bookmark.chapterLabel,
      page: bookmark.page,
      totalPages: bookmark.totalPages,
      scroll: 0,
      updatedAt: bookmark.createdAt,
    });
    openManga(bookmark.mangaId);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        aria-label={t("Bookmarks")}
        onClick={() => setOpen((value) => !value)}
        className="harbor-navbtn relative flex h-11 w-11 items-center justify-center rounded-xl bg-elevated/70 text-ink-muted transition-colors duration-150 hover:bg-elevated hover:text-ink"
      >
        <Bookmark size={17} strokeWidth={1.9} />
      </button>
      {open && (
        <div className="absolute end-0 top-[calc(100%+8px)] z-50 w-[20rem] overflow-hidden rounded-2xl border border-edge bg-elevated shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)] animate-popover-in">
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <span className="text-[13.5px] font-semibold text-ink">{t("Bookmarks")}</span>
            <span className="text-[11.5px] font-medium tabular-nums text-ink-subtle">
              {bookmarks.length}
            </span>
          </div>
          <div className="flex max-h-[min(60vh,420px)] flex-col gap-0.5 overflow-y-auto px-2 pb-2">
            {bookmarks.slice(0, 8).map((bookmark) => (
              <BookmarkRow
                key={bookmark.id}
                bookmark={bookmark}
                t={t}
                onOpen={() => openBookmark(bookmark)}
                onRemove={() => removeMangaBookmark(pid, bookmark.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BookmarkRow({
  bookmark,
  t,
  onOpen,
  onRemove,
}: {
  bookmark: MangaBookmark;
  t: T;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="group flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-raised/50">
      <button
        onClick={onOpen}
        title={t("Open manga")}
        className="flex min-w-0 flex-1 items-center gap-3 text-start"
      >
        <span className="flex h-12 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-canvas text-ink-subtle">
          {bookmark.cover ? (
            <img src={bookmark.cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <BookOpen size={15} strokeWidth={1.8} />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[13px] font-medium text-ink">{bookmark.title}</span>
          <span className="truncate text-[11px] text-ink-subtle">{bookmark.name}</span>
        </span>
      </button>
      <button
        aria-label={t("Remove")}
        title={t("Remove")}
        onClick={onRemove}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle opacity-0 transition-all hover:bg-canvas/60 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Trash2 size={14} strokeWidth={2} />
      </button>
    </div>
  );
}
