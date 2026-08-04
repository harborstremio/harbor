import { useEffect, useMemo, useState } from "react";
import { Bookmark, BookmarkPlus, Check, Trash2 } from "lucide-react";
import { useMobileRemote } from "../mobile-remote";
import { useRegisterSheet } from "../mobile-sheet-lock";
import { SHEET_EXIT_CSS, useSheetDrag, useSheetPresence } from "../remote-extras";
import { useReducedMotion } from "@/lib/use-reduced-motion";

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function BookmarksSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { snapshot, sendCommand } = useMobileRemote();
  const manga = snapshot.manga;
  const reduce = useReducedMotion();
  const { render, leaving } = useSheetPresence(open);
  const { handleProps, panelStyle } = useSheetDrag(onClose);
  useRegisterSheet(open);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) setSaved(false);
  }, [open]);

  const chapterIds = useMemo(
    () => new Set((manga?.chapters ?? []).map((c) => c.id)),
    [manga?.chapters],
  );

  if (!render || !manga) return null;
  const bookmarks = manga.bookmarks ?? [];
  const spreadNums = (manga.spread ?? []).filter((n) => n > 0).sort((a, b) => a - b);
  const isSpread = (manga.mode === "book" || manga.mode === "double") && spreadNums.length >= 2;

  const add = (page?: number) => {
    if (
      sendCommand(page != null ? { action: "mangaBookmark", page } : { action: "mangaBookmark" })
    ) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1400);
    }
  };
  const jump = (id: string) => {
    sendCommand({ action: "mangaJumpBookmark", id });
    onClose();
  };
  const remove = (id: string) => sendCommand({ action: "mangaBookmarkRemove", id });

  return (
    <div
      className={`fixed inset-0 z-[70] flex flex-col justify-end bg-black/60 backdrop-blur-sm ${leaving ? "harbor-sheet-scrim-out" : reduce ? "" : "animate-fade-in"}`}
      onClick={onClose}
    >
      <style>{SHEET_EXIT_CSS}</style>
      <div
        className={`flex max-h-[78vh] flex-col rounded-t-[28px] border-t border-edge-soft/60 bg-elevated ${leaving ? "harbor-sheet-panel-out" : reduce ? "" : "animate-in slide-in-from-bottom-4 duration-300"}`}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)", ...panelStyle }}
        onClick={(e) => e.stopPropagation()}
      >
        <div {...handleProps} className="shrink-0 cursor-grab touch-none active:cursor-grabbing">
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-ink/20" />
          <div className="flex items-center gap-2 px-5 pb-3 pt-4">
            <Bookmark size={18} className="text-accent" />
            <h3 className="text-[16px] font-semibold text-ink">Bookmarks</h3>
            <span className="ms-auto text-[12px] tabular-nums text-ink-subtle">
              {bookmarks.length}
            </span>
          </div>
        </div>

        {isSpread ? (
          <div className="mx-4 mb-3 flex flex-col gap-2">
            {saved ? (
              <div className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-accent-soft text-[15px] font-semibold text-accent">
                <Check size={18} strokeWidth={2.6} /> Saved
              </div>
            ) : (
              <>
                <span className="px-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
                  Bookmark which page
                </span>
                <div className="flex gap-2">
                  {spreadNums.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => add(n)}
                      className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-accent text-[15px] font-semibold text-canvas transition-transform active:scale-[0.97]"
                    >
                      <BookmarkPlus size={17} strokeWidth={2.2} /> Page {n}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => add()}
            className={`mx-4 mb-3 flex h-12 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold transition-colors ${saved ? "bg-accent-soft text-accent" : "bg-accent text-canvas active:opacity-90"}`}
          >
            {saved ? (
              <Check size={18} strokeWidth={2.6} />
            ) : (
              <BookmarkPlus size={18} strokeWidth={2.2} />
            )}
            {saved ? "Saved" : `Bookmark page ${manga.pageIndex + 1}`}
          </button>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3">
          {bookmarks.length === 0 ? (
            <p className="px-3 py-10 text-center text-[14px] leading-relaxed text-ink-muted">
              No bookmarks yet. Save your spot with the button above.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {bookmarks.map((bm) => {
                const missing = chapterIds.size > 0 && !chapterIds.has(bm.chapterId);
                return (
                  <div
                    key={bm.id}
                    className="flex items-center gap-1 rounded-2xl px-1 active:bg-raised/40"
                  >
                    <button
                      type="button"
                      disabled={missing}
                      onClick={() => jump(bm.id)}
                      className={`flex min-h-12 min-w-0 flex-1 flex-col justify-center px-3 py-2 text-start ${missing ? "opacity-50" : ""}`}
                    >
                      <span className="truncate text-[15px] font-medium text-ink">{bm.name}</span>
                      <span className="truncate text-[12.5px] text-ink-subtle">
                        {missing ? "Not in this source" : `${bm.chapterLabel} · page ${bm.page}`}
                        <span className="text-ink-subtle/70"> · {timeAgo(bm.createdAt)}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(bm.id)}
                      aria-label="Remove bookmark"
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-subtle transition-colors active:bg-raised active:text-danger"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
