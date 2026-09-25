import { Music2, Plus, X } from "lucide-react";
import { hideMusicRecent, isMusicRecentHidden } from "@/lib/music/hidden-recents";
import { MusicTrackMixChip, MusicTrackPlaylistChip } from "@/components/music/music-playlist-chip";
import { MusicMediaBadge } from "@/components/music/music-media-badge";
import { MusicArtistLink } from "@/components/music/music-artist-link";
import { MUSIC_SHELF_MIN, MusicCatalogRow } from "@/components/music/music-catalog-row";
import { MusicSectionHead } from "@/components/music/music-track-grid";
import { Row } from "@/components/row";
import { favoriteArtists } from "@/lib/music/sources";
import type { MusicArtistRef, MusicCatalogItem, MusicTrack } from "@/lib/music/types";
import { localRow, trackItem, type MusicBand, type MusicBandContext } from "./music-band-types";
import { recentContextsBand } from "./music-recent-contexts-band";

function artistRefs(ctx: MusicBandContext): MusicArtistRef[] {
  const t = ctx.t;
  const refs: MusicArtistRef[] = [];
  const seen = new Set<string>();
  for (const row of ctx.data.homeRows.filter((row) => row.source === "local")) {
    for (const item of row.items) {
      if (item.kind !== "artist") continue;
      const key = item.name.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      refs.push(item);
    }
  }
  for (const artist of ctx.data.library?.artists ?? []) {
    const key = artist.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    refs.push({
      id: `library:${artist.id}`,
      connectorId: "local",
      name: artist.name,
      subtitle: t("music.library.artistSummary", {
        tracks: artist.trackCount,
        albums: artist.albumCount,
      }),
    });
  }
  for (const name of favoriteArtists(ctx.player.recents)) {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const heard = ctx.player.recents.filter((track) =>
      track.artist.trim().toLowerCase().startsWith(key),
    );
    refs.push({
      id: `history:${key}`,
      connectorId: heard[0]?.connectorId ?? "",
      name,
      subtitle: heard.length > 0 ? t("music.trackCount", { count: heard.length }) : undefined,
    });
  }
  return refs.slice(0, 16);
}

function artistMosaic(ctx: MusicBandContext, artist: MusicArtistRef): string[] {
  const wanted = artist.name.trim().toLowerCase();
  if (!wanted) return [];
  const albums = ctx.data.library?.albums ?? [];
  const seen = new Set<string>();
  const covers: string[] = [];
  for (const album of albums) {
    const credit = album.artist.trim().toLowerCase();
    if (credit !== wanted && !credit.startsWith(`${wanted} `)) continue;
    const url = album.artwork.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    covers.push(url);
    if (covers.length === 4) break;
  }
  return covers;
}

function playlistCovers(tracks: readonly MusicTrack[]): string[] {
  const seen = new Set<string>();
  const covers: string[] = [];
  for (const track of tracks) {
    const url = track.artwork.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    covers.push(url);
    if (covers.length === 4) break;
  }
  return covers;
}

function NewPlaylistTile({
  label,
  hint,
  onSelect,
}: {
  label: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={label}
      title={hint}
      className="group flex w-full min-w-0 flex-col text-start"
    >
      <span className="relative block w-full overflow-hidden rounded-md border border-dashed border-edge bg-elevated/25 transition-colors duration-200 ease-out group-hover:bg-elevated/50">
        <span aria-hidden="true" className="block" style={{ paddingTop: "100%" }} />
        <span className="absolute inset-0 grid place-items-center text-ink-muted transition-colors duration-200 ease-out group-hover:text-ink">
          <Plus size={26} aria-hidden="true" />
        </span>
      </span>
      <span className="mt-[9px] flex min-w-0 items-center gap-[5px]">
        <span className="truncate text-[13px] font-semibold text-ink">{label}</span>
      </span>
      <span className="mt-px truncate text-[13px] text-ink-subtle">{hint}</span>
    </button>
  );
}

