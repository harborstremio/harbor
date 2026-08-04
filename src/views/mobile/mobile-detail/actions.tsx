import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bookmark, Check, Eye, Film, Monitor, MoreHorizontal, Play } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import type { TmdbDetail } from "@/lib/providers/tmdb";
import type { RemoteLibraryAction, RemoteLibraryItem, RemoteTrackers } from "@/lib/remote/protocol";
import { resolveTrailerId } from "@/lib/trailer";
import { useSettings } from "@/lib/settings";
import { useMobileRemote } from "../mobile-remote";
import { HIDE_SCROLL, prefersReducedMotion } from "./data";
import { MobileTrailerOverlay } from "./trailer";
import { Group, SheetRow } from "./sheet-ui";
import { TrackGroup } from "./track-group";

export function DetailActions({
  meta,
  detail,
  title,
  trailerId,
  onPlay,
}: {
  meta: Meta;
  detail: TmdbDetail | null;
  title: string;
  trailerId: string | null;
  onPlay: () => void;
}) {
  const { settings } = useSettings();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [resolvedTrailer, setResolvedTrailer] = useState<{
    meta: Meta;
    key: string;
    id: string | null;
  } | null>(null);
  const tmdbKey = settings.tmdbKey;

  useEffect(() => {
    if (trailerId || !tmdbKey) return;
    let alive = true;
    resolveTrailerId(meta, tmdbKey)
      .then((id) => {
        if (alive) setResolvedTrailer({ meta, key: tmdbKey, id });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [trailerId, meta, tmdbKey]);

  const trailer =
    trailerId ??
    (resolvedTrailer?.meta === meta && resolvedTrailer.key === tmdbKey ? resolvedTrailer.id : null);

  return (
    <>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onPlay}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-ink text-[15.5px] font-semibold text-canvas shadow-[0_10px_30px_-12px_rgba(0,0,0,0.5)] transition-transform duration-150 active:scale-[0.98] motion-reduce:transition-none"
        >
          <Play size={18} strokeWidth={0} fill="currentColor" />
          Play
        </button>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label="More actions"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-edge-soft bg-surface text-ink transition-transform duration-150 active:scale-[0.94] motion-reduce:transition-none"
        >
          <MoreHorizontal size={20} strokeWidth={2} />
        </button>
      </div>
      {sheetOpen && (
        <ActionsSheet
          meta={meta}
          detail={detail}
          title={title}
          trailerId={trailer}
          onPlayTrailer={() => {
            setSheetOpen(false);
            setTrailerOpen(true);
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}
      {trailerOpen && trailer && (
        <MobileTrailerOverlay id={trailer} title={title} onClose={() => setTrailerOpen(false)} />
      )}
    </>
  );
}

function inList(
  list: RemoteLibraryItem[] | undefined,
  id: string,
  imdbId?: string | null,
): boolean {
  if (!list) return false;
  return list.some((it) => it.id === id || (!!imdbId && it.id === imdbId));
}

function joinAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function syncHint(trackers: RemoteTrackers | undefined): string | undefined {
  if (!trackers) return undefined;
  const names: string[] = [];
  if (trackers.trakt) names.push("Trakt");
  if (trackers.simkl) names.push("Simkl");
  return names.length ? `Syncs to your ${joinAnd(names)}` : undefined;
}

function ActionsSheet({
  meta,
  detail,
  title,
  trailerId,
  onPlayTrailer,
  onClose,
}: {
  meta: Meta;
  detail: TmdbDetail | null;
  title: string;
  trailerId: string | null;
  onPlayTrailer: () => void;
  onClose: () => void;
}) {
  const [reduced] = useState(prefersReducedMotion);
  const { openOnHost, sendCommand, connected, snapshot } = useMobileRemote();
  const poster = meta.poster ?? detail?.poster;
  const imdbId = detail?.imdbId;
  const library = snapshot.library;
  const trackers = snapshot.trackers;

  const online = connected && (!snapshot.idle || !!library || !!trackers);
  const isAnime = /^(kitsu|mal|anilist|anidb):/.test(meta.id);
  const isSeriesLike = meta.type === "series" || detail?.kind === "tv";

  const favBase = inList(library?.favorites, meta.id, imdbId);
  const watchlistBase = inList(library?.watchlist, meta.id, imdbId);
  const historyBase = inList(library?.history, meta.id, imdbId);

  const [favOpt, setFavOpt] = useState<{ base: boolean; value: boolean } | null>(null);
  const [watchlistOpt, setWatchlistOpt] = useState<{ base: boolean; value: boolean } | null>(null);
  const [historyOpt, setHistoryOpt] = useState<{ base: boolean; value: boolean } | null>(null);

  const isFav = favOpt?.base === favBase ? favOpt.value : favBase;
  const inWatchlist = watchlistOpt?.base === watchlistBase ? watchlistOpt.value : watchlistBase;
  const isWatched = historyOpt?.base === historyBase ? historyOpt.value : historyBase;

  const send = (op: RemoteLibraryAction) =>
    sendCommand({
      action: "libraryAction",
      metaId: meta.id,
      metaType: meta.type,
      name: title || meta.name,
      poster,
      imdbId,
      op,
    });

  const sync = online ? syncHint(trackers) : undefined;

  const sheet = (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 ${reduced ? "" : "md-sheet-fade"}`}
      />
      <div
        className={`relative max-h-[82vh] overflow-y-auto rounded-t-3xl bg-canvas ${HIDE_SCROLL} ${
          reduced ? "" : "md-sheet-in"
        }`}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)" }}
      >
        <div className="sticky top-0 z-10 flex flex-col items-center gap-2 bg-canvas pb-2 pt-3">
          <span className="h-1 w-9 rounded-full bg-edge" />
          <p className="max-w-[80%] truncate px-4 text-[13.5px] font-semibold text-ink">{title}</p>
        </div>

        <div className="flex flex-col px-3 pb-1">
          {trailerId && (
            <SheetRow
              icon={<Film size={20} strokeWidth={2} />}
              label="Play trailer"
              onClick={onPlayTrailer}
            />
          )}
          <SheetRow
            icon={<Monitor size={20} strokeWidth={2} />}
            label="Open on computer"
            sublabel="Send this title to your Harbor app"
            onClick={() => {
              onClose();
              openOnHost(meta);
            }}
          />
        </div>

        <Group label="Your library">
          <SheetRow
            icon={<HeartIcon filled={isFav} />}
            label="Favorites"
            sublabel={isFav ? "Saved to your favorites" : "Save to your favorites"}
            active={isFav}
            disabled={!online}
            trailing={
              isFav ? <Check size={18} strokeWidth={2.6} className="text-accent" /> : undefined
            }
            onClick={() => {
              const next = !isFav;
              setFavOpt({ base: favBase, value: next });
              send({ kind: "favorite", on: next });
            }}
          />
          <SheetRow
            icon={
              <Bookmark size={20} strokeWidth={2} fill={inWatchlist ? "currentColor" : "none"} />
            }
            label="Watchlist"
            sublabel={inWatchlist ? "In your watchlist" : "Add to your watchlist"}
            hint={sync}
            active={inWatchlist}
            disabled={!online}
            trailing={
              inWatchlist ? (
                <Check size={18} strokeWidth={2.6} className="text-accent" />
              ) : undefined
            }
            onClick={() => {
              const next = !inWatchlist;
              setWatchlistOpt({ base: watchlistBase, value: next });
              send({ kind: "watchlist", on: next });
            }}
          />
          <SheetRow
            icon={<Eye size={20} strokeWidth={2} />}
            label="Watched"
            sublabel={isWatched ? "Marked as watched" : "Mark as watched"}
            hint={sync}
            active={isWatched}
            disabled={!online}
            trailing={
              isWatched ? <Check size={18} strokeWidth={2.6} className="text-accent" /> : undefined
            }
            onClick={() => {
              const next = !isWatched;
              setHistoryOpt({ base: historyBase, value: next });
              send({ kind: "watched", on: next });
            }}
          />
          {!online && (
            <div className="flex items-center justify-center gap-2 px-6 pb-1 pt-1.5 text-center text-[12px] leading-relaxed text-ink-subtle">
              <Monitor size={14} strokeWidth={2} className="shrink-0" />
              <span>Connect to your computer to manage your library.</span>
            </div>
          )}
        </Group>

        {online && trackers && (
          <TrackGroup
            trackers={trackers}
            isAnime={isAnime}
            isSeriesLike={isSeriesLike}
            reduced={reduced}
            send={send}
          />
        )}
      </div>
    </div>
  );
  return typeof document !== "undefined" ? createPortal(sheet, document.body) : sheet;
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}
