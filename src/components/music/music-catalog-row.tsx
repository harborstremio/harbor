import { MusicNowPlayingMark } from "./music-now-playing-mark";
import { Fragment, type MouseEvent, type ReactNode } from "react";
import { Play } from "@/components/icons/music-icons";
import { MusicArtistCard } from "@/components/music/music-artist-card";
import { useMusicItemMenu } from "@/components/music/music-item-menu";
import { useMusicCatalogPlayback } from "./use-music-catalog-playback";
import {
  coverCardSeed,
  coverCardSubtitle,
  coverCardTitle,
  MusicCardBadgeChip,
  MusicCoverCard,
  type MusicCardBadge,
} from "@/components/music/music-cover-card";
import { MusicPlaylistCover } from "@/components/music/music-playlist-cover";
import { albumExplicitMarks } from "@/lib/music/album-explicit";
import {
  MusicSectionConnectCard,
  MusicSectionEmpty,
  MusicSectionError,
  MusicSectionHead,
  MusicTrackGrid,
  type MusicSectionConnect,
  type MusicSectionStatus,
} from "@/components/music/music-track-grid";
import { Poster } from "@/components/poster";
import { Row } from "@/components/row";
import { useT } from "@/lib/i18n";
import type {
  MusicArtistRef,
  MusicCatalogItem,
  MusicCatalogRow as MusicCatalogRowData,
} from "@/lib/music/types";

export const MUSIC_SHELF_MIN = 160;

import { sourceLabel } from "@/lib/music/source-label";
export { sourceLabel } from "@/lib/music/source-label";

type TrackItem = Extract<MusicCatalogItem, { kind: "track" }>;
type ArtistItem = Extract<MusicCatalogItem, { kind: "artist" }>;

function defaultBadge(item: MusicCatalogItem): MusicCardBadge | undefined {
  if (item.kind === "track" && item.connectorId) {
    return { kind: "connector", connectorId: item.connectorId, itemId: item.id };
  }
  return undefined;
}

function CoverSkeleton({ circle = false }: { circle?: boolean }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-2.5">
      <div
        className={`aspect-square w-full bg-elevated/40 ${circle ? "rounded-full" : "rounded-md"}`}
      />
      <div className={`flex h-9 flex-col gap-1.5 ${circle ? "items-center" : ""}`}>
        <div className="h-3 w-3/5 rounded bg-elevated/35" />
        <div className="h-3 w-2/5 rounded bg-elevated/25" />
      </div>
    </div>
  );
}

function WideFeature({
  item,
  badge,
  subtitle,
  onPlay,
  onOpen,
  onMenu,
}: {
  item: MusicCatalogItem;
  badge?: MusicCardBadge | null;
  subtitle?: string;
  onPlay?: () => void;
  onOpen?: () => void;
  onMenu?: (event: MouseEvent<HTMLElement>) => void;
}) {
  const t = useT();
  const heading = coverCardTitle(item);
  const caption = subtitle ?? coverCardSubtitle(item);
  const seed = coverCardSeed(item);
  const activate = onOpen ?? onPlay;
  const label = !onOpen && onPlay
    ? item.kind === "track"
      ? t("music.playTrack", { title: heading, artist: caption })
      : t("music.card.playItem", { title: heading })
    : t("music.card.openItem", { title: heading });

  return (
    <div
      onContextMenu={onMenu}
      className="music-top-result group relative flex w-full min-w-0 items-center gap-6 rounded-xl border border-edge-soft bg-surface p-5 text-start"
    >
      <button type="button" onClick={activate} aria-label={label} className="absolute inset-0 rounded-xl" />
      <span className="pointer-events-none relative block w-[168px] shrink-0 overflow-hidden rounded-md">
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
      </span>
      <span className="pointer-events-none relative flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-[5px]">
          <span
            className="truncate font-semibold text-[22px] leading-tight tracking-tight text-ink"
            title={heading}
          >
            {heading}
          </span>
          {badge && <MusicCardBadgeChip badge={badge} />}
        </span>
        {caption && (
          <span className="mt-1.5 truncate text-[13px] text-ink-subtle" title={caption}>
            {caption}
          </span>
        )}
        {onPlay && (
          <button
            type="button"
            onClick={onPlay}
            aria-label={t("music.card.playItem", { title: heading })}
            className="pointer-events-auto mt-5 inline-flex h-11 w-fit items-center gap-2 rounded-full bg-ink px-5 text-[12px] font-semibold text-canvas transition-transform duration-200 ease-out hover:scale-[1.02] motion-reduce:transform-none"
          >
            <Play size={14} fill="currentColor" />
            {t("music.play")}
          </button>
        )}
      </span>
    </div>
  );
}