function recentsBand(ctx: MusicBandContext): MusicBand | null {
  const recents = ctx.player.recents.filter((track) => !isMusicRecentHidden(track.id)).slice(0, 18);
  if (recents.length === 0) return null;
  const t = ctx.t;
  const items = recents.map(trackItem);
  return {
    key: "recents",
    title: t("music.row.recents"),
    catalog: false,
    render: (title) => (
      <section className="music-quick-section">
        <MusicSectionHead title={title} onViewAll={ctx.openLibrary} />
        <div className="music-quick-grid">
          {recents.slice(0, 8).map((item) => (
            <div key={item.id} className="music-quick-item">
              <button
                type="button"
                className="music-quick-remove"
                aria-label={t("music.recents.remove", { title: item.title })}
                title={t("music.recents.remove", { title: item.title })}
                onClick={(event) => {
                  event.stopPropagation();
                  hideMusicRecent(item.id);
                }}
              >
                <X size={13} aria-hidden="true" />
              </button>
              <button
                className="music-quick-art"
                type="button"
                aria-label={t("music.card.openItem", { title: item.title })}
                onClick={() => ctx.openItem(trackItem(item), items)}
              >
                {item.artwork ? (
                  <img src={item.artwork} alt="" />
                ) : (
                  <Music2 size={24} aria-hidden />
                )}
              </button>
              <div className="music-quick-copy">
                <button type="button" onClick={() => ctx.openItem(trackItem(item), items)}>
                  <strong>{item.title}</strong>
                </button>
                <MusicArtistLink name={item.artist} track={item} className="music-quick-artist" />
                <div className="music-quick-indicators">
                  <MusicMediaBadge kind={item.mediaKind} />
                  <MusicTrackPlaylistChip track={item} />
                  <MusicTrackMixChip track={item} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    ),
  };
}

function freshBand(ctx: MusicBandContext): MusicBand | null {
  const t = ctx.t;
  if (ctx.chartsInFresh) {
    const charts = ctx.slots.charts[0];
    if (!charts) return null;
    const items = charts.items;
    const heading = charts.titleLiteral ? charts.title : t(charts.title);
    return {
      key: "fresh",
      title: heading,
      catalog: true,
      render: (title) => (
        <MusicCatalogRow
          row={{ ...charts, title, titleLiteral: true, layout: "trackGrid" }}
          count={9}
          numbered
          onPlay={(item) => ctx.openItem(item, items)}
        />
      ),
    };
  }
  if (ctx.player.recents.length === 0) return null;
  const items = ctx.data.fresh.map(trackItem);
  return {
    key: "fresh",
    title: t("music.row.fresh"),
    catalog: false,
    render: (title) => (
      <MusicCatalogRow
        row={localRow("fresh", title, t("music.row.freshSubtitle"), "trackGrid", items)}
        status={ctx.data.freshStatus}
        error={ctx.data.freshError}
        onRetry={ctx.data.reload}
        count={9}
        onPlay={(item) => ctx.openItem(item, items)}
      />
    ),
  };
}

function artistsBand(ctx: MusicBandContext): MusicBand {
  const t = ctx.t;
  const refs = artistRefs(ctx);
  const items: MusicCatalogItem[] = refs.map((artist) => ({ kind: "artist", ...artist }));
  const status =
    items.length === 0 && ctx.data.libraryStatus === "loading" ? "loading" : ("ready" as const);
  return {
    key: "artists",
    title: t("music.row.artists"),
    catalog: false,
    render: (title) => (
      <MusicCatalogRow
        row={localRow("artists", title, t("music.row.artistsSubtitle"), "circles", items)}
        status={status}
        artistArtwork={(artist) => artistMosaic(ctx, artist)}
        onOpen={(_item, index) => {
          const artist = refs[index];
          if (!artist) return;
          if (artist.id.startsWith("library:") || artist.id.startsWith("history:"))
            ctx.searchArtist(artist.name);
          else ctx.openItem({ ...artist, kind: "artist" }, items);
        }}
        onViewAll={ctx.openLibrary}
      />
    ),
  };
}

function queueBand(ctx: MusicBandContext): MusicBand {
  const t = ctx.t;
  const upcoming =
    ctx.player.queueIndex >= 0 ? ctx.player.queue.slice(ctx.player.queueIndex + 1) : [];
  const live = upcoming.length > 0;
  const tracks = live ? upcoming : ctx.player.likedTracks;
  const items = tracks.map(trackItem);
  return {
    key: "liked",
    title: t(live ? "music.row.upNext" : "music.row.liked"),
    catalog: false,
    render: (title) => (
      <MusicCatalogRow
        row={localRow(
          "liked",
          title,
          t(live ? "music.row.upNextSubtitle" : "music.row.likedSubtitle"),
          "trackGrid",
          items,
        )}
        count={9}
        numbered={live}
        emptyLabel={t("music.library.saveEmpty")}
        onPlay={(_item, index) => {
          const track = tracks[index];
          if (track) ctx.playTrack(track, live ? ctx.player.queue : tracks);
        }}
        onViewAll={ctx.openLibrary}
      />
    ),
  };
}

function playlistsBand(ctx: MusicBandContext): MusicBand {
  const t = ctx.t;
  const playlists = ctx.data.library?.playlists ?? [];
  const items: MusicCatalogItem[] = playlists.map((playlist) => ({
    kind: "playlist",
    id: playlist.id,
    connectorId: "local",
    name: playlist.name,
    artwork: playlistCovers(playlist.tracks),
    trackCount: playlist.tracks.length,
  }));
  const tile = (
    <NewPlaylistTile
      label={t("music.row.newPlaylist")}
      hint={t("music.row.newPlaylistHint")}
      onSelect={ctx.openLibrary}
    />
  );
  const subtitle = t("music.row.playlistsSubtitle", { count: playlists.length });

  return {
    key: "playlists",
    title: t("music.row.playlists"),
    catalog: false,
    render: (title) =>
      items.length === 0 ? (
        <section className="flex min-w-0 flex-col gap-5 ps-[9px]">
          <MusicSectionHead
            title={title}
            subtitle={subtitle}
            onViewAll={() => ctx.openLibrary({ view: "playlists" })}
          />
          <Row shape="square" min={MUSIC_SHELF_MIN} scrollKey="music:playlists" alwaysActive>
            {tile}
          </Row>
        </section>
      ) : (
        <MusicCatalogRow
          row={localRow("playlists", title, subtitle, "covers", items)}
          status={ctx.data.libraryStatus === "loading" ? "loading" : "ready"}
          leadingCard={tile}
          onOpen={(item) => ctx.openLibrary({ view: "playlists", playlistId: item.id })}
          onViewAll={() => ctx.openLibrary({ view: "playlists" })}
        />
      ),
  };
}

export function personalBands(ctx: MusicBandContext): {
  recents: MusicBand | null;
  recentContexts: MusicBand | null;
  fresh: MusicBand | null;
  artists: MusicBand;
  queue: MusicBand;
  playlists: MusicBand;
} {
  return {
    recents: recentsBand(ctx),
    recentContexts: recentContextsBand(ctx),
    fresh: freshBand(ctx),
    artists: artistsBand(ctx),
    queue: queueBand(ctx),
    playlists: playlistsBand(ctx),
  };
}
