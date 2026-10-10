import type { ReactNode } from "react";
import type { MusicConnectionsStatus } from "@/components/music/music-connections";
import type {
  MusicCatalogItem,
  MusicCatalogRow,
  MusicConnection,
  MusicPlayerState,
  MusicTrack,
} from "@/lib/music/types";
import type { MusicData } from "./use-music-data";
import type { MusicHomeSlots } from "./music-home-rows";
import type { MusicRecentContext } from "@/lib/music/recent-context";

export type MusicBand = {
  key: string;
  title: string;
  catalog: boolean;
  render: (title: string) => ReactNode;
};

export type MusicLibraryTarget = {
  view?: string;
  playlistId?: string;
  spotifyKind?: "playlists" | "liked";
};

export type MusicBandContext = {
  t: (key: string, vars?: Record<string, string | number>) => string;
  data: MusicData;
  player: Omit<MusicPlayerState, "currentTime">;
  connections: MusicConnection[];
  connectionsStatus: MusicConnectionsStatus;
  connectionsError: string;
  reloadConnections: () => void;
  slots: MusicHomeSlots;
  chartsInFresh: boolean;
  playTrack: (track: MusicTrack, queue: MusicTrack[]) => void;
  openItem: (item: MusicCatalogItem, siblings: MusicCatalogItem[]) => void;
  openLibrary: (target?: MusicLibraryTarget) => void;
  openMix: (context: MusicRecentContext, load?: () => Promise<MusicTrack[]>) => Promise<void>;
  searchArtist: (name: string) => void;
  openConnections: (id?: string) => void;
};

export function trackItem(track: MusicTrack): MusicCatalogItem {
  return { kind: "track", ...track };
}

type TrackItem = Extract<MusicCatalogItem, { kind: "track" }>;

export function tracksOf(items: readonly MusicCatalogItem[]): MusicTrack[] {
  return items.filter((item): item is TrackItem => item.kind === "track");
}

export function localRow(
  id: string,
  title: string,
  subtitle: string,
  layout: MusicCatalogRow["layout"],
  items: MusicCatalogItem[],
): MusicCatalogRow {
  return { id, title, titleLiteral: true, subtitle, layout, source: "", items };
}

export function resolvedTitle(
  row: MusicCatalogRow,
  t: MusicBandContext["t"],
): { title: string; subtitle: string } {
  const title = row.titleLiteral ? row.title : t(row.title);
  const raw = row.subtitle ?? "";
  const subtitle = !raw ? "" : row.titleLiteral ? raw : t(raw);
  return { title, subtitle };
}
