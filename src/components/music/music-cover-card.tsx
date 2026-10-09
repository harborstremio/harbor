import type { MouseEvent, ReactNode } from "react";
import { LoaderCircle, Play, Radio } from "@/components/icons/music-icons";
import { MusicPlaylistCover } from "@/components/music/music-playlist-cover";
import { Poster } from "@/components/poster";
import { useT } from "@/lib/i18n";
import { MusicMediaBadge } from "./music-media-badge";
import { MusicArtistLink } from "./music-artist-link";
import { HoverTooltip } from "@/components/hover-tooltip";
import { sourceLabel } from "@/lib/music/source-label";
import type { AlbumExplicitMark } from "@/lib/music/album-explicit";
import type { MusicCatalogItem } from "@/lib/music/types";
import "./music-cover-card.css";
import { useTrackPlaybackState } from "@/lib/music/use-track-playback-state";
import { MusicNowPlayingMark } from "./music-now-playing-mark";

export type MusicCardBadge =
  | { kind: "connector"; connectorId: string; label?: string; itemId?: string }
  | { kind: "trackCount"; count: number }
  | { kind: "playCount"; count: number }
  | { kind: "station" };

const CONNECTOR_GLYPH: Record<string, string> = {
  spotify: "S",
  soundcloud: "SC",
  youtube: "YT",
  youtubemusic: "YT",
  "youtube-music": "YT",
  youtube_music: "YT",
  local: "L",
  direct: "D",
  plex: "PX",
  jellyfin: "JF",
  navidrome: "ND",
  subsonic: "SS",
  lastfm: "FM",
  "last-fm": "FM",
  listenbrainz: "LB",
  bandcamp: "BC",
  deezer: "DZ",
  tidal: "TD",
  apple: "AM",
  applemusic: "AM",
};

export function connectorGlyph(connectorId: string): string {
  const key = connectorId.trim().toLowerCase();
  if (!key) return "";
  return CONNECTOR_GLYPH[key] ?? key.slice(0, 2).toUpperCase();
}

function compactCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "";
  if (count < 1000) return String(Math.round(count));
  if (count < 1000000) return `${Math.round(count / 100) / 10}k`;
  return `${Math.round(count / 100000) / 10}m`;
}

export function MusicCardBadgeChip({ badge }: { badge: MusicCardBadge }) {
  const t = useT();
  const base =
    "grid h-4 min-w-4 shrink-0 place-items-center rounded-[4px] px-[3px] text-[9px] font-extrabold leading-none";

  if (badge.kind === "station") {
    return (
      <span className={`${base} bg-accent-soft text-ink`} title={t("music.row.stationBadge")}>
        <Radio size={10} aria-hidden="true" />
      </span>
    );
  }

  if (badge.kind === "connector") {
    const glyph = badge.label ?? connectorGlyph(badge.connectorId);
    if (!glyph) return null;
    const service = badge.connectorId === "catalog" ? badge.itemId?.split(":")[0] ?? "catalog" : badge.connectorId;
    const label = badge.label ?? sourceLabel(service);
    return (
      <HoverTooltip label={label} side="top" align="center" className="inline-flex shrink-0">
        <span aria-label={label} data-music-source={service} className={`${base} bg-accent-soft text-ink`}>
          {glyph}
        </span>
      </HoverTooltip>
    );
  }

  const label = compactCount(badge.count);
  if (!label) return null;
  const tone = badge.kind === "playCount" ? "text-ink" : "text-ink-muted";
  const title =
    badge.kind === "playCount"
      ? t("music.card.playCount", { count: badge.count })
      : t("music.card.trackCount", { count: badge.count });
  return (
    <span className={`${base} bg-elevated ${tone}`} title={title}>
      {label}
    </span>
  );
}

export function coverCardTitle(item: MusicCatalogItem): string {
  return item.kind === "track" || item.kind === "album" ? item.title : item.name;
}

export function coverCardSubtitle(item: MusicCatalogItem): string {
  if (item.kind === "track" || item.kind === "album") return item.artist;
  return item.subtitle ?? "";
}

export function coverCardSeed(item: MusicCatalogItem): string {
  return `${item.kind}:${item.connectorId ?? ""}:${item.id}`;
}

