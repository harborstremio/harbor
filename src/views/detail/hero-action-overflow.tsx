import { ArrowDownToLine, Bookmark, Check, MoreHorizontal, Pause, Play, RotateCw, Star, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { Meta } from "@/lib/cinemeta";
import { activeDownloadFor, cancelDownload, pauseDownload, resumeDownload, useDownloads } from "@/lib/download/downloads-store";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { AnilistMenuItems, SimklMenuItems, TraktMenuItems } from "./overflow-sync-items";
import { PreviewIcon } from "./preview-icon";

const CIRCLES_SAVED_ESTIMATE = 132;

export function useHeroActionOverflow(rowRef: RefObject<HTMLDivElement | null>, deps: unknown[]) {
  const [stage, setStage] = useState(0);
  const stageRef = useRef(0);
  const widthsRef = useRef<[number, number]>([0, 0]);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const section = row.closest("section");
    const measure = () => {
      const r = rowRef.current;
      const sec = r?.closest("section");
      if (!r || !sec) return;
      const rowRect = r.getBoundingClientRect();
      const corner = sec.querySelector("[data-hero-awards]");
      const secRect = sec.getBoundingClientRect();
      const rightLimit = corner ? corner.getBoundingClientRect().left : secRect.right - 40;
      const available = rightLimit - rowRect.left - 16;
      const cur = stageRef.current;
      if (cur === 0) widthsRef.current[0] = r.scrollWidth;
      if (cur === 1) widthsRef.current[1] = r.scrollWidth;
      const w0 = widthsRef.current[0];
      const w1 = widthsRef.current[1] || (w0 ? Math.max(0, w0 - CIRCLES_SAVED_ESTIMATE) : 0);
      const next = w0 === 0 || w0 <= available ? 0 : w1 <= available ? 1 : 2;
      if (next !== stageRef.current) {
        stageRef.current = next;
        setStage(next);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    if (section) ro.observe(section);
    const mo = new MutationObserver(measure);
    if (section) mo.observe(section, { childList: true, subtree: true });
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, deps);

  return stage;
}

export function HeroActionOverflow({
  meta,
  isFav,
  onToggleFavorite,
  hasTrailer,
  onTrailer,
  canDownload,
  showWatched = false,
  onWatched,
  watchedMark = false,
  showSync = false,
  inWatchlist = false,
  onToggleWatchlist,
  simkl = null,
  anilist = null,
}: {
  meta: Meta;
  isFav: boolean;
  onToggleFavorite: () => void;
  hasTrailer: boolean;
  onTrailer: () => void;
  canDownload: boolean;
  showWatched?: boolean;
  onWatched?: () => void;
  watchedMark?: boolean;
  showSync?: boolean;
  inWatchlist?: boolean;
  onToggleWatchlist?: () => void;
  simkl?: { harborId: string; type: "movie" | "series" } | null;
  anilist?: { harborId: string } | null;
}) {
  const t = useT();
  const { openPicker } = useView();
  useDownloads();
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const dl = canDownload ? activeDownloadFor(meta.id, null, null) : null;
  const downloading = dl?.status === "downloading";
  const paused = dl?.status === "paused";
  const done = dl?.status === "done";
  const failed = dl?.status === "error";
  const pct = Math.round((dl?.ratio ?? 0) * 100);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  const openMenu = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setMenu({
      x: Math.max(8, Math.min(r.left, window.innerWidth - 240)),
      y: Math.min(r.bottom + 8, window.innerHeight - 160),
    });
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={t("More actions")}
        title={t("More")}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => (menu ? setMenu(null) : openMenu())}
        className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-edge bg-canvas/80 text-ink transition-[transform,background-color,border-color] duration-200 hover:border-ink-subtle hover:bg-canvas/95 active:scale-[0.94]"
      >
        <MoreHorizontal size={20} strokeWidth={1.9} />
        {isFav && <span className="absolute end-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-accent" />}
      </button>
      {menu &&
        createPortal(
          <div
            role="menu"
            style={{ left: menu.x, top: menu.y }}
            onMouseDown={(e) => e.stopPropagation()}
            className="fixed z-[320] flex max-h-[min(70vh,480px)] w-[224px] flex-col overflow-y-auto rounded-xl border border-edge bg-elevated p-1 shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)] animate-popover-in"
          >
            {showSync && (
              <>
                <Item
                  icon={
                    inWatchlist ? (
                      <Check size={14} strokeWidth={2.4} />
                    ) : (
                      <Bookmark size={14} strokeWidth={2} />
                    )
                  }
                  label={inWatchlist ? t("In Watchlist") : t("Add to Watchlist")}
                  active={inWatchlist}
                  onClick={() => {
                    onToggleWatchlist?.();
                    setMenu(null);
                  }}
                />
                {simkl && (
                  <SimklMenuItems
                    harborId={simkl.harborId}
                    type={simkl.type}
                    onAction={() => setMenu(null)}
                  />
                )}
                {anilist && (
                  <AnilistMenuItems harborId={anilist.harborId} onAction={() => setMenu(null)} />
                )}
                <TraktMenuItems
                  harborId={meta.id}
                  type={meta.type === "series" ? "series" : "movie"}
                  onAction={() => setMenu(null)}
                />
                <div className="my-1 h-px bg-edge-soft" />
              </>
            )}
            <Item
              icon={
                <Star
                  size={14}
                  strokeWidth={isFav ? 0 : 2}
                  fill={isFav ? "currentColor" : "none"}
                />
              }
              label={isFav ? t("Favorited") : t("Favorite")}
              active={isFav}
              onClick={() => {
                onToggleFavorite();
                setMenu(null);
              }}
            />
            {showWatched && (
              <Item
                icon={<Check size={14} strokeWidth={2.4} />}
                label={watchedMark ? t("Marked watched") : t("Mark watched")}
                active={watchedMark}
                onClick={() => {
                  onWatched?.();
                  setMenu(null);
                }}
              />
            )}
            {hasTrailer && (
              <Item
                icon={<PreviewIcon size={14} />}
                label={t("Watch trailer")}
                onClick={() => {
                  onTrailer();
                  setMenu(null);
                }}
              />
            )}
            {canDownload && (
              <>
                {downloading ? (
                  <Item
                    icon={<Pause size={14} strokeWidth={2.2} />}
                    label={t("Downloading {pct}%  ·  pause", { pct })}
                    onClick={() => {
                      if (dl) pauseDownload(dl.id);
                      setMenu(null);
                    }}
                  />
                ) : paused ? (
                  <Item
                    icon={<Play size={14} strokeWidth={2.2} />}
                    label={t("Paused  ·  resume")}
                    onClick={() => {
                      if (dl) void resumeDownload(dl.id);
                      setMenu(null);
                    }}
                  />
                ) : (
                  <Item
                    icon={
                      done ? (
                        <Check size={14} strokeWidth={2.4} />
                      ) : failed ? (
                        <RotateCw size={14} strokeWidth={2.2} />
                      ) : (
                        <ArrowDownToLine size={14} strokeWidth={2} />
                      )
                    }
                    label={
                      done
                        ? t("Saved offline")
                        : failed
                          ? t("Retry download")
                          : t("Download for offline")
                    }
                    active={done}
                    onClick={() => {
                      openPicker(meta, undefined, { intent: "download" });
                      setMenu(null);
                    }}
                  />
                )}
                {downloading && (
                  <Item
                    icon={<X size={14} strokeWidth={2.2} />}
                    label={t("Cancel download")}
                    onClick={() => {
                      if (dl) cancelDownload(dl.id);
                      setMenu(null);
                    }}
                  />
                )}
                {paused && (
                  <Item
                    icon={<X size={14} strokeWidth={2.2} />}
                    label={t("Cancel download")}
                    onClick={() => {
                      if (dl) cancelDownload(dl.id);
                      setMenu(null);
                    }}
                  />
                )}
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

function Item({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`flex h-9 items-center gap-2.5 rounded-lg px-3 text-start text-[13px] transition-colors hover:bg-raised ${
        active ? "text-accent" : "text-ink"
      }`}
    >
      <span className={active ? "text-accent" : "text-ink-muted"}>{icon}</span>
      {label}
    </button>
  );
}
