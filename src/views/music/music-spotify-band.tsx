import { MusicCatalogRow } from "@/components/music/music-catalog-row";
import { resolvedTitle, type MusicBand, type MusicBandContext } from "./music-band-types";

export const HOISTED_SOURCE = "spotify";

const ORDER = [
  "spotify:home:saved-tracks",
  "spotify:home:playlists",
  "spotify:home:saved-albums",
  "spotify:home:recently-played",
  "spotify:home:top-tracks",
  "spotify:home:top-artists",
];

const SHOW_ALL: Record<string, "playlists" | "liked" | undefined> = {
  "spotify:home:saved-tracks": "liked",
  "spotify:home:playlists": "playlists",
};

function rank(id: string): number {
  const at = ORDER.indexOf(id);
  return at < 0 ? ORDER.length : at;
}

export function spotifyBands(ctx: MusicBandContext): MusicBand[] {
  const account = ctx.connections.find((connection) => connection.id === HOISTED_SOURCE);
  if (account?.status !== "connected") return [];
  return ctx.slots.extra
    .filter((row) => row.source === HOISTED_SOURCE && row.items.length > 0)
    .slice()
    .sort((a, b) => rank(a.id) - rank(b.id))
    .map((row) => ({
      key: `home:${row.id}`,
      title: resolvedTitle(row, ctx.t).title,
      catalog: true,
      render: (title: string) => (
        <MusicCatalogRow
          row={{ ...row, title }}
          onOpen={(item) => ctx.openItem(item, row.items)}
          onViewAll={
            SHOW_ALL[row.id]
              ? () => ctx.openLibrary({ view: HOISTED_SOURCE, spotifyKind: SHOW_ALL[row.id] })
              : undefined
          }
        />
      ),
    }));
}
