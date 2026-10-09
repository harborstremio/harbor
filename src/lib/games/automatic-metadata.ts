import { parseAtlasGame, type AtlasGame } from "./igdb-data";
import { prepareImportedArtwork, type ArtworkImportPolicy } from "./imported-artwork";
import { backgroundArtwork } from "./igdb-artwork";
import type { GameSummary } from "./types";

export type AutomaticMetadataRequest = {
  name: string; platforms: number[]; year?: number; igdbId?: number;
  external?: { source: number; uid: string };
};
export type MetadataImportTarget = { id: string; request: AutomaticMetadataRequest; matched: boolean };
export type MetadataImportResult = { id: string; state: "pending" | "searching" | "saved" | "skipped" | "review" | "failed"; reason?: "ambiguous" | "noMatch" | "incomplete" | "artwork"; game?: GameSummary };
const PAGE_SIZE = 50;
const MAX_PAGES = 4;
const FIELDS = "name,slug,cover.image_id,artworks.image_id,screenshots.image_id,first_release_date,platforms.name,alternative_names.name,release_dates.date,release_dates.platform.name,external_games.external_game_source,external_games.uid";
const positive = (value: number) => Number.isSafeInteger(value) && value > 0;
const quoted = (value: string) => value.replace(/["\\\x00-\x1f\x7f]/g, " ").trim();

/** Keep edition names and sequel numbers; punctuation and trademark glyphs are not identity. */
export function metadataTitle(value: string) {
  return value.replace(/[™®©]/g, "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/['’]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
export function automaticMetadataQuery(request: AutomaticMetadataRequest, offset = 0) {
  if (!request.name.trim() || request.name.length > 500 || !request.platforms.every(positive) || request.platforms.length > 16
    || request.igdbId !== undefined && !positive(request.igdbId)
    || request.year !== undefined && (!Number.isInteger(request.year) || request.year < 1950 || request.year > 2200)
    || !Number.isInteger(offset) || offset < 0 || offset >= PAGE_SIZE * MAX_PAGES || offset % PAGE_SIZE) throw Error("metadata_request_invalid");
  if (request.igdbId) return `fields ${FIELDS}; where id = ${request.igdbId}; limit 1;`;
  const external = request.external;
  if (external && (!positive(external.source) || !/^[a-zA-Z0-9_-]{1,256}$/.test(external.uid))) throw Error("metadata_request_invalid");
  const start = request.year ? Date.UTC(request.year, 0) / 1000 : 0, end = request.year ? Date.UTC(request.year + 1, 0) / 1000 : 0;
  const year = request.year ? `((first_release_date >= ${start} & first_release_date < ${end}) | (release_dates.date >= ${start} & release_dates.date < ${end}))` : "";
  const where = [external ? `external_games.external_game_source = ${external.source} & external_games.uid = "${external.uid}"` : "", request.platforms.length ? `platforms = (${request.platforms.join(",")})` : "", year].filter(Boolean).join(" & ");
  const name = quoted(request.name.slice(0, 160));
  if (!external && !metadataTitle(name)) throw Error("metadata_request_invalid");
  return `${external ? "" : `search "${name}"; `}fields ${FIELDS};${where ? ` where ${where};` : ""} limit ${PAGE_SIZE}; offset ${offset};`;
}
function yearMatches(game: AtlasGame, request: AutomaticMetadataRequest) {
  if (!request.year) return true;
  const releases = game.releaseHistory?.filter(release => !request.platforms.length || request.platforms.includes(release.platform.id)).flatMap(release => release.date === undefined ? [] : [release.date]) ?? [];
  const dates = releases.length ? releases : game.release === undefined ? [] : [game.release];
  return dates.some(date => new Date(date * 1000).getUTCFullYear() === request.year);
}
export function chooseAutomaticMetadata(request: AutomaticMetadataRequest, games: AtlasGame[], complete: boolean): { game?: AtlasGame; reason?: "ambiguous" | "noMatch" | "incomplete" } {
  if (!complete) return { reason: "incomplete" };
  const distinct = [...new Map(games.map(game => [game.igdbId, game])).values()];
  if (request.igdbId) return { game: distinct.find(game => game.igdbId === request.igdbId), reason: distinct.some(game => game.igdbId === request.igdbId) ? undefined : "noMatch" };
  // Provider nested filters can match different records. Check the complete pair again here.
  const compatible = distinct.filter(game => (!request.platforms.length || game.platformLinks.some(platform => request.platforms.includes(platform.id)))
    && (!request.external || game.externalIds?.some(external => external.source === request.external!.source && external.uid === request.external!.uid)));
  if (request.external && compatible.length === 1 && yearMatches(compatible[0], request)) return { game: compatible[0] };
  const title = metadataTitle(request.name);
  const exact = compatible.filter(game => [game.name, ...(game.alternativeTitles?.map(alias => alias.name) ?? [])].some(name => metadataTitle(name) === title) && yearMatches(game, request));
  // Without a known platform, a title alone cannot establish the installation's edition.
  if (exact.length === 1 && (request.platforms.length || request.external)) return { game: exact[0] };
  return { reason: compatible.length ? "ambiguous" : "noMatch" };
}
export async function findAutomaticMetadata(request: AutomaticMetadataRequest, query: (body: string, signal: AbortSignal) => Promise<unknown[]>, signal: AbortSignal) {
  const games: AtlasGame[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    signal.throwIfAborted();
    const rows = await query(automaticMetadataQuery(request, page * PAGE_SIZE), signal);
    signal.throwIfAborted();
    games.push(...rows.map(parseAtlasGame));
    if (request.igdbId || rows.length < PAGE_SIZE) return chooseAutomaticMetadata(request, games, true);
  }
  return chooseAutomaticMetadata(request, games, false);
}
export function metadataImportRows(targets: MetadataImportTarget[]): MetadataImportResult[] {
  return [...new Map(targets.map(target => [target.id, { id: target.id, state: target.matched ? "skipped" as const : "pending" as const }])).values()];
}
/** Sequential, cancellable and resumable. A failed save retains its prepared random artwork. */
export async function runMetadataImport(targets: MetadataImportTarget[], previous: MetadataImportResult[], policy: ArtworkImportPolicy, signal: AbortSignal, dependencies: {
  query: (body: string, signal: AbortSignal) => Promise<unknown[]>;
  detail: (game: GameSummary, signal: AbortSignal) => Promise<AtlasGame | null>;
  save: (id: string, game: GameSummary, signal: AbortSignal) => Promise<boolean>;
  progress: (row: MetadataImportResult) => void;
}) {
  const results = new Map(previous.map(row => [row.id, row]));
  for (const target of targets) {
    if (signal.aborted) break;
    const held = results.get(target.id);
    if (target.matched || held && !["pending", "failed"].includes(held.state)) continue;
    let prepared = held?.game;
    const emit = (row: MetadataImportResult) => { results.set(row.id, row); dependencies.progress(row); };
    emit({ id: target.id, state: "searching" });
    try {
      if (!prepared) {
        const match = await findAutomaticMetadata(target.request, dependencies.query, signal);
        if (!match.game) { emit({ id: target.id, state: "review", reason: match.reason }); continue; }
        const detail = await dependencies.detail({ ...match.game, id: `igdb:${match.game.igdbId}`, steamId: undefined }, signal);
        signal.throwIfAborted();
        if (!detail || detail.igdbId !== match.game.igdbId) throw Error("metadata_record_missing");
        prepared = { ...detail, id: `igdb:${detail.igdbId}`, steamId: undefined, importedArtwork: prepareImportedArtwork(detail.igdbId, detail.artwork ?? [], policy) };
        if (policy.selection === "manual" && backgroundArtwork(detail.artwork ?? [], policy.screenshots).length > 1) {
          emit({ id: target.id, state: "review", reason: "artwork", game: prepared }); continue;
        }
      }
      signal.throwIfAborted();
      const saved = await dependencies.save(target.id, prepared, signal);
      // A completed write remains a success even if Stop arrived while it was committing.
      emit({ id: target.id, state: saved ? "saved" : signal.aborted ? "pending" : "failed", game: prepared });
    } catch {
      emit({ id: target.id, state: signal.aborted ? "pending" : "failed", ...(prepared ? { game: prepared } : {}) });
      if (signal.aborted) break;
    }
  }
  return [...results.values()];
}