function autoBadge(item: MusicCatalogItem): MusicCardBadge | null {
  if (item.kind === "station") return { kind: "station" };
  if (item.kind === "album" && typeof item.trackCount === "number") {
    return { kind: "trackCount", count: item.trackCount };
  }
  if (item.kind === "playlist" && typeof item.trackCount === "number") {
    return { kind: "trackCount", count: item.trackCount };
  }
  return null;
}

export function MusicCoverCard({
  item,
  title,
  subtitle,
  badge,
  explicitMark,
  onPlay,
  playing = false,
  onOpen,
  onMenu,
  overlay,
  className = "",
}: {
  item: MusicCatalogItem;
  title?: string;
  subtitle?: string;
  badge?: MusicCardBadge | null;
  explicitMark?: AlbumExplicitMark | null;
  onPlay?: () => void;
  playing?: boolean;
  onOpen?: () => void;
  onMenu?: (event: MouseEvent<HTMLElement>) => void;
  overlay?: ReactNode;
  className?: string;
}) {
  const t = useT();
  const heading = title ?? coverCardTitle(item);
  const status = useTrackPlaybackState(item.kind === "track" ? item : null);
  const loading = playing || status.loading;
  const caption = subtitle ?? coverCardSubtitle(item);
  const seed = coverCardSeed(item);
  const chip = badge === undefined ? autoBadge(item) : badge;
  const activate = onOpen ?? onPlay;
  const playLabel = item.kind === "track"
    ? t("music.playTrack", { title: heading, artist: caption })
    : t("music.card.playItem", { title: heading });
  const label = !onOpen && onPlay ? playLabel : t("music.card.openItem", { title: heading });

  return (
    <div
      className={`music-cover-card group flex w-full min-w-0 flex-col text-start ${className}`}
      onContextMenu={onMenu}
    >
      <div className="relative">
        <button
          type="button"
          onClick={activate}
          aria-label={label}
          className="flex w-full min-w-0 flex-col text-start"
        >
          <span className="relative block w-full overflow-hidden rounded-md">
            {item.kind === "playlist" ? (
              <MusicPlaylistCover artwork={item.artwork} seed={seed} className="rounded-md" />
            ) : (
              <Poster
                src={item.artwork}
                seed={seed}
                ratio="square"
                className="w-full [--poster-radius:0px]"
              />
            )}
            {overlay}
            {item.kind === "track" && (loading || status.current) && <MusicNowPlayingMark loading={loading} paused={status.paused}/>}
          </span>
          <span className="mt-[9px] flex min-w-0 items-center gap-[5px]">
            <span className="truncate text-[13px] font-semibold text-ink" title={heading}>
              {heading}
            </span>
            {chip && <MusicCardBadgeChip badge={chip} />}
            {explicitMark && (
              <span
                data-music-label={explicitMark === "explicit" ? "explicit" : "clean"}
                title={t(`music.label.${explicitMark}`)}
                aria-label={t(`music.label.${explicitMark}`)}
                className="inline-flex shrink-0 items-center rounded-[2px] bg-elevated px-1 py-0.5 text-[9px] font-medium leading-none text-ink-muted"
              >
                {explicitMark === "explicit" ? "E" : t("music.label.clean")}
              </span>
            )}
            {item.kind === "track" && <MusicMediaBadge kind={item.mediaKind} compact />}
          </span>
        </button>
        {onPlay && (
          <div className="pointer-events-none absolute inset-x-0 top-0 aspect-square">
            <button
              type="button"
              className="music-cover-play no-press bg-ink text-canvas"
              aria-label={playLabel}
              aria-busy={loading || undefined}
              disabled={loading}
              onClick={(event) => {
                event.stopPropagation();
                onPlay();
              }}
            >
              {loading ? (
                <LoaderCircle size={20} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
              ) : (
                <Play size={20} aria-hidden="true" />
              )}
            </button>
          </div>
        )}
      </div>
      {caption &&
        (item.kind === "track" || item.kind === "album" ? (
          <MusicArtistLink
            name={item.artist}
            track={item.kind === "track" ? item : undefined}
            className="mt-px text-[13px] text-ink-subtle"
          />
        ) : (
          <span className="mt-px truncate text-[13px] text-ink-subtle" title={caption}>
            {caption}
          </span>
        ))}
    </div>
  );
}
