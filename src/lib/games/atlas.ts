import { safeFetch } from "@/lib/safe-fetch";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";
import { GameRequestPool } from "./request-pool";
import { ATLAS_DETAIL_FIELDS, ATLAS_PAGE_SIZE, atlasQuery, igdbSteamIds, parseAtlasGame, type AtlasFilters, type AtlasGame, type AtlasRoute } from "./igdb-data";
import type { GameSummary } from "./types";
import { GameMetadataCache } from "./metadata-cache";
import { metadataStore } from "./metadata-store";
import { savedMetadataAt } from "./metadata-records";
import { decodeIgdbRows } from "./igdb-records";
import { detailEditionTarget } from "./detail-edition";
import { chooseLauncherCatalog, LAUNCHER_CATALOG_LIMIT, launcherCatalogLookup } from "./launcher-catalog";
import { metadataMatchPage, metadataMatchQuery } from "./metadata-matching";

const pool = new GameRequestPool(1);
const metadata = new GameMetadataCache(metadataStore, Date.now, undefined, 30 * 60_000);
const metadataKey = (body: string) => `igdb:games:v1:${body}`;
let lastStart = 0;
export async function queryIgdb(body: string, signal?: AbortSignal, force = false, priority = false): Promise<unknown[]> {
  signal?.throwIfAborted();
  return metadata.load(metadataKey(body), () => pool.run(async () => {
    // Stay below IGDB's per-client rate ceiling, including fast cached upstream replies.
    const delay = Math.max(0, 300 - (Date.now() - lastStart));
    if (delay) await new Promise<void>((resolve, reject) => {
      const cancel = () => { clearTimeout(timer); reject(signal?.reason); };
      const timer = setTimeout(() => { signal?.removeEventListener("abort", cancel); resolve(); }, delay);
      signal?.addEventListener("abort", cancel, { once: true });
    });
    signal?.throwIfAborted(); lastStart = Date.now();
    const controller = new AbortController(); const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await safeFetch(`${HARBOR_API_BASE}/api/igdb/games`, { method: "POST", headers: { "content-type": "text/plain" }, body, signal: controller.signal });
      if (!response.ok) throw new Error(`IGDB ${response.status}`);
      const data = decodeIgdbRows(await response.json()); if (!data) throw new Error("Invalid IGDB response");
      return data;
    } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
  }, signal, priority), signal, force);
}
export function readIgdbSnapshot(body: string) { return metadata.peek<unknown[]>(metadataKey(body)); }
export async function loadMetadataMatches(query: string, platform?: number, offset = 0, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const body = metadataMatchQuery(query, platform, offset);
  return body ? metadataMatchPage(await queryIgdb(body, signal), query, offset) : { games: [], nextOffset: null };
}
function atlasPage(rows: unknown[], offset: number) {
  const games = [...new Map(rows.map(parseAtlasGame).map(g => [g.igdbId, g])).values()];
  return { games, nextOffset: rows.length === ATLAS_PAGE_SIZE ? offset + ATLAS_PAGE_SIZE : null, cachedAt: savedMetadataAt(rows) };
}
export async function loadAtlasPage(route: AtlasRoute, filters: AtlasFilters, offset = 0, signal?: AbortSignal) {
  const rows = await queryIgdb(atlasQuery(route, filters, offset), signal);
  return atlasPage(rows, offset);
}
export async function readAtlasPageSnapshot(route: AtlasRoute, filters: AtlasFilters, offset = 0) {
  try { const rows = await readIgdbSnapshot(atlasQuery(route, filters, offset)); return rows ? atlasPage(rows, offset) : null; }
  catch { return null; }
}
function detailQuery(game: GameSummary) {
  const id = game.igdbId;
  if (id !== undefined && (!Number.isSafeInteger(id) || id <= 0)) throw new Error("Invalid IGDB ID");
  const external = launcherCatalogLookup(game.id, game.catalogSteamId);
  if (external) return `fields ${ATLAS_DETAIL_FIELDS}; where ${id ? `id = ${id} & ` : ""}external_games.uid = "${external.uid}" & external_games.external_game_source = ${external.source} & platforms = (6); limit ${LAUNCHER_CATALOG_LIMIT};`;
  if (!id && (!game.steamId || !Number.isSafeInteger(game.steamId) || game.steamId <= 0)) throw new Error("Missing game identity");
  const where = id ? `id = ${id}` : `external_games.uid = "${game.steamId}" & external_games.external_game_source = 1`;
  return `fields ${ATLAS_DETAIL_FIELDS}; where ${where}; limit 5;`;
}
function atlasGame(rows: unknown[], game: GameSummary): AtlasGame | null {
  if (launcherCatalogLookup(game.id, game.catalogSteamId)) return chooseLauncherCatalog(game, rows.map(parseAtlasGame));
  // The provider's nested filter can match different external records; verify the pair locally.
  const match = rows.find(v => (!game.igdbId || (v as { id?: unknown }).id === game.igdbId) && (!game.steamId || igdbSteamIds(v).includes(game.steamId)));
  return match ? { ...parseAtlasGame(match), ...(game.steamId ? { id: game.id, steamId: game.steamId } : {}) } : null;
}
export async function loadAtlasGame(game: GameSummary, signal?: AbortSignal): Promise<AtlasGame | null> {
  const target = detailEditionTarget(game);
  return atlasGame(await queryIgdb(detailQuery(target), signal), target);
}
export async function readAtlasGameSnapshot(game: GameSummary): Promise<AtlasGame | null> {
  const target = detailEditionTarget(game);
  try { const rows = await readIgdbSnapshot(detailQuery(target)); return rows ? atlasGame(rows, target) : null; }
  catch { return null; }
}
