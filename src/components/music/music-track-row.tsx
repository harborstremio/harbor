import { useTrackPlaybackState } from "@/lib/music/use-track-playback-state";
import { useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { GripVertical, Heart, LoaderCircle, MoreHorizontal, Pause, Play } from "@/components/icons/music-icons";
import { MusicTrackMenu, useMusicTrackMenuItems } from "./music-track-menu";
import { MusicCardBadgeChip, type MusicCardBadge } from "@/components/music/music-cover-card";
import { Poster } from "@/components/poster";
import { useT } from "@/lib/i18n";
import type { MusicTrack } from "@/lib/music/types";
import { toggleMusicLiked, toggleMusicPlayback } from "@/lib/music/player";
import { useMusicTrackLiked } from "@/lib/music/use-track-liked";
import { MusicMediaBadge } from "./music-media-badge";
import { MusicArtistLink } from "./music-artist-link";
import { MusicTrackLabels } from "./music-track-labels";
import { MusicTrackPlaylistChip } from "./music-playlist-chip";
import "./music-like-burst.css";
import "./music-track-row.css";

const ROW_LIKE_SPOKES = [0, 45, 90, 135, 180, 225, 270, 315];

export function MusicTrackRowHandle({ label }: { label: string }) {
  return (
    <span
      title={label}
      className="grid h-11 w-6 shrink-0 cursor-grab place-items-center text-ink-subtle opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-within:opacity-100 group-data-[menu-open]:opacity-100"
    >
      <GripVertical size={14} aria-hidden="true" />
    </span>
  );
}

export function MusicTrackRow({
  track,
  badge,
  index,
  leading,
  onPlay,
  onOpen,
  onAddToQueue,
  onAddToPlaylist,
  onGoToArtist,
  onGoToAlbum,
  onMoreLikeThis,
  liked,
  onToggleFavorite,
  saveable = true,
  showDuration = false,
  nowPlaying = false,
  loading = false,
  paused = false,
  className = "",
}: {
  track: MusicTrack;
  badge?: MusicCardBadge | null;
  index?: number;
  leading?: ReactNode;
  onPlay: () => void;
  onOpen?: () => void;
  onAddToQueue?: () => void;
  onAddToPlaylist?: () => void;
  onGoToArtist?: () => void;
  onGoToAlbum?: () => void;
  onMoreLikeThis?: () => void;
  liked?: boolean;
  onToggleFavorite?: () => void;
  saveable?: boolean;
  showDuration?: boolean;
  nowPlaying?: boolean;
  loading?: boolean;
  paused?: boolean;
  className?: string;
}) {
  const t = useT();
  const status = useTrackPlaybackState(track);
  loading = loading || status.loading;
  nowPlaying = nowPlaying || status.current;
  paused = paused || status.paused;
  const tracked = useMusicTrackLiked(track);
  const saved = liked ?? tracked;
  const rowBadge = badge?.kind === "connector" ? { ...badge, itemId: track.id } : badge;
  const save = onToggleFavorite ?? (() => toggleMusicLiked(track));
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [burst, setBurst] = useState(0);
  const seed = `track:${track.connectorId ?? ""}:${track.sourceId ?? track.id}`;

  const items = useMusicTrackMenuItems(track, {
    onPlay,
    onAddToQueue,
    onAddToPlaylist,
    onGoToArtist,
    onGoToAlbum,
    onMoreLikeThis,
  });

  const openMenu = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
  };

  return (
    <div
      data-now-playing-track={nowPlaying || undefined}
      data-menu-open={open || undefined}
      aria-current={nowPlaying ? "true" : undefined}
      className={`group relative flex h-14 min-w-0 items-center ${nowPlaying ? "rounded-md bg-elevated" : open ? "bg-elevated" : ""} ${className}`}
    >
      {leading ??
        (typeof index === "number" ? (
          <span className="w-6 shrink-0 font-mono text-[9px] text-ink-subtle">
            {String(index).padStart(2, "0")}
          </span>
        ) : null)}
      <div onContextMenu={openMenu} className="music-track-details flex h-14 min-w-0 flex-1 items-center text-start">
        <button
          type="button"
          onClick={nowPlaying ? toggleMusicPlayback : onPlay}
          aria-label={
            nowPlaying
              ? t(paused ? "music.play" : "music.pause")
              : t("music.playTrack", { title: track.title, artist: track.artist })
          }
          className="music-track-cover relative block size-14 shrink-0 overflow-hidden rounded-[4px] bg-elevated"
        >
          <Poster
            src={track.artwork}
            seed={seed}
            ratio="square"
            className="w-full [--poster-radius:0px]"
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 grid place-items-center bg-canvas/55 text-ink opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-within:opacity-100 group-data-[menu-open]:opacity-100"
            >
              <span className="music-track-cover-symbol grid size-8 place-items-center text-ink/85">
                {nowPlaying && !paused ? <Pause size={18} /> : <Play size={18} />}
              </span>
            </span>
          </Poster>
          {loading && (
            <span
              aria-hidden="true"
              className="absolute inset-0 grid place-items-center bg-black/45"
            >
              <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" />
            </span>
          )}
          {nowPlaying && !loading && (
            <span
              aria-hidden="true"
              data-paused={paused || undefined}
              className="music-eq absolute inset-0 grid place-items-center bg-black/45 group-hover:opacity-0"
            >
              <span className="music-eq-bars">
                <i />
                <i />
                <i />
                <i />
              </span>
            </span>
          )}
        </button>
        <span className="music-track-title flex min-w-0 flex-1 flex-col ps-3">
          <span className="flex min-w-0 items-center gap-[5px]">
            <button
              type="button"
              onClick={onOpen ?? onPlay}
              className="min-w-0 flex-1 truncate text-start text-[13px] font-semibold text-ink"
              title={track.title}
            >
              {track.title}
            </button>
            {showDuration && rowBadge && <MusicCardBadgeChip badge={rowBadge} />}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <MusicArtistLink
              name={track.artist}
              track={track}
              className="text-[13px] text-ink-subtle"
            />
            <MusicTrackPlaylistChip track={track} />
          </span>
        </span>
        {!showDuration && (
          <span className="music-track-badges ms-2 inline-flex shrink-0 items-center gap-[5px]">
            {rowBadge && <MusicCardBadgeChip badge={rowBadge} />}
            <MusicMediaBadge kind={track.mediaKind} compact />
            <MusicTrackLabels track={track} />
          </span>
        )}
      </div>
      {showDuration && (
        <span data-music-duration className="ms-4 inline-flex shrink-0 items-center gap-3 text-xs tabular-nums text-ink-muted">
          <MusicTrackLabels track={track} />
          <MusicMediaBadge kind={track.mediaKind} compact />
          <span>{track.durationLabel}</span>
        </span>
      )}
      {saveable && (
        <button
          type="button"
          data-like-burst
          data-burst={burst || undefined}
          onClick={(event) => {
            event.stopPropagation();
            setBurst((count) => saved ? 0 : count + 1);
            save();
          }}
          aria-pressed={saved}
          aria-label={t(saved ? "music.unsaveTrack" : "music.saveTrack")}
          title={t(saved ? "music.unsaveTrack" : "music.saveTrack")}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition-[color,background-color,opacity] duration-200 ease-out hover:bg-elevated ${saved ? "text-accent opacity-100" : "text-ink-subtle opacity-0 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 group-data-[menu-open]:opacity-100"}`}
        >
          <Heart size={16} fill={saved ? "currentColor" : "none"} aria-hidden="true" />
          {burst > 0 && saved && (
            <span key={burst} className="dock-like-burst" aria-hidden="true" onAnimationEnd={(event) => {
              if (event.animationName === "dock-like-ring") setBurst(0);
            }}>
              <span className="dock-like-ring" />
              {ROW_LIKE_SPOKES.map((rotate, index) => (
                <span
                  key={index}
                  className="dock-like-dot"
                  style={
                    {
                      "--rotate": `${rotate}deg`,
                      "--translate-y": index % 2 ? "-16px" : "-21px",
                    } as CSSProperties
                  }
                />
              ))}
            </span>
          )}
        </button>
      )}
      <button
        ref={anchorRef}
        type="button"
        onClick={openMenu}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("music.card.moreActions", { title: track.title })}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-subtle opacity-0 transition-[color,background-color,opacity] duration-200 ease-out hover:bg-elevated hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 group-data-[menu-open]:opacity-100"
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      <MusicTrackMenu
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        items={items}
      />
    </div>
  );
}
