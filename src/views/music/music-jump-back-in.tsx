import { useMusicPlaybackOrigin } from "@/lib/music/playback-origin";
import { useMusicNowPlaying } from "@/lib/music/use-now-playing";
import { MusicNowPlayingMark } from "@/components/music/music-now-playing-mark";
import { jumpBackInPlayingKey } from "@/lib/music/jump-back-in-playing";
import { legacySingleArtist, musicDestinationIdentity, musicRecentContextIdentity, uniqueMusicRecents } from "@/lib/music/recent-identity";
import { useState } from "react";
import { MusicPinnedCover } from "@/components/music/music-pinned-cover";
import { MusicCardBadgeChip } from "@/components/music/music-cover-card";
import { MusicSectionHead } from "@/components/music/music-track-grid";
import { Poster } from "@/components/poster";
import {
  useMusicRecentContexts,
  type MusicRecentContext,
} from "@/lib/music/recent-context";
import {
  useMusicDestinations,
  useMusicDestinationsReady,
  type MusicDestination,
} from "@/lib/music/recent-destinations";
import type { MusicCatalogItem } from "@/lib/music/types";
import type { MusicBand, MusicBandContext } from "./music-band-types";
import "./music-jump-back-in.css";

const TILES = 9;

type Tile = {
  key: string;
  identity: string;
  name: string;
  arts: string[];
  note: string;
  connectorId?: string;
  saved?: boolean;
  surprise?: boolean;
  explicit?: boolean;
  open: () => void;
};

type Translate = MusicBandContext["t"];

/** "catalog" is Harbor's own aggregate, so its chip would read CA and say nothing about origin. */
function named(connectorId: string | undefined): string | undefined {
  return !connectorId || connectorId === "catalog" || connectorId === "local" ? undefined : connectorId;
}

function noteFor(kind: string, t: Translate, artist?: string): string {
  const label = t(`music.jumpBackIn.kind.${kind}`);
  return artist ? `${label} · ${artist}` : label;
}

