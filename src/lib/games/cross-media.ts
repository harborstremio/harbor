import type { GameSummary } from "./types";

export type GameMediaRelation = "source" | "adaptation" | "derivative" | "seriesAdaptation" | "sharedSource" | "sourceWorld" | "universe";
export type GameMedia = {
  qid: string; name: string; kind: "movie" | "series" | "book"; relation: GameMediaRelation;
  via?: { qid: string; name: string }; year?: number; tmdbId?: number; imdbId?: string;
  openLibraryId?: string; gutenbergId?: string;
  adult?: boolean; parody?: boolean;
};
export type GameMediaTarget = { kind: "movie" | "series"; id: string; name: string; poster?: string } | { kind: "book"; id: string };
export type GameMediaIdentity = Pick<GameSummary, "steamId"> & { url?: string };
export type GameMediaResult = { gameQid: string | null; items: GameMedia[] };
type Binding = Record<string, { value?: unknown } | undefined>;
const qid = (value: unknown) => typeof value === "string" ? /^(?:https?:\/\/www\.wikidata\.org\/entity\/)?(Q[1-9]\d*)$/.exec(value)?.[1] : undefined;
const str = (row: Binding, key: string) => typeof row?.[key]?.value === "string" ? (row[key]!.value as string).trim() : "";
const numeric = (value: string) => /^[1-9]\d{0,9}$/.test(value) ? Number(value) : undefined;
const label = (value: string) => value.length > 0 && value.length <= 300 && !/^Q\d+$|^https?:/i.test(value);
const order: GameMediaRelation[] = ["source", "adaptation", "derivative", "seriesAdaptation", "sharedSource", "sourceWorld", "universe"];

