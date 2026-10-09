import { useEffect, useState } from "react";
import { Bookmark, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  addMangaBookmark,
  removeMangaBookmark,
  renameMangaBookmark,
  useMangaBookmarks,
  type MangaBookmark,
} from "@/lib/manga-bookmarks";
import { useProfiles } from "@/lib/profiles";
import { useT } from "@/lib/i18n";

type NewBookmark = Omit<MangaBookmark, "id" | "name" | "createdAt">;

export function BookmarksPanel({
  mangaId,
  current,
  canPick,
  onPickPage,
  onJump,
  onClose,
}: {
  mangaId: string;
  current: NewBookmark;
  canPick: boolean;
  onPickPage: () => void;
  onJump: (bm: MangaBookmark) => void;
  onClose: () => void;
}) {
  const t = useT();
  const { activeId } = useProfiles();
  const pid = activeId ?? "default";
  const bookmarks = useMangaBookmarks(mangaId);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const commit = (id: string) => {
    renameMangaBookmark(pid, id, draft);
    setEditing(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className="animate-fade-in fixed inset-0 z-[94] bg-black/20 backdrop-blur-[1px]"
      />
      <div className="animate-fade-in absolute end-4 top-16 z-[95] flex max-h-[70vh] w-80 flex-col overflow-hidden rounded-2xl border border-edge-soft bg-raised/95 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2 text-[14px] font-semibold text-ink">
          <Bookmark size={16} className="text-accent" />
          {t("Bookmarks")}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-lg text-ink-subtle transition hover:bg-elevated hover:text-ink"
        >
          <X size={16} />
        </button>
      </div>
      <button
        type="button"
        onClick={() => (canPick ? onPickPage() : addMangaBookmark(pid, current))}
        className="mx-3 mb-2 flex items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-[13.5px] font-semibold text-canvas transition-transform active:scale-[0.98]"
      >
        <Plus size={16} />
        {canPick ? t("Choose a page to bookmark") : t("Bookmark this page")}
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {bookmarks.length === 0 ? (
          <p className="px-2 py-6 text-center text-[13px] leading-relaxed text-ink-muted">
            {t("No bookmarks yet. Save your spot with the button above, in any reading mode.")}
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {bookmarks.map((bm) => (
              <div
                key={bm.id}
                className="group flex items-center gap-1.5 rounded-xl px-2 py-2 transition hover:bg-elevated/60"
              >
                {editing === bm.id ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commit(bm.id);
                      if (e.key === "Escape") setEditing(null);
                    }}
                    onBlur={() => commit(bm.id)}
                    className="min-w-0 flex-1 rounded-lg bg-canvas px-2 py-1 text-[13px] text-ink outline-none ring-1 ring-accent/50"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => onJump(bm)}
                    className="flex min-w-0 flex-1 flex-col items-start text-start"
                  >
                    <span className="w-full truncate text-[13px] font-medium text-ink">{bm.name}</span>
                    <span className="text-[11.5px] text-ink-subtle">
                      {bm.chapterLabel} · {t("page {n}", { n: bm.page })}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditing(bm.id);
                    setDraft(bm.name);
                  }}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-subtle opacity-0 transition hover:bg-raised hover:text-ink group-hover:opacity-100"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => removeMangaBookmark(pid, bm.id)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-subtle opacity-0 transition hover:bg-raised hover:text-danger group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}

export function BookmarkPagePicker({
  pages,
  onPick,
  onCancel,
}: {
  pages: number[];
  onPick: (page: number) => void;
  onCancel: () => void;
}) {
  const t = useT();
  return (
    <div className="animate-fade-in fixed inset-0 z-[96] flex flex-col items-center bg-black/50 backdrop-blur-[1px]">
      <div className="mt-24 flex items-center gap-3 rounded-full bg-canvas/90 px-5 py-2.5 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.6)] backdrop-blur-md">
        <Bookmark size={16} className="text-accent" />
        <span className="text-[14px] font-semibold text-ink">{t("Tap the page to bookmark")}</span>
        <button
          type="button"
          onClick={onCancel}
          className="ms-1 text-[13px] font-medium text-ink-subtle transition hover:text-ink"
        >
          {t("Cancel")}
        </button>
      </div>
      <div className="flex w-full max-w-6xl flex-1 items-stretch justify-center gap-6 px-8 py-8">
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            className="group flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl border-2 border-white/25 bg-white/5 transition hover:border-accent hover:bg-accent/15"
          >
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-canvas/85 text-ink shadow-lg transition group-hover:bg-accent group-hover:text-canvas">
              <Plus size={26} />
            </span>
            <span className="text-[15px] font-semibold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]">
              {t("Page {n}", { n: p })}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
