import { guideVideoFilter, type GuideVideoSort, type GuideVideoDate } from "./guide-video-options";
import { safeFetchBytes } from "@/lib/safe-fetch";
import { APP_VERSION } from "@/lib/build-info";
import { GameRequestPool } from "./request-pool";
import { GuideSourceRateLimit, guideRetryAt } from "./guide-source-status";
import { steamGuideHeaders, steamGuidesUrl, type SteamGuideFilters } from "./steam-guide-options";
import { pokemonEdition, pokemonGuideTitle } from "./pokemon-games";
import { loadPokemonArticle } from "./pokemon";
import { pokemonGuideCatalog } from "./pokemon-guides";
import { guideVideoGameName, parseGuideVideoPage, parseKickGuides, parsePcGuide, parseSteamGuide, parseSteamGuides, type GameGuide, type GuideArticle, type GuideVideoCursor } from "./guides-data";
const pool = new GameRequestPool(2), cache = new Map<string, { at: number; text: string }>();
const cooldown = new Map<string, number>();
async function load(url: string, signal: AbortSignal, ttl = 600_000, init: RequestInit = {}) {
  const key=url+String(init.body??"");
  signal.throwIfAborted(); const held = cache.get(key); if (held && Date.now() - held.at < ttl) return held.text;
  return pool.run(async () => {
    const host=new URL(url).hostname, retryAt=cooldown.get(host)??0;
    if(retryAt>Date.now())throw new GuideSourceRateLimit(retryAt);
    const limit = 4_000_000, timeout = AbortSignal.any([signal, AbortSignal.timeout(15_000)]);
    const headers=new Headers(init.headers);
    if(host==="steamcommunity.com" || host==="kick.com") {
      headers.set("Accept","text/html,application/xhtml+xml;q=0.9,*/*;q=0.8");
      // The native bridge otherwise advertises an old Chrome identity. Identify
      // this public reader honestly when requesting provider HTML.
      if(typeof window!=="undefined"&&"__TAURI_INTERNALS__" in window)headers.set("User-Agent",`Harbor/${APP_VERSION} (+https://harbor.site)`);
    }
    const response = await safeFetchBytes(url, { ...init, headers, signal: timeout }, 15_000, limit);
    if(response.status===429){const until=guideRetryAt(response.headers.get("retry-after"));cooldown.set(host,until);throw new GuideSourceRateLimit(until);}
    if (!response.ok) throw Error(`Guide source returned HTTP ${response.status}`);
    if (Number(response.headers.get("content-length")) > limit) throw Error("Guide source too large");
    const reader = response.body?.getReader(); let body = "", bytes = 0;
    if (reader) {
      const decoder = new TextDecoder();
      try { for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > limit) throw Error("Guide source too large"); body += decoder.decode(part.value, { stream:true }); } body += decoder.decode(); }
      finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    } else { body = await response.text(); if (body.length > limit) throw Error("Guide source too large"); }
    signal.throwIfAborted(); cache.delete(key); cache.set(key, { at:Date.now(), text:body }); while (cache.size > 20) cache.delete(cache.keys().next().value!); return body;
  }, signal);
}
// An HTTP 200 can be a provider error/login page. Never keep it for Retry.
export async function readGuideSource<T>(url:string,signal:AbortSignal,parse:(html:string)=>T,ttl=600_000,init:RequestInit={}) {
  try{return parse(await load(url,signal,ttl,init));}
  catch(error){cache.delete(url+String(init.body??""));throw error;}
}
const validId = (id: number) => { if (!Number.isSafeInteger(id) || id <= 0) throw Error("Invalid game"); return id; };
export async function loadSteamGuides(appId: number, query: string, page: number, filters: SteamGuideFilters, signal: AbortSignal) {
  return readGuideSource(steamGuidesUrl(appId,query,page,filters), signal,html=>parseSteamGuides(html,appId),600_000,{headers:steamGuideHeaders(appId)});
}
export async function loadPokemonGuides(game: string, query: string, signal: AbortSignal) {
  const edition = pokemonEdition(game);
  if (!edition || edition.hack) throw Error("No matching Pokémon walkthrough");
  return pokemonGuideCatalog(await loadPokemonArticle(pokemonGuideTitle(edition), signal), query);
}
export async function loadGuideArticle(item: GameGuide, appId: number | undefined, signal: AbortSignal): Promise<GuideArticle> {
  if (item.source === "bulbapedia") {
    const article = await loadPokemonArticle(item.id, signal);
    return { title: item.title, sections: [{ id: "walkthrough", title: item.title, html: article.html }], attribution: "Bulbapedia · CC BY-NC-SA 2.5" };
  }
  if (item.source === "steam" && appId && /^\d{1,20}$/.test(item.id)) {
    const id=validId(appId),key=`${id}:${item.id}`;
    // Keep only validated public article HTML. Re-parse on read so cached markup
    // always passes the current sanitizer and the selected game's identity check.
    let stored:Record<string,{at:number;html:string}>={};
    try{stored=JSON.parse(localStorage.getItem("harbor.games.guide-articles.v1")??"{}");const held=stored[key];if(held&&Date.now()-held.at<86_400_000)return parseSteamGuide(held.html,id);}catch{stored={};}
    return readGuideSource(`https://steamcommunity.com/sharedfiles/filedetails/?id=${item.id}&l=english`, signal, html=>{
      const article=parseSteamGuide(html,id);
      try{stored[key]={at:Date.now(),html};const entries=Object.entries(stored).filter(([,v])=>Date.now()-v.at<86_400_000).sort((a,b)=>b[1].at-a[1].at);let size=0;localStorage.setItem("harbor.games.guide-articles.v1",JSON.stringify(Object.fromEntries(entries.filter(([,v])=>(size+=v.html.length)<1_500_000).slice(0,8))));}catch{/* Storage is optional. */}
      return article;
    },600_000,{headers:steamGuideHeaders(id)});
  }
  if (item.source === "pcwiki") {
    const params = new URLSearchParams({ action:"parse", page:item.id.slice(0,180), prop:"text", format:"json", redirects:"1", origin:"*" });
    return readGuideSource(`https://www.pcgamingwiki.com/w/api.php?${params}`, signal,html=>parsePcGuide(JSON.parse(html),appId ? validId(appId):undefined));
  }
  throw Error("Unsupported guide source");
}
export async function loadGuideVideos(game: string, query: string, live: boolean, signal: AbortSignal, cursor?:GuideVideoCursor, sort:GuideVideoSort="popular", date:GuideVideoDate="year") {
  const ttl=live?60_000:600_000;
  if(cursor) return readGuideSource("https://www.youtube.com/youtubei/v1/search?prettyPrint=false",signal,html=>parseGuideVideoPage(JSON.parse(html),game,live,cursor.clientVersion),ttl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({context:{client:{clientName:"WEB",clientVersion:cursor.clientVersion,hl:"en"}},continuation:cursor.token})});
  const params = new URLSearchParams({ search_query:`${guideVideoGameName(game).slice(0,150)} ${query.trim().slice(0,100) || (live ? "" : "walkthrough guide")}`.trim(), hl:"en" });
  params.set("sp", guideVideoFilter(sort,date,live));
  return readGuideSource(`https://www.youtube.com/results?${params}`,signal,html=>parseGuideVideoPage(html,game,live),ttl);
}
export async function loadKickGuides(game:string,query:string,signal:AbortSignal) {
  const slug=game.toLowerCase().replace(/[’']/g,"").replace(/[^\p{L}\p{N}]+/gu,"-").replace(/^-|-$/g,"");
  const items=await readGuideSource(`https://kick.com/category/${encodeURIComponent(slug)}`,signal,html=>parseKickGuides(html,game),60_000);
  return items.filter(item=>!query || `${item.title} ${item.author}`.toLowerCase().includes(query.toLowerCase()));
}
