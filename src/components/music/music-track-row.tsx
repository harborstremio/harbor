import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import { GripVertical, Heart, LoaderCircle, MoreHorizontal, Pause, Play } from "lucide-react";
import { MusicTrackMenu, useMusicTrackMenuItems } from "./music-track-menu";
import { MusicCardBadgeChip, type MusicCardBadge } from "@/components/music/music-cover-card";
import { Poster } from "@/components/poster";
import { useT } from "@/lib/i18n";
import type { MusicTrack } from "@/lib/music/types";
import { toggleMusicPlayback } from "@/lib/music/player";
import { MusicQualityBadge } from "./music-quality-badge";
import { MusicMediaBadge } from "./music-media-badge";
import { MusicArtistLink } from "./music-artist-link";
import { MusicTrackLabels } from "./music-track-labels";
import { MusicTrackPlaylistChip } from "./music-playlist-chip";

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
  onAddToQueue,
  onAddToPlaylist,
  onGoToArtist,
  onGoToAlbum,
  onMoreLikeThis,
  liked = false,
  onToggleFavorite,
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
  onAddToQueue?: () => void;
  onAddToPlaylist?: () => void;
  onGoToArtist?: () => void;
  onGoToAlbum?: () => void;
  onMoreLikeThis?: () => void;
  liked?: boolean;
  onToggleFavorite?: () => void;
  showDuration?: boolean;
  nowPlaying?: boolean;
  loading?: boolean;
  paused?: boolean;
  className?: string;
}) {
  const t = useT();
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
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
      <div onContextMenu={openMenu} className="flex h-14 min-w-0 flex-1 items-center text-start">
        <button
          type="button"
          onClick={nowPlaying ? toggleMusicPlayback : onPlay}
          aria-label={
            nowPlaying
              ? t(paused ? "music.play" : "music.pause")
              : t("music.playTrack", { title: track.title, artist: track.artist })
          }
          className="relative block size-14 shrink-0 overflow-hidden rounded-[4px] bg-elevated"
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
              {nowPlaying && !paused ? (
                <Pause size={16} fill="currentColor" />
              ) : (
                <Play size={16} fill="currentColor" />
              )}
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
        <span className="flex min-w-0 flex-col ps-3">
          <span className="flex min-w-0 items-center gap-[5px]">
            <button
              type="button"
              onClick={onPlay}
              className="truncate text-start text-[13px] font-semibold text-ink"
              title={track.title}
            >
              {track.title}
            </button>
            {badge && <MusicCardBadgeChip badge={badge} />}
            <MusicMediaBadge kind={track.mediaKind} compact />
            <MusicTrackLabels track={track} />
            <MusicQualityBadge track={track} />
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
      </div>
      {showDuration && (
        <span className="ms-4 shrink-0 text-xs tabular-nums text-ink-muted">
          {track.durationLabel}
        </span>
      )}
      {onToggleFavorite && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
          aria-pressed={liked}
          aria-label={t(liked ? "music.unsaveTrack" : "music.saveTrack")}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition-[color,background-color,opacity] duration-200 ease-out hover:bg-elevated ${liked ? "text-accent opacity-100" : "text-ink-subtle opacity-0 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 group-data-[menu-open]:opacity-100"}`}
        >
          <Heart size={16} fill={liked ? "currentColor" : "none"} aria-hidden="true" />
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
