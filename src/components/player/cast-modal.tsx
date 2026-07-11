import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { useQueue } from "@/lib/queue";
import type { PlayEpisode } from "@/lib/view";
import { ChevronLeft, ListVideo, Search, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { EpisodePicker } from "./cast-modal/episode-picker";
import { ExitConfirm, SKIP_EXIT_CONFIRM_KEY } from "./cast-modal/exit-confirm";
import { GenreBackdrop } from "./cast-modal/genre-backdrop";
import { GenrePanel } from "./cast-modal/genre-panel";
import { PersonPanel } from "./cast-modal/person-panel";
import { QueuePanel } from "./cast-modal/queue-panel";
import { SearchPanel } from "./cast-modal/search-panel";
import { TitlePanel } from "./cast-modal/title-panel";

type StackView =
  | { kind: "title"; meta: Meta }
  | { kind: "person"; id: number; name: string }
  | { kind: "search" }
  | { kind: "queue" }
  | { kind: "episodes"; meta: Meta; imdbId: string | null }
  | { kind: "genre"; name: string; genreId?: number; mediaType: "movie" | "tv" };

export function CastModal({
  open,
  onClose,
  meta,
  tmdbKey,
  onOpenDetail,
  onPlay,
  currentEpisode,
}: {
  open: boolean;
  onClose: () => void;
  meta: Meta;
  tmdbKey: string | null;
  onOpenDetail?: (m: Meta) => void;
  onPlay?: (m: Meta, episode?: PlayEpisode) => void;
  currentEpisode?: PlayEpisode | null;
}) {
  const t = useT();
  const queue = useQueue();
  const [stack, setStack] = useState<StackView[]>([{ kind: "title", meta }]);

  useEffect(() => {
    if (open) setStack([{ kind: "title", meta }]);
  }, [open, meta]);

  const [confirmTarget, setConfirmTarget] = useState<Meta | null>(null);
  useEffect(() => {
    if (open) setConfirmTarget(null);
  }, [open, meta]);

  const [activeGenre, setActiveGenre] = useState<{ id: number; mediaType: "movie" | "tv" } | null>(null);
  const reportGenre = useCallback((id: number, mt: "movie" | "tv") => setActiveGenre({ id, mediaType: mt }), []);

  const view = stack[stack.length - 1];
  const canBack = stack.length > 1;
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  const openTitle = (m: Meta) => setStack((s) => [...s, { kind: "title", meta: m }]);
  const openPerson = (id: number, name: string) => setStack((s) => [...s, { kind: "person", id, name }]);
  const openSearch = () => setStack((s) => (s[s.length - 1].kind === "search" ? s : [...s, { kind: "search" }]));
  const openQueueView = () => setStack((s) => (s[s.length - 1].kind === "queue" ? s : [...s, { kind: "queue" }]));
  const openEpisodes = (m: Meta, id: string | null) =>
    setStack((s) => [...s, { kind: "episodes", meta: m, imdbId: id }]);
  const openGenre = (name: string, genreId: number, mediaType: "movie" | "tv") => {
    setActiveGenre({ id: genreId, mediaType });
    setStack((s) => [...s, { kind: "genre", name, genreId, mediaType }]);
  };
  const play = (m: Meta, episode?: PlayEpisode) => {
    if (onPlay) onPlay(m, episode);
  };

  const requestExit = (m: Meta) => {
    if (!onOpenDetail) return;
    let skip = false;
    try {
      skip = localStorage.getItem(SKIP_EXIT_CONFIRM_KEY) === "1";
    } catch {
      skip = false;
    }
    if (skip) onOpenDetail(m);
    else setConfirmTarget(m);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      if (confirmTarget) setConfirmTarget(null);
      else if (stack.length > 1) back();
      else onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, stack.length, onClose, confirmTarget]);

  const headerRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState<number>();
  useLayoutEffect(() => {
    if (!open) return;
    const body = bodyRef.current;
    if (!body) return;
    const recompute = () => {
      const headerH = headerRef.current?.offsetHeight ?? 56;
      const maxH = window.innerHeight * 0.88;
      setCardHeight(Math.min(body.scrollHeight + headerH, maxH));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(body);
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [open]);

  if (!open) return null;

  const backdrop = [...stack].reverse().find((v) => v.kind === "title")?.meta.background;

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-[60] flex items-center justify-center bg-black/70 p-6 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !confirmTarget) onClose();
      }}
    >
      <div
        style={cardHeight ? { height: cardHeight } : undefined}
        className={`relative flex max-h-[88vh] w-[72vw] min-w-0 max-w-6xl flex-col overflow-hidden rounded-[18px] bg-neutral-950/75 ring-1 ring-white/10 shadow-[0_44px_120px_-32px_rgba(0,0,0,0.9)] backdrop-blur-2xl transition-[height,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] animate-in zoom-in-95 fade-in ${confirmTarget ? "pointer-events-none opacity-0" : ""}`}
      >
        {view.kind === "genre" ? (
          <GenreBackdrop
            genreId={activeGenre?.id ?? view.genreId}
            mediaType={activeGenre?.mediaType ?? view.mediaType}
            tmdbKey={tmdbKey}
          />
        ) : backdrop ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-72">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-40"
              style={{ backgroundImage: `url(${backdrop})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/30 via-neutral-950/70 to-neutral-950" />
          </div>
        ) : null}

        <header ref={headerRef} className="relative z-10 flex shrink-0 items-center justify-between gap-3 px-5 py-3.5">
          {canBack ? (
            <button
              type="button"
              onClick={back}
              className="flex items-center gap-1 rounded-full py-1.5 pl-2 pr-3.5 text-[13px] font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ChevronLeft size={18} strokeWidth={2.3} />
              {t("Back")}
            </button>
          ) : (
            <span className="pl-1 text-[11px] font-bold uppercase tracking-[0.28em] text-white/45">
              {t("About this title")}
            </span>
          )}
          <div className="flex shrink-0 items-center gap-1.5">
            {view.kind !== "queue" && (
              <button
                type="button"
                onClick={openQueueView}
                className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                aria-label={t("Queue")}
              >
                <ListVideo size={19} strokeWidth={2.2} />
                {queue.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-1 text-[10.5px] font-bold text-black">
                    {queue.length}
                  </span>
                )}
              </button>
            )}
            {view.kind !== "search" && (
              <button
                type="button"
                onClick={openSearch}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                aria-label={t("Search")}
              >
                <Search size={18} strokeWidth={2.2} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              aria-label={t("Close")}
            >
              <X size={18} strokeWidth={2.2} />
            </button>
          </div>
        </header>

        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div ref={bodyRef}>
            <div
              key={
                view.kind === "title"
                  ? `t:${view.meta.id}`
                  : view.kind === "person"
                    ? `p:${view.id}`
                    : view.kind === "episodes"
                      ? `e:${view.meta.id}`
                      : view.kind === "genre"
                        ? `g:${view.name}:${view.mediaType}`
                        : view.kind === "queue"
                          ? "queue"
                          : "search"
              }
              className="animate-in fade-in duration-200"
            >
              {view.kind === "title" ? (
                <TitlePanel
                  meta={view.meta}
                  tmdbKey={tmdbKey}
                  onOpenPerson={openPerson}
                  onOpenTitle={openTitle}
                  onOpenDetail={requestExit}
                  onPlay={onPlay ? play : undefined}
                  onOpenEpisodes={openEpisodes}
                  onOpenGenre={openGenre}
                />
              ) : view.kind === "genre" ? (
                <GenrePanel
                  genreName={view.name}
                  genreId={view.genreId}
                  mediaType={view.mediaType}
                  tmdbKey={tmdbKey}
                  onOpenTitle={openTitle}
                  onActiveGenre={reportGenre}
                />
              ) : view.kind === "person" ? (
                <PersonPanel personId={view.id} name={view.name} tmdbKey={tmdbKey} onOpenTitle={openTitle} />
              ) : view.kind === "episodes" ? (
                <EpisodePicker meta={view.meta} imdbId={view.imdbId} onPlayEpisode={(ep) => play(view.meta, ep)} />
              ) : view.kind === "queue" ? (
                <QueuePanel onPlay={play} currentMeta={meta} currentEpisode={currentEpisode} />
              ) : (
                <SearchPanel tmdbKey={tmdbKey} onOpenTitle={openTitle} onOpenPerson={openPerson} />
              )}
            </div>
          </div>
        </div>
      </div>

      {confirmTarget && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 p-6 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmTarget(null);
          }}
        >
          <ExitConfirm
            onCancel={() => setConfirmTarget(null)}
            onConfirm={(remember) => {
              if (remember) {
                try {
                  localStorage.setItem(SKIP_EXIT_CONFIRM_KEY, "1");
                } catch {
                  /* ignore */
                }
              }
              const target = confirmTarget;
              setConfirmTarget(null);
              onOpenDetail?.(target);
            }}
          />
        </div>
      )}
    </div>
  );
}
