import { MusicCatalogRow } from "@/components/music/music-catalog-row";
import { MusicConnectCard } from "@/components/music/music-connect-card";
import { favoriteArtists } from "@/lib/music/sources";
import type {
  MusicCatalogRow as MusicCatalogRowData,
  MusicConnectionKind,
} from "@/lib/music/types";
import type { MusicBand, MusicBandContext } from "./music-band-types";

type BandSource = { kinds: MusicConnectionKind[]; bodyKey: string };

const BAND_SOURCES: Record<string, BandSource> = {
  artists: { kinds: ["streaming", "server", "local"], bodyKey: "music.connect.artistsBody" },
  stations: { kinds: ["streaming", "server", "local"], bodyKey: "music.connect.stationsBody" },
  "new-releases": { kinds: ["catalog"], bodyKey: "music.connect.catalogBody" },
  charts: { kinds: ["catalog"], bodyKey: "music.connect.catalogBody" },
};

function emptyRowFor(key: string, title: string): MusicCatalogRowData {
  return {
    id: key,
    title,
    titleLiteral: true,
    subtitle: "",
    layout: "covers",
    source: "",
    items: [],
  };
}

export function gateBand(band: MusicBand, ctx: MusicBandContext): MusicBand {
  const source = BAND_SOURCES[band.key];
  if (!source) return band;
  if (ctx.connectionsStatus === "loading") return band;
  if (ctx.connectionsStatus === "error") {
    return {
      ...band,
      render: (title) => (
        <MusicCatalogRow
          row={emptyRowFor(band.key, title)}
          status="error"
          error={ctx.connectionsError}
          onRetry={ctx.reloadConnections}
        />
      ),
    };
  }
  const own = ctx.connections.filter(
    (row) => source.kinds.includes(row.kind) && row.status !== "unavailable",
  );
  if (own.some((row) => row.status === "connected")) return band;
  const filler = own.find((row) => row.status === "error") ?? own[0];
  if (!filler) return band;
  return {
    ...band,
    render: () => (
      <MusicConnectCard
        sourceId={filler.id}
        sourceName={filler.name}
        body={ctx.t(source.bodyKey)}
        connection={filler}
      />
    ),
  };
}

export function scrobbleShelf(ctx: MusicBandContext, band: MusicBand | null): MusicBand | null {
  if (!band) return null;
  const source = ctx.connections.find((row) => row.kind === "scrobbler");
  const live = ctx.data.lastfm?.connected ?? source?.status === "connected";
  const tag = live ? (favoriteArtists(ctx.player.recents)[0] ?? "") : "";
  const title = tag ? ctx.t("music.row.scrobble", { tag }) : ctx.t("music.rail.basedOnHistory");
  if (!live) return { ...band, title };
  const items = ctx.slots.scrobble[0]?.items ?? [];
  return {
    ...band,
    title,
    render: (label) => (
      <MusicCatalogRow
        row={{
          id: "scrobble",
          title: label,
          titleLiteral: true,
          subtitle: tag ? ctx.t("music.rail.basedOnHistory") : "",
          layout: "covers",
          source: source?.id ?? "lastfm",
          items,
        }}
        status={ctx.data.homeStatus}
        error={ctx.data.homeError}
        onRetry={ctx.data.reload}
        emptyLabel={ctx.t("music.row.scrobbleWaiting")}
        onOpen={(item) => ctx.openItem(item, items)}
        playable
      />
    ),
  };
}
