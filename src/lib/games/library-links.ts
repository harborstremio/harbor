import type { GameSummary } from "./types";

export type GameLink = { name: string; url: string };
export type LibraryLinkItem = { id: string; name: string; game?: GameSummary; links?: GameLink[] };
export type LibraryLinkChange = { id: string; order: string[]; expectedOrder?: string[] };
export const MAX_GAME_LINKS = 200;

export function validGameLinkUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > 4096 || value !== value.trim() || /[\x00-\x20\x7f]/.test(value)) return false;
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !!url.hostname && !url.username && !url.password; } catch { return false; }
}
/** Ignore malformed provider fields without changing the remaining destinations. */
export function gameLinks(value: unknown): GameLink[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0,MAX_GAME_LINKS).flatMap(item => item && typeof item === "object" && typeof item.name === "string" && item.name.trim() && item.name.length <= 300 && !/[\x00-\x1f\x7f]/.test(item.name) && validGameLinkUrl(item.url) ? [{name:item.name,url:item.url}] : []);
}
export function websiteGameLinks(value: unknown): GameLink[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0,MAX_GAME_LINKS).flatMap(item => {
    const url = typeof item === "string" ? item.trim() : typeof item?.url === "string" ? item.url.trim() : "";
    return validGameLinkUrl(url) ? [{name:new URL(url).hostname.replace(/^www\./,""),url}] : [];
  });
}
export function validLibraryLinkOrder(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= MAX_GAME_LINKS && value.every(validGameLinkUrl) && new Set(value).size === value.length;
}
/** A saved order references URLs only. New links append; missing links never reappear. */
export function orderedLibraryLinks(links: readonly GameLink[], order?: readonly string[]): GameLink[] {
  if (!order?.length) return [...links];
  const ranks = new Map(order.map((url,index)=>[url,index]));
  return links.map((link,index)=>({link,index,rank:ranks.get(link.url)??order.length})).sort((a,b)=>a.rank-b.rank||a.index-b.index).map(item=>item.link);
}
export function sortLibraryLinks(links: readonly GameLink[], locale = "en"): GameLink[] {
  const compare = new Intl.Collator(locale,{sensitivity:"accent",numeric:false}).compare;
  // Give URLs differing only by case a deterministic order before preserving exact ties.
  return links.map((link,index)=>({link,index})).sort((a,b)=>compare(a.link.url,b.link.url)||(a.link.url<b.link.url?-1:a.link.url>b.link.url?1:0)||a.index-b.index).map(item=>item.link);
}
export function knownGameLinks(id: string, ...records: (GameSummary | null | undefined)[]): GameLink[] {
  const result: GameLink[] = [], seen = new Set<string>();
  const add = (link: GameLink) => { const key = JSON.stringify([link.name,link.url]); if (!seen.has(key) && validGameLinkUrl(link.url)) {seen.add(key);result.push(link);} };
  const steamId = records.find(record=>record?.steamId)?.steamId ?? (/^steam:[1-9]\d*$/.test(id) ? Number(id.slice(6)) : undefined);
  if (steamId && Number.isSafeInteger(steamId) && steamId > 0 && steamId <= 0xffffffff) {
    add({name:"Steam",url:`https://store.steampowered.com/app/${steamId}/`});
    add({name:"Steam Community",url:`https://steamcommunity.com/app/${steamId}/`});
  }
  for (const record of records) {
    for (const link of gameLinks(record?.links)) add(link);
    if (record?.sourceListing) for (const link of gameLinks([{name:record.sourceListing.sourceName,url:record.sourceListing.page}])) add(link);
  }
  return result.slice(0,MAX_GAME_LINKS);
}
export function reviewLibraryLinks(items: readonly LibraryLinkItem[], entries: Record<string,{linkOrder?:string[]}>, locale: string, restore = false) {
  return [...new Map(items.map(item=>[item.id,item])).values()].map(item=>{
    const links = item.links ?? knownGameLinks(item.id,item.game), order = entries[item.id]?.linkOrder;
    const current = orderedLibraryLinks(links,order), next = restore ? [...links] : sortLibraryLinks(current,locale);
    return {...item,current,next,changed:current.some((link,index)=>link.url!==next[index]?.url),order:restore?[]:[...new Set(next.map(link=>link.url))],expectedOrder:order};
  });
}