export function MusicCatalogRow({
  row,
  status = "ready",
  error,
  onRetry,
  connect,
  sourceName,
  titleVars,
  min = MUSIC_SHELF_MIN,
  count,
  emptyLabel,
  leadingCard,
  badgeFor,
  artistArtwork,
  artistSubtitle,
  numbered,
  onPlay,
  onOpen,
  onMenu,
  onViewAll,
  playable = true,
  playingItemId,
  liveItemId,
  viewAllLabel,
  titleLogo,
  grid = false,
  onEndReached,
  className = "",
}: {
  row: MusicCatalogRowData;
  status?: MusicSectionStatus;
  error?: string;
  onRetry?: () => void;
  connect?: MusicSectionConnect | null;
  sourceName?: string;
  titleVars?: Record<string, string | number>;
  min?: number;
  count?: number;
  emptyLabel?: string;
  leadingCard?: ReactNode;
  badgeFor?: (item: MusicCatalogItem, index: number) => MusicCardBadge | null | undefined;
  artistArtwork?: (artist: MusicArtistRef) => readonly (string | null | undefined)[];
  artistSubtitle?: (artist: MusicArtistRef) => string | undefined;
  numbered?: boolean;
  onPlay?: (item: MusicCatalogItem, index: number) => void;
  onOpen?: (item: MusicCatalogItem, index: number) => void;
  onMenu?: (item: MusicCatalogItem, event: MouseEvent<HTMLElement>) => void;
  onViewAll?: () => void;
  playable?: boolean;
  playingItemId?: string | null;
  liveItemId?: string | null;
  viewAllLabel?: string;
  titleLogo?: ReactNode;
  grid?: boolean;
  onEndReached?: () => void;
  className?: string;
}) {
  const t = useT();
  const playback = useMusicCatalogPlayback();
  const play = onPlay ?? ((item: MusicCatalogItem) => { void playback.play(item, row.items, row.id); });
  const itemMenu = useMusicItemMenu({
    onPlay: onPlay || playable || row.layout === "trackGrid" || row.layout === "wide" ? play : undefined,
    onOpen,
  });
  const openMenu = (item: MusicCatalogItem, index: number, event: MouseEvent<HTMLElement>) => {
    if (onMenu) {
      onMenu(item, event);
      return;
    }
    itemMenu.open(item, index, event);
  };
  const heading = row.titleLiteral ? row.title : t(row.title, titleVars);
  const rawSubtitle = row.subtitle
    ? row.titleLiteral
      ? row.subtitle
      : t(row.subtitle, titleVars)
    : "";
  const provider = sourceLabel(row.source, sourceName);
  const caption = !provider
    ? rawSubtitle
    : !rawSubtitle
      ? provider
      : rawSubtitle.includes(provider)
        ? rawSubtitle
        : `${rawSubtitle} · ${provider}`;
  const badgeAt = (item: MusicCatalogItem, index: number) =>
    badgeFor ? badgeFor(item, index) : defaultBadge(item);

  if (row.layout === "trackGrid") {
    const tracks = row.items.filter((item): item is TrackItem => item.kind === "track");
    return (
      <MusicTrackGrid
        title={heading}
        subtitle={caption}
        tracks={tracks}
        status={status}
        error={error}
        onRetry={onRetry}
        connect={connect}
        numbered={numbered}
        count={count ?? 9}
        emptyLabel={emptyLabel}
        badgeFor={(_track, index) => badgeAt(tracks[index], index)}
        onPlay={(_track, index) => play(tracks[index], index)}
        onOpen={onOpen && ((_track, index) => onOpen(tracks[index], index))}
        onViewAll={onViewAll}
        viewAllLabel={viewAllLabel}
        className={className}
      />
    );
  }

  const cellMin = Math.min(min, MUSIC_SHELF_MIN);
  const circles = row.layout === "circles";
  const artists = circles
    ? row.items.filter((item): item is ArtistItem => item.kind === "artist")
    : [];
  const items: MusicCatalogItem[] = circles ? artists : [...row.items];
  const visible = count ? items.slice(0, count) : items;
  const skeletonCount = count ?? 8;

  if (connect || status === "error" || (status === "ready" && visible.length === 0)) {
    return (
      <section className={`flex min-w-0 flex-col gap-5 ps-[9px] ${className}`}>
        <MusicSectionHead
          title={heading}
          subtitle={caption}
          onViewAll={onViewAll}
          viewAllLabel={viewAllLabel}
        />
        {connect ? (
          <MusicSectionConnectCard connect={connect} />
        ) : status === "error" ? (
          <MusicSectionError message={error} onRetry={onRetry} />
        ) : (
          <MusicSectionEmpty label={emptyLabel} />
        )}
      </section>
    );
  }

  if (row.layout === "wide") {
    const feature = visible[0];
    return (
      <section className={`flex min-w-0 flex-col gap-5 ps-[9px] ${className}`}>
        <MusicSectionHead
          title={heading}
          subtitle={caption}
          onViewAll={onViewAll}
          viewAllLabel={viewAllLabel}
        />
        {status === "loading" || !feature ? (
          <div className="min-h-[168px] rounded-xl bg-elevated/30" />
        ) : (
          <WideFeature
            item={feature}
            badge={badgeAt(feature, 0)}
            onPlay={() => play(feature, 0)}
            onOpen={onOpen && (() => onOpen(feature, 0))}
            onMenu={(event) => openMenu(feature, 0, event)}
          />
        )}
        {playback.error && <p role="alert" className="text-[13px] text-ink-muted">{playback.error}</p>}
        {itemMenu.menu}
      </section>
    );
  }

  const head = (
    <span className="flex min-w-0 items-center gap-2.5">
      {titleLogo && <span className="grid shrink-0 place-items-center">{titleLogo}</span>}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[17px] font-medium tracking-tight text-ink">{heading}</span>
        {caption && (
          <span className="truncate text-[12px] font-medium text-ink-subtle">{caption}</span>
        )}
      </span>
    </span>
  );

  if (status === "loading") {
    return (
      <Row
        title={head}
        shape="square"
        min={cellMin}
        scrollKey={`music:${row.id}`}
        className={className}
        alwaysActive
      >
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <CoverSkeleton key={index} circle={circles} />
        ))}
      </Row>
    );
  }

  // Over every loaded item, not the visible slice: a clean/explicit pair split by the
  // cut would otherwise leave the clean one unlabelled.
  const explicitMarks = albumExplicitMarks(items);
  const cards: ReactNode[] = visible.map((item, index) =>
    item.kind === "artist" ? (
      <MusicArtistCard
        key={`${coverCardSeed(item)}:${index}`}
        artist={item}
        albumArtwork={artistArtwork?.(item)}
        subtitle={artistSubtitle?.(item)}
        onPlay={onPlay && (() => play(item, index))}
        onOpen={onOpen && (() => onOpen(item, index))}
        onMenu={(event) => openMenu(item, index, event)}
      />
    ) : (
      <MusicCoverCard
        key={`${coverCardSeed(item)}:${index}`}
        item={item}
        badge={badgeAt(item, index)}
        explicitMark={explicitMarks.get(item.id) ?? null}
        onPlay={onPlay || playable ? () => play(item, index) : undefined}
        playing={playingItemId === item.id || (playback.pending?.id === item.id && playback.pending?.connectorId === item.connectorId)}
        onOpen={onOpen && (() => onOpen(item, index))}
        onMenu={(event) => openMenu(item, index, event)}
        overlay={(() => {
          if (item.kind === "track") return undefined;
          const pending =
            playback.pending?.id === item.id &&
            playback.pending?.connectorId === item.connectorId;
          if (!pending && liveItemId !== item.id) return undefined;
          return <MusicNowPlayingMark loading={pending} />;
        })()}
      />
    ),
  );

  const body = grid ? (
    <section className={`flex min-w-0 flex-col gap-4 ${className}`}>
      {head}
      <div
        className="grid gap-x-5 gap-y-7"
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${cellMin}px, 1fr))` }}
      >
        {leadingCard ? [<Fragment key="music-row-lead">{leadingCard}</Fragment>, ...cards] : cards}
      </div>
    </section>
  ) : (
    <Row
      title={head}
      shape="square"
      min={cellMin}
      scrollKey={`music:${row.id}`}
      onViewAll={onViewAll}
      viewAllLabel={viewAllLabel ?? "music.row.viewAll"}
      onEndReached={onEndReached}
      className={className}
    >
      {leadingCard ? [<Fragment key="music-row-lead">{leadingCard}</Fragment>, ...cards] : cards}
    </Row>
  );

  return (
    <>
      {body}
      {playback.error && <p role="alert" className="px-[9px] text-[13px] text-ink-muted">{playback.error}</p>}
      {itemMenu.menu}
    </>
  );
}