/** Wikidata P5794 contains an IGDB SLUG, not its numeric API ID. Never join on a title. */
export function gameMediaIdentity(game: GameMediaIdentity): { key: string; clause: string } | null {
  if (Number.isSafeInteger(game.steamId) && game.steamId! > 0) return { key: `steam:${game.steamId}`, clause: `?game wdt:P1733 "${game.steamId}" .` };
  try {
    const url = new URL(game.url ?? ""), slug = /^\/games\/([a-z0-9][a-z0-9-]{0,150})\/?$/.exec(url.pathname)?.[1];
    if (url.protocol === "https:" && url.hostname === "www.igdb.com" && slug && !/^\d+$/.test(slug)) return { key: `igdb:${slug}`, clause: `?game wdt:P5794 "${slug}" .` };
  } catch { /* No trusted external identity yet. */ }
  return null;
}
export function parseGameMediaIdentity(rows: unknown[]): string | null {
  const ids = [...new Set(rows.flatMap(value => { const id = qid(str(value as Binding, "game")); return id ? [id] : []; }))];
  // Duplicate records in an external catalog are ambiguous, not an excuse to choose the first.
  return ids.length === 1 ? ids[0] : null;
}
export function gameMediaQuery(id: string): string {
  if (!/^Q[1-9]\d*$/.test(id)) throw Error("Invalid Wikidata ID");
  return `SELECT DISTINCT ?work ?workLabel ?relation ?via ?viaLabel ?film ?tv ?imdb ?book ?gutenberg ?date ?adult ?parody WHERE {
    {
    { wd:${id} wdt:P144 ?work . BIND("source" AS ?relation) }
    UNION { ?work wdt:P144 wd:${id} . BIND("adaptation" AS ?relation) }
    UNION { wd:${id} wdt:P4969 ?work . BIND("derivative" AS ?relation) }
    UNION { wd:${id} (wdt:P179|wdt:P8345) ?via . ?work wdt:P144 ?via . BIND("seriesAdaptation" AS ?relation) }
    UNION { wd:${id} (wdt:P179|wdt:P8345) ?via . ?work (wdt:P179|wdt:P8345) ?via . BIND("universe" AS ?relation) }
    UNION { wd:${id} wdt:P144 ?via . ?work wdt:P144 ?via . BIND("sharedSource" AS ?relation) }
    UNION { wd:${id} wdt:P144 ?via . ?work wdt:P179 ?via . BIND("sourceWorld" AS ?relation) }
    }
    FILTER(?work != wd:${id})
    BIND(EXISTS { ?work (wdt:P31|wdt:P136)/wdt:P279* wd:Q291 . } AS ?adult)
    BIND(EXISTS { ?work (wdt:P31|wdt:P136)/wdt:P279* wd:Q622548 . } AS ?parody)
    OPTIONAL { ?work wdt:P4947 ?film } OPTIONAL { ?work wdt:P4983 ?tv }
    OPTIONAL { ?work wdt:P345 ?imdb } OPTIONAL { ?work wdt:P648 ?book }
    OPTIONAL { ?work wdt:P2034 ?gutenberg } OPTIONAL { ?work wdt:P577 ?date }
    FILTER(BOUND(?film)||BOUND(?tv)||BOUND(?book)||BOUND(?gutenberg))
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }
  } LIMIT 120`;
}
export function parseGameMedia(rows: unknown[]): GameMedia[] {
  const items = new Map<string, GameMedia>();
  for (const value of rows.slice(0, 120)) {
    if (!value || typeof value !== "object") continue;
    const row = value as Binding, id = qid(str(row, "work")), name = str(row, "workLabel"), relation = str(row, "relation") as GameMediaRelation;
    if (!id || !label(name) || !order.includes(relation)) continue;
    const film = numeric(str(row, "film")), tv = numeric(str(row, "tv"));
    const openLibraryId = /^OL[1-9]\d*W$/.test(str(row, "book")) ? str(row, "book") : undefined;
    const gutenbergId = numeric(str(row, "gutenberg")) ? str(row, "gutenberg") : undefined;
    const kind = tv ? "series" : film ? "movie" : openLibraryId || gutenbergId ? "book" : null;
    if (!kind) continue;
    const viaId = qid(str(row, "via")), viaName = str(row, "viaLabel");
    if (["seriesAdaptation", "sharedSource", "sourceWorld", "universe"].includes(relation) && (!viaId || !label(viaName))) continue;
    const year = Number(/^\+?(\d{4})-/.exec(str(row, "date"))?.[1]) || undefined;
    const adultValue = str(row, "adult"), adult = /^(?:true|1)$/.test(adultValue) ? true : /^(?:false|0)$/.test(adultValue) ? false : undefined;
    const item: GameMedia = { qid: id, name, kind, relation, adult, parody:/^(?:true|1)$/.test(str(row,"parody")), ...(viaId && label(viaName) ? { via: { qid: viaId, name: viaName } } : {}), year, tmdbId: tv ?? film, openLibraryId, gutenbergId, imdbId: /^tt\d{7,10}$/.test(str(row, "imdb")) ? str(row, "imdb") : undefined };
    const previous = items.get(id);
    if (previous) {
      // A second relationship or release date must not erase a restrictive classification.
      const adult = previous.adult === true || item.adult === true ? true : previous.adult === false && item.adult === false ? false : undefined;
      previous.adult = item.adult = adult;
      previous.parody = item.parody = previous.parody || item.parody;
    }
    if (!previous || order.indexOf(relation) < order.indexOf(previous.relation)) items.set(id, item);
    else if (order.indexOf(relation) === order.indexOf(previous.relation) && year && (!previous.year || year < previous.year)) previous.year = year;
  }
  return [...items.values()].sort((a,b) => order.indexOf(a.relation)-order.indexOf(b.relation) || (a.year??9999)-(b.year??9999) || a.name.localeCompare(b.name));
}
export function visibleGameMedia(items: GameMedia[], hideAdult = true): GameMedia[] {
  // A response without the requested classification is not safe to publish under the default filter.
  return (hideAdult ? items.filter(item => item.adult === false) : items).slice(0, 32);
}
export function gameMediaRelationKey(item: GameMedia): string {
  return item.parody && item.relation !== "source" ? "games.media.relation.parody" : `games.media.relation.${item.relation}`;
}
export function gameMediaPoster(item: GameMedia): string {
  // Open Library work IDs are not edition cover IDs; resolve the work's cover field first.
  if (item.kind === "book") return "";
  return item.imdbId ? `https://images.metahub.space/poster/medium/${item.imdbId}/img` : "";
}
export function gameMediaTarget(item: GameMedia): GameMediaTarget | null {
  if (item.kind === "book") return item.gutenbergId ? { kind: "book", id: `source:gutendex:${item.gutenbergId}` } : null;
  return item.tmdbId ? { kind: item.kind, id: `tmdb:${item.kind === "series" ? "tv" : "movie"}:${item.tmdbId}`, name: item.name, poster: gameMediaPoster(item) || undefined } : null;
}
export function gameMediaUrl(item: GameMedia): string {
  if (item.kind === "book" && item.openLibraryId) return `https://openlibrary.org/works/${item.openLibraryId}`;
  if (item.kind !== "book" && item.tmdbId) return `https://www.themoviedb.org/${item.kind === "series" ? "tv" : "movie"}/${item.tmdbId}`;
  return `https://www.wikidata.org/wiki/${item.qid}`;
}
