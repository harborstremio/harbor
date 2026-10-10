import { useMusicSourceRequest, musicSourceRequestMatches } from "@/lib/music/source-request";
import type { PlaylistView } from "@/lib/music/playlist-filters";
import { MusicTrackRowsSkeleton } from "./music-skeletons";
import { useMusicTrackMenuItems } from "./music-track-menu";
import { requestMusicExplore } from "@/lib/music/navigation";
import { HoverTooltip } from "@/components/hover-tooltip";
import { likedIdsFor } from "@/lib/music/liked";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { MusicVirtualTrackList } from "./music-virtual-track-list";
import {
  FileDown,
  PlaylistVariation,
  PlaylistRename,
  Trash2,
  ChevronDown,
  ChevronUp,
  Heart,
  MoreHorizontal,
  Plus,
  X,
} from "@/components/icons/music-icons";
import { AnchoredMenu } from "@/components/anchored-menu";
import { Spinner } from "@/components/spinner";
import { useSectionBack } from "@/lib/section-back";
import { MusicPlaylistCover } from "./music-playlist-cover";
import { MusicCollectionControls } from "./music-collection-controls";
import { MusicArtistLink } from "./music-artist-link";
import { MusicMediaBadge } from "./music-media-badge";
import { MusicTrackLabels } from "./music-track-labels";
import { useMusicPlaylistPicker } from "./music-playlist-picker";
import { useMusicSourcePicker } from "./music-source-picker";
import { useT } from "@/lib/i18n";
import { LoaderCircle } from "@/components/icons/music-icons";
import { nowPlayingMatches } from "@/lib/music/now-playing-key";
import "./music-like-burst.css";

const ROW_LIKE_SPOKES = [0, 45, 90, 135, 180, 225, 270, 315];
import { addTracksToMusicPlaylist, createMusicPlaylist } from "@/lib/music/library";
import { recordMusicPlaylistPlayback } from "@/lib/music/playback-origin";
import { useMusicNowPlaying } from "@/lib/music/use-now-playing";
import { deleteMusicPlaylist, renameMusicPlaylist } from "@/lib/music/library";
import { getMusicState, enqueueMusic, toggleMusicLiked } from "@/lib/music/player";
import type { MusicPlaylist, MusicTrack } from "@/lib/music/types";