function JumpBackIn({ ctx, title }: { ctx: MusicBandContext; title: string }) {
  const origin = useMusicPlaybackOrigin();
  const now = useMusicNowPlaying();
  const playingKey = jumpBackInPlayingKey(origin);
  const playingIdentity = origin?.kind === "catalog" && (origin.item.kind === "artist" || origin.item.kind === "album")
    ? musicDestinationIdentity({ kind: origin.item.kind, id: origin.item.id, connectorId: origin.item.connectorId, name: origin.name, artist: "artist" in origin.item ? origin.item.artist : undefined })
    : origin?.kind === "similar" || origin?.kind === "playlist" ? musicRecentContextIdentity(origin) : playingKey;
  const animating = now.phase === "playing" || now.phase === "resolving";
  const contexts = useMusicRecentContexts();
  const destinations = useMusicDestinations();
  const ready = useMusicDestinationsReady();
  const [busy, setBusy] = useState<string | null>(null);
  const t = ctx.t;

  const openContext = (context: MusicRecentContext, key: string) => {
    if (context.kind === "playlist") {
      ctx.openLibrary({ view: "playlists", playlistId: context.id });
      return;
    }
    if (!context.seed) return;
    setBusy(key);
    void ctx.openMix(context).finally(() => setBusy(null));
  };

  const openDestination = (entry: MusicDestination) => {
    if (entry.kind === "liked") {
      ctx.openLibrary({ view: "saved" });
      return;
    }
    const item = entry.item ?? {
      kind: entry.kind,
      id: entry.id,
      connectorId: entry.connectorId ?? "catalog",
      artwork: entry.artwork,
      ...(entry.kind === "artist"
        ? { name: entry.name }
        : { title: entry.name, artist: entry.artist ?? "" }),
    } as MusicCatalogItem;
    ctx.openItem(item, [item]);
  };

  // Everything the listener actually opened, newest first, so the row reads as where they just
  // were rather than a fixed menu.
  const recent: Tile[] = uniqueMusicRecents([
    ...destinations.map((entry) => ({
      key: `${entry.kind}:${entry.id}`,
      identity: musicDestinationIdentity(entry),
      at: entry.at,
      name: entry.name,
      arts: [entry.artwork],
      note: noteFor(entry.kind, t, entry.artist),
      connectorId: named(entry.kind === "liked" ? undefined : entry.connectorId),
      saved: entry.kind === "liked",
      open: () => openDestination(entry),
    })),
    ...contexts.map((context) => ({
      key: `${context.kind}:${context.id}`,
      identity: musicRecentContextIdentity(context),
      at: context.at,
      name: legacySingleArtist(context) ? t("music.madeForYou.namedMix", { name: legacySingleArtist(context)! }) : context.name,
      arts: context.artwork.filter(Boolean),
      surprise: context.kind === "similar" && context.id.startsWith("mix:surprise:"),
      note: noteFor(context.kind === "similar" ? "mix" : "playlist", t),
      open: () => openContext(context, `${context.kind}:${context.id}`),
    })),
  ], tile => tile.identity)
    .map(({ at: _at, ...tile }) => tile);

  const tiles = recent.slice(0, TILES);
  if (!ready && tiles.length === 0) {
    return (
      <section className="flex min-w-0 flex-col gap-3">
        <MusicSectionHead title={title} />
        <div className="music-jump-grid" role="status" aria-label={t("music.loading")}>
          {Array.from({ length: TILES }).map((_, at) => (
            <span key={at} className="music-jump-tile music-jump-skeleton">
              <span className="music-jump-art" />
              <span className="music-jump-copy">
                <span className="music-jump-bar music-jump-bar-wide" />
                <span className="music-jump-bar" />
              </span>
            </span>
          ))}
        </div>
      </section>
    );
  }
  if (tiles.length === 0) return null;
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <MusicSectionHead title={title} onViewAll={ctx.openLibrary} />
      <div className="music-jump-grid">
        {tiles.map((tile) => (
          <button
            key={tile.key}
            type="button"
            className="music-jump-tile"
            aria-current={animating && tile.identity === playingIdentity ? "true" : undefined}
            aria-busy={busy === tile.key || undefined}
            onClick={tile.open}
          >
            <span
              className="music-jump-art"
              data-mosaic={(!tile.saved && !tile.surprise && tile.arts.length > 1) || undefined}
              data-pinned={tile.saved || tile.surprise || undefined}
            >
              {tile.saved || tile.surprise ? (
                <MusicPinnedCover
                  kind={tile.surprise ? "surprise" : "liked"}
                  artwork={tile.surprise ? tile.arts : ctx.player.likedTracks.map((track) => track.artwork).filter((art): art is string => Boolean(art)).slice(0, 4)}
                  glyphSize={tile.surprise ? 28 : 24}
                />
              ) : (
                (tile.arts.length > 1 ? tile.arts.slice(0, 4) : [tile.arts[0] ?? ""]).map((art, at) => (
                  <Poster
                    key={`${tile.key}:${at}`}
                    src={art}
                    seed={`${tile.key}:${at}`}
                    ratio="square"
                    lazy
                    className="h-full w-full [--poster-radius:0px]"
                  />
                ))
              )}
              {animating && tile.identity === playingIdentity && <MusicNowPlayingMark loading={now.phase === "resolving"} />}
            </span>
            <span className="music-jump-copy">
              <span className="music-jump-name">{tile.name}</span>
              <span className="music-jump-note">
                <span className="music-jump-note-text">{tile.note}</span>
                {tile.connectorId && (
                  <MusicCardBadgeChip badge={{ kind: "connector", connectorId: tile.connectorId }} />
                )}
                {tile.explicit && (
                  <span
                    data-music-label="explicit"
                    title={t("music.label.explicit")}
                    aria-label={t("music.label.explicit")}
                    className="inline-flex shrink-0 items-center rounded-[2px] bg-elevated px-1 py-0.5 text-[9px] font-medium leading-none text-ink-muted"
                  >
                    E
                  </span>
                )}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function jumpBackInBand(ctx: MusicBandContext): MusicBand | null {
  return {
    key: "music:jump-back-in",
    title: ctx.t("music.jumpBackIn.title"),
    catalog: false,
    render: (title) => <JumpBackIn ctx={ctx} title={title} />,
  };
}
