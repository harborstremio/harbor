import type { MusicCatalogRow, MusicConnection, MusicConnectionKind } from "@/lib/music/types";

export type MusicHomeSlot = "newReleases" | "charts" | "stations" | "server" | "scrobble" | "extra";

export type MusicHomeSlots = Record<MusicHomeSlot, MusicCatalogRow[]>;

const NEW_RELEASE_ID = /new[-_ ]?release|fresh[-_ ]?release|just[-_ ]?added/;
const CHART_ID = /chart|top[-_ ]?track|top[-_ ]?song|top[-_ ]?album|most[-_ ]?played|popular/;
const STATION_ID = /radio|station|\bmix|daily[-_ ]?mix/;

function kindOf(connections: MusicConnection[], source: string): MusicConnectionKind | undefined {
  const key = source.trim().toLowerCase();
  if (!key) return undefined;
  return connections.find((row) => row.id.toLowerCase() === key)?.kind;
}

export function classifyHomeRow(
  row: MusicCatalogRow,
  connections: MusicConnection[],
): MusicHomeSlot {
  const kind = kindOf(connections, row.source);
  if (kind === "server" || kind === "local") return "server";
  if (kind === "scrobbler") return "scrobble";

  const id = row.id.toLowerCase();
  const key = row.titleLiteral ? "" : row.title;
  if (key === "music.row.newReleases" || NEW_RELEASE_ID.test(id)) return "newReleases";
  if (key === "music.row.charts" || CHART_ID.test(id)) return "charts";
  if (key === "music.row.stations" || STATION_ID.test(id)) return "stations";
  if (row.items.length > 0 && row.items.every((item) => item.kind === "station")) return "stations";
  return "extra";
}

export function splitHomeRows(
  rows: MusicCatalogRow[],
  connections: MusicConnection[],
): MusicHomeSlots {
  const slots: MusicHomeSlots = {
    newReleases: [],
    charts: [],
    stations: [],
    server: [],
    scrobble: [],
    extra: [],
  };
  for (const row of rows) slots[classifyHomeRow(row, connections)].push(row);
  return slots;
}