export function LibraryTrackList({
  title,
  subtitle,
  tracks,
  order = tracks,
  likedIds,
  onAdd,
  onRemove,
  onMove,
  selectedPlaylist,
  emptyCopy,
  filtering = false,
  filterKey,
  showControls = true,
  onPlay: onPlayOverride,
  view,
}: {
  title: string;
  subtitle: string;
  view?: PlaylistView;
  tracks: MusicTrack[];
  order?: MusicTrack[];
  likedIds: string[];
  onAdd?: (track: MusicTrack) => void;
  onRemove?: (track: MusicTrack) => void;
  onMove?: (track: MusicTrack, toIndex: number) => void;
  selectedPlaylist: MusicPlaylist | null;
  emptyCopy?: string;
  filtering?: boolean;
  filterKey?: string;
  showControls?: boolean;
  onPlay?: (track: MusicTrack, queue: MusicTrack[]) => void;
}) {
  const t = useT();
  const now = useMusicNowPlaying();
  const sourceRequest = useMusicSourceRequest();
  const resultsRef = useRef<HTMLDivElement>(null);
  const [slowFilter, setSlowFilter] = useState(false);
  useEffect(() => {
    if (!filtering) { setSlowFilter(false); return; }
    const timer = setTimeout(() => setSlowFilter(true), 180);
    return () => clearTimeout(timer);
  }, [filtering]);
  useEffect(() => {
    if (filterKey === undefined || filtering || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = resultsRef.current?.animate(
      [{ opacity: 0.45, transform: "translateY(3px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 160, easing: "cubic-bezier(.2,.7,.3,1)" },
    );
    return () => animation?.cancel();
  }, [filterKey, filtering]);
  const play = (track: MusicTrack, queue: MusicTrack[]) => {
    if (onPlayOverride) { onPlayOverride(track, queue); return; }
    recordMusicPlaylistPlayback(selectedPlaylist, queue);
    openSourcePicker(track, queue);
  };
  const { openSourcePicker } = useMusicSourcePicker();
  const positions = useMemo(() => new Map(order.map((track, index) => [track.id, index])), [order]);
  const added = useMemo(() => new Set(selectedPlaylist?.tracks.map((track) => track.id)), [selectedPlaylist?.tracks]);
  const liked = useMemo(() => new Set(likedIds), [likedIds]);
  const keys = useMemo(() => tracks.map(track => track.id), [tracks]);
  const renderRow = (displayIndex: number) => {
    const track = tracks[displayIndex];
    const playing = nowPlayingMatches(now, track);
    return <LibraryTrack
      key={track.id}
      track={track}
      tracks={tracks}
      index={positions.get(track.id) ?? 0}
      displayIndex={view ? displayIndex : undefined}
      showAlbum={Boolean(view)}
      count={order.length}
      liked={likedIdsFor(track).some(id => liked.has(id))}
      alreadyAdded={added.has(track.id)}
      onAdd={onAdd}
      onRemove={onRemove}
      onMove={onMove}
      onPlay={play}
      nowPlaying={playing}
      loading={musicSourceRequestMatches(sourceRequest, track) || (playing && now.phase === "resolving")}
    />;
  };
  return (
    <section className="music-library-tracklist" data-playlist-view={view} aria-busy={filtering}>
      {(title || subtitle || showControls) && <div className="music-library-tracklist-header">
        <div>
          {title && <h3>{title}</h3>}
          {subtitle && <p>{subtitle}</p>}
        </div>
        {showControls && (!onAdd && !onRemove && tracks.length > 0 ? (
          <MusicCollectionControls tracks={tracks} onPlay={play} />
        ) : (
          <span>{tracks.length}</span>
        ))}
      </div>}
      {view && tracks.length > 0 && <div className="music-playlist-columns" aria-hidden="true">
        <span>#</span><span>{t("music.playlistTools.title")}</span><span className="music-playlist-album">{t("music.playlistTools.album")}</span><span /><span>{t("music.sort.duration")}</span><span />
      </div>}
      <div ref={resultsRef} style={{ position: "relative" }}>
      <div inert={filtering} style={{ visibility: slowFilter && filtering ? "hidden" : undefined }}>
      {tracks.length ? (
        tracks.length > 100
          ? <MusicVirtualTrackList keys={keys} compact={view === "compact"} renderRow={renderRow} />
          : <div>{tracks.map((_, index) => renderRow(index))}</div>
      ) : (
        <p className="music-library-empty">{emptyCopy ?? t("music.library.saveEmpty")}</p>
      )}
      </div>
      {slowFilter && filtering && <div style={{ position: "absolute", inset: 0 }}>
        <MusicTrackRowsSkeleton rows={Math.max(1, Math.min(tracks.length || order.length, 6))} />
      </div>}
      </div>
    </section>
  );
}

function LibraryTrack({
  track,
  tracks,
  index,
  count,
  liked,
  alreadyAdded,
  onAdd,
  onRemove,
  onMove,
  onPlay,
  nowPlaying = false,
  loading = false,
  displayIndex,
  showAlbum,
}: {
  track: MusicTrack;
  tracks: MusicTrack[];
  index: number;
  count: number;
  liked: boolean;
  alreadyAdded: boolean;
  onAdd?: (track: MusicTrack) => void;
  onRemove?: (track: MusicTrack) => void;
  onMove?: (track: MusicTrack, toIndex: number) => void;
  onPlay?: (track: MusicTrack, queue: MusicTrack[]) => void;
  nowPlaying?: boolean;
  loading?: boolean;
  displayIndex?: number;
  showAlbum?: boolean;
}) {
  const t = useT();
  const { openSourcePicker } = useMusicSourcePicker();
  const { openPlaylistPicker } = useMusicPlaylistPicker();
  const shared = useMusicTrackMenuItems(track, {
    onPlay: () => start(track, tracks),
    onAddToQueue: () => enqueueMusic(track),
    onAddToPlaylist: () => openPlaylistPicker(track),
    onMoreLikeThis: () => requestMusicExplore({ kind: "similar", track }),
  });
  const anchor = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  const bindMenu = useCallback((node: HTMLDivElement | null) => {
    menu.current = node;
    node?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, []);
  const start = (item: MusicTrack, queue: MusicTrack[]) => {
    if (onPlay) {
      onPlay(item, queue);
      return;
    }
    recordMusicPlaylistPlayback(null);
    openSourcePicker(item, queue);
  };
  const [open, setOpen] = useState(false);
  const [burst, setBurst] = useState(0);
  const close = () => {
    if (menu.current?.contains(document.activeElement)) anchor.current?.focus();
    setOpen(false);
  };
  const actions = [
    ...shared,
    {
      label: t(liked ? "music.unsaveTrack" : "music.saveTrack"),
      icon: <Heart size={16} fill={liked ? "currentColor" : "none"} />,
      run: () => toggleMusicLiked(track),
    },
    ...(onAdd
      ? [
          {
            label: t(alreadyAdded ? "music.playlist.alreadyAdded" : "music.playlist.add"),
            icon: <Plus size={16} />,
            disabled: alreadyAdded,
            run: () => onAdd(track),
          },
        ]
      : []),
    ...(onMove
      ? [
          {
            label: t("music.playlist.moveUp", { title: track.title }),
            icon: <ChevronUp size={16} />,
            disabled: index === 0,
            run: () => onMove(track, index - 1),
          },
          {
            label: t("music.playlist.moveDown", { title: track.title }),
            icon: <ChevronDown size={16} />,
            disabled: index === count - 1,
            run: () => onMove(track, index + 1),
          },
        ]
      : []),
    ...(onRemove
      ? [{ label: t("music.playlist.remove"), icon: <X size={16} />, run: () => onRemove(track) }]
      : []),
  ];
  return (
    <div
      className="music-library-track"
      data-library-track={track.id}
      data-now-playing={nowPlaying || undefined}
      data-menu-open={open || undefined}
      aria-current={nowPlaying ? "true" : undefined}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setOpen(true);
      }}
    >
      <span className="music-library-track-number">{String((displayIndex ?? index) + 1).padStart(2, "0")}</span>
      <div className="music-library-track-play">
        <button
          type="button"
          className="music-library-track-art"
          onClick={() => start(track, tracks)}
          aria-label={t("music.playTrack", { title: track.title, artist: track.artist })}
        >
          <MusicPlaylistCover artwork={[track.artwork]} seed={track.id} />
          {loading && (
            <span aria-hidden="true" className="music-library-track-state">
              <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" />
            </span>
          )}
          {nowPlaying && !loading && (
            <span aria-hidden="true" className="music-library-track-state music-eq">
              <span className="music-eq-bars">
                <i />
                <i />
                <i />
                <i />
              </span>
            </span>
          )}
        </button>
        <span className="music-library-track-copy">
          <button
            type="button"
            onClick={() => start(track, tracks)}
            className="text-start truncate"
          >
            <strong>{track.title}</strong>
          </button>
          <span className="flex min-w-0 items-center gap-2">
            <MusicTrackLabels track={track} />
            <MusicArtistLink
              name={track.artist}
              track={track}
              className="truncate text-xs text-ink-muted"
            />
            <MusicMediaBadge kind={track.mediaKind} compact />
          </span>
        </span>
      </div>
      {showAlbum && <span className="music-playlist-album" title={track.album}>{track.album || "—"}</span>}
      <button
        type="button"
        className="music-library-track-save"
        data-like-burst
        data-burst={burst || undefined}
        data-saved={liked || undefined}
        aria-pressed={liked}
        aria-label={t(liked ? "music.unsaveTrack" : "music.saveTrack")}
        title={t(liked ? "music.unsaveTrack" : "music.saveTrack")}
        onClick={() => {
          if (!liked) setBurst((count) => count + 1);
          toggleMusicLiked(track);
        }}
      >
        <Heart size={16} fill={liked ? "currentColor" : "none"} aria-hidden="true" />
        {burst > 0 && liked && (
          <span key={burst} className="dock-like-burst" aria-hidden="true">
            <span className="dock-like-ring" />
            {ROW_LIKE_SPOKES.map((rotate, index) => (
              <span
                key={index}
                className="dock-like-dot"
                style={
                  {
                    "--rotate": `${rotate}deg`,
                    "--translate-y": index % 2 ? "-14px" : "-18px",
                  } as CSSProperties
                }
              />
            ))}
          </span>
        )}
      </button>
      <span className="music-library-track-duration">{track.durationLabel}</span>
      <button
        type="button"
        ref={anchor}
        className="music-library-track-more"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("music.card.moreActions", { title: track.title })}
        onClick={() => setOpen(true)}
      >
        <MoreHorizontal size={18} />
      </button>
      <AnchoredMenu anchorRef={anchor} open={open} onClose={close} width={260}>
        <div
          role="menu"
          ref={bindMenu}
          onKeyDown={(event) => {
            const buttons = [
              ...(menu.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []),
            ];
            const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              event.stopPropagation();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? buttons.length - 1
                    : (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) %
                      buttons.length;
              buttons[next]?.focus();
            } else if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              close();
            } else if (event.key === "Tab") close();
          }}
          className="music-library-track-menu harbor-float rounded-md bg-elevated p-1 ring-1 ring-edge-soft"
        >
          {actions.map((action, actionIndex) => (
            <button
              key={actionIndex}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={"disabled" in action && action.disabled}
              onClick={() => {
                close();
                action.run();
              }}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      </AnchoredMenu>
    </div>
  );
}

/** Rename and delete for the playlist currently open in the library. */
export function PlaylistHeader({
  playlist,
  working,
  onRenamed,
  onDeleted,
  onError,
  onExport,
  playbackTracks,
}: {
  playbackTracks?: MusicTrack[];
  playlist: MusicPlaylist;
  working: boolean;
  onRenamed: (playlist: MusicPlaylist) => void;
  onDeleted: (playlistId: string) => void;
  onExport: () => void;
  onError: (message: string | null) => void;
}) {
  const t = useT();
  const [cloning, setCloning] = useState(false);
  const [asking, setAsking] = useState(false);
  const likeButton = useRef<HTMLButtonElement | null>(null);
  const likeMenu = useRef<HTMLDivElement | null>(null), clonePending = useRef(false);
  const closeLikeMenu = useCallback(() => {
    setAsking(false);
    requestAnimationFrame(() => likeButton.current?.focus({ preventScroll: true }));
  }, []);
  useSectionBack(closeLikeMenu, asking);
  useEffect(() => {
    if (!asking) return;
    const frame = requestAnimationFrame(() => likeMenu.current?.querySelector<HTMLButtonElement>("button")?.focus());
    return () => cancelAnimationFrame(frame);
  }, [asking]);
  const cloneLikeThis = async (freshOnly: boolean) => {
    if (clonePending.current || working || !playlist.tracks.length) return;
    clonePending.current = true;
    setAsking(false);
    setCloning(true);
    onError(null);
    try {
      const { loadPlaylistLikeThis } = await import("@/lib/music/radio");
      const heard = freshOnly ? getMusicState().recents : [];
      const mix = await loadPlaylistLikeThis(playlist.tracks, undefined, heard);
      const made = await createMusicPlaylist(
        t("music.playlist.likeThisName", { name: playlist.name }),
      );
      const built = mix.length ? await addTracksToMusicPlaylist(made.id, mix) : made;
      onRenamed(built);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      onError(message === "music.radio.error" ? t(message) : message);
    } finally {
      clonePending.current = false;
      setCloning(false);
      requestAnimationFrame(() => { if (document.activeElement === document.body) likeButton.current?.focus({ preventScroll: true }); });
    }
  };
  // Stored tracks may carry no playbackUrl, so playing goes through the picker rather than
  // straight to the engine.
  const { openSourcePicker } = useMusicSourcePicker();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(playlist.name);
  const [busy, setBusy] = useState(false);
  const renameButton = useRef<HTMLButtonElement>(null);
  const cancelRename = () => {
    setName(playlist.name);
    setRenaming(false);
    requestAnimationFrame(() => renameButton.current?.focus());
  };

  useEffect(() => {
    setName(playlist.name);
    setRenaming(false);
  }, [playlist.id, playlist.name]);

  const commit = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === playlist.name) {
      setRenaming(false);
      return;
    }
    setBusy(true);
    onError(null);
    try {
      onRenamed(await renameMusicPlaylist(playlist.id, trimmed));
      setRenaming(false);
      requestAnimationFrame(() => renameButton.current?.focus());
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(t("music.playlist.deleteConfirm"))) return;
    setBusy(true);
    onError(null);
    try {
      await deleteMusicPlaylist(playlist.id);
      onDeleted(playlist.id);
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="music-library-playlist-heading">
      {renaming ? (
        <form
          className="music-library-create w-full"
          onSubmit={(event) => {
            event.preventDefault();
            void commit();
          }}
        >
          <input
            autoFocus
            value={name}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                cancelRename();
              }
            }}
            aria-label={t("music.playlist.nameLabel")}
            className="min-h-11 w-full min-w-0 rounded-md bg-elevated px-3 py-2 text-[15px] text-ink"
          />
          <button type="submit" className="music-library-button" disabled={busy || !name.trim()}>
            {t("common.save")}
          </button>
          <button
            type="button"
            className="music-library-text"
            disabled={busy}
            onClick={cancelRename}
          >
            {t("common.cancel")}
          </button>
        </form>
      ) : (
        <h3>{playlist.name}</h3>
      )}
      <div className="music-playlist-commands">
        <MusicCollectionControls
          tracks={playbackTracks ?? playlist.tracks}
          onPlay={(track, queue) => {
            recordMusicPlaylistPlayback(playlist, queue);
            openSourcePicker(track, queue);
          }}
          disabled={working || busy}
        />
        <HoverTooltip label={t(cloning ? "music.playlist.likeThisWorking" : "music.playlist.likeThis")} side="top" align="center">
        <button
          ref={likeButton}
          type="button"
          aria-haspopup="menu"
          aria-expanded={asking}
          aria-busy={cloning}
          aria-label={t(cloning ? "music.playlist.likeThisWorking" : "music.playlist.likeThis")}
          disabled={working || busy || cloning || playlist.tracks.length === 0}
          onClick={() => setAsking(true)}
          className="grid size-11 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
        >
          {cloning ? <Spinner size={25}/> : <PlaylistVariation size={30} />}
        </button>
        </HoverTooltip>
        <AnchoredMenu
          anchorRef={likeButton}
          open={asking}
          onClose={closeLikeMenu}
          width={264}
        >
          <div role="menu" aria-label={t("music.playlist.likeThisAsk")} ref={likeMenu} className="music-like-this-ask harbor-float" onKeyDown={event => {
            const buttons = [...(likeMenu.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
            const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
              event.preventDefault(); event.stopPropagation();
              buttons[event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
            } else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeLikeMenu(); }
            else if (event.key === "Tab") setAsking(false);
          }}>
            <p>{t("music.playlist.likeThisAsk")}</p>
            <button type="button" role="menuitem" onClick={() => void cloneLikeThis(true)}>
              {t("music.playlist.likeThisFresh")}
            </button>
            <button type="button" role="menuitem" onClick={() => void cloneLikeThis(false)}>
              {t("music.playlist.likeThisHeard")}
            </button>
          </div>
        </AnchoredMenu>
        <HoverTooltip label={t("music.playlist.rename")} side="top" align="center">
        <button
          type="button"
          aria-label={t("music.playlist.rename")}
          ref={renameButton}
          disabled={working || busy}
          onClick={() => setRenaming(true)}
          className="grid size-11 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
        >
          <PlaylistRename size={26} />
        </button>
        </HoverTooltip>
        <HoverTooltip label={t("music.playlist.delete")} side="top" align="center">
        <button
          type="button"
          aria-label={t("music.playlist.delete")}
          disabled={working || busy}
          onClick={() => void remove()}
          className="grid size-11 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:text-danger focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
        >
          <Trash2 size={26} />
        </button>
        </HoverTooltip>
        <HoverTooltip label={t("music.m3u.export")} side="top" align="center">
          <button
            type="button"
            aria-label={t("music.m3u.export")}
            disabled={working || busy || !playlist.tracks.length}
            onClick={onExport}
            className="grid size-11 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
          >
            <FileDown size={26} />
          </button>
        </HoverTooltip>
      </div>
      {cloning && <p className="music-playlist-build-status" role="status">{t("music.playlist.likeThisWorking")}</p>}
    </div>
  );
}
