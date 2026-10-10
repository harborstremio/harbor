import { safeFetchBytes } from "@/lib/safe-fetch";
import { GameRequestPool } from "./request-pool";
import { gameMediaIdentity, gameMediaQuery, parseGameMedia, parseGameMediaIdentity, visibleGameMedia, type GameMediaIdentity, type GameMediaResult } from "./cross-media";

const pool = new GameRequestPool(1);
const cache = new Map<string, { at: number; data: GameMediaResult }>();
const MAX_BYTES = 1024 * 1024;
const coverPool = new GameRequestPool(2);
const covers = new Map<string, string>();
export async function loadGameBookCover(id: string, signal: AbortSignal): Promise<string> {
  if (!/^OL[1-9]\d*W$/.test(id)) return "";
  signal.throwIfAborted();
  if (covers.has(id)) return covers.get(id)!;
  return coverPool.run(async()=>{
    const response=await safeFetchBytes(`https://openlibrary.org/works/${id}.json`,{signal:AbortSignal.any([signal,AbortSignal.timeout(8000)])},8000,MAX_BYTES);
    if(!response.ok)throw Error(`Open Library ${response.status}`);
    const text=await response.text();if(text.length>MAX_BYTES)throw Error("Book record too large");
    const value:unknown=JSON.parse(text)?.covers;
    const coverId=Array.isArray(value)?value.find(n=>typeof n==="number"&&Number.isSafeInteger(n)&&n>0):undefined;
    const url=coverId?`https://covers.openlibrary.org/b/id/${coverId}-M.jpg`:"";
    signal.throwIfAborted();covers.set(id,url);if(covers.size>100)covers.delete(covers.keys().next().value!);return url;
  },signal);
}
async function query(body: string, signal: AbortSignal): Promise<unknown[]> {
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(12_000)]);
  const response = await safeFetchBytes(`https://query.wikidata.org/sparql?query=${encodeURIComponent(body)}&format=json`, { signal: bounded, headers: { Accept: "application/sparql-results+json" } }, 12_000, MAX_BYTES);
  if (!response.ok) throw Error(`Wikidata ${response.status}`);
  if (Number(response.headers.get("content-length")) > MAX_BYTES) throw Error("Wikidata response too large");
  let bodyText = "", size = 0;
  const reader = response.body?.getReader(), decoder = new TextDecoder();
  if (reader) {
    try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > MAX_BYTES) throw Error("Wikidata response too large"); bodyText += decoder.decode(part.value, { stream: true }); } bodyText += decoder.decode(); }
    finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  } else bodyText = await response.text();
  const rows: unknown = JSON.parse(bodyText)?.results?.bindings;
  if (!Array.isArray(rows)) throw Error("Invalid Wikidata response");
  return rows;
}
export async function loadGameMedia(game: GameMediaIdentity, signal: AbortSignal, hideAdult = true): Promise<GameMediaResult> {
  signal.throwIfAborted();
  const identity = gameMediaIdentity(game);
  if (!identity) return { gameQid: null, items: [] };
  const held = cache.get(identity.key);
  if (held && Date.now()-held.at < 24*60*60_000) return { ...held.data, items:visibleGameMedia(held.data.items, hideAdult) };
  return pool.run(async () => {
    const gameQid = parseGameMediaIdentity(await query(`SELECT DISTINCT ?game WHERE { ${identity.clause} } LIMIT 3`, signal));
    const items = gameQid ? parseGameMedia(await query(gameMediaQuery(gameQid), signal)) : [];
    signal.throwIfAborted();
    const data = { gameQid, items };
    cache.delete(identity.key); cache.set(identity.key, { at: Date.now(), data });
    if (cache.size > 80) cache.delete(cache.keys().next().value!);
    return { ...data, items:visibleGameMedia(data.items, hideAdult) };
  }, signal);
}
