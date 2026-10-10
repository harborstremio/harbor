import { gameImage, parseSteamStoreItems } from "./steam-data";
import type { GameSummary } from "./types";

export const STEAM_STORE_PAGE_SIZE = 30;
export const STORE_COUNTRIES = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" ");
export function validStoreCountry(value: unknown): value is string { return value === "auto" || typeof value === "string" && STORE_COUNTRIES.includes(value); }
/** Read Steam's anonymous storefront region; language and currency are not country evidence. */
export function parseSteamStoreCountry(html: unknown): string {
  if (typeof html !== "string" || html.length > 4_000_000) throw Error("steam_store_country");
  const tag = /<div\b[^>]*\bid=["']application_config["'][^>]*>/i.exec(html)?.[0];
  const attribute = tag && /\bdata-config=(["'])(.*?)\1/i.exec(tag)?.[2];
  if (!attribute) throw Error("steam_store_country");
  const entities: Record<string, string> = {quot:'"',amp:"&",apos:"'",lt:"<",gt:">"};
  const decoded = attribute.replace(/&(#x[\da-f]+|#\d+|quot|amp|apos|lt|gt);/gi, (whole, entity: string) => {
    if (!entity.startsWith("#")) return entities[entity.toLowerCase()] ?? whole;
    const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2),16) : Number(entity.slice(1));
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
  let country: unknown;
  try { country = JSON.parse(decoded)?.COUNTRY; } catch { throw Error("steam_store_country"); }
  if (!validStoreCountry(country) || country === "auto") throw Error("steam_store_country");
  return country;
}
export function steamStoreQuery(query: string, enabled = true): string | null {
  if (!enabled) return null;
  const match = /^\s*st(?:\s+|:\s*)(.*)$/is.exec(query);
  return match ? match[1].trim().slice(0,180) : null;
}
export function steamStoreParameters(query: string, country: string, offset = 0) {
  if (!validStoreCountry(country) || !Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) throw Error("steam_store_request");
  const params = new URLSearchParams({term:query.trim().slice(0,180),start:String(offset),count:String(STEAM_STORE_PAGE_SIZE),category1:"998",l:"english",infinite:"1",ignore_preferences:"1",ndl:"1"});
  if (country !== "auto") params.set("cc", country);
  return params;
}
export function steamStoreUrl(appId: number, country: string, client = false) {
  if (!Number.isSafeInteger(appId) || appId <= 0 || appId > 0xffffffff || !validStoreCountry(country)) throw Error("steam_store_identity");
  const url = `https://store.steampowered.com/app/${appId}/${country === "auto" ? "" : `?cc=${country}`}`;
  return client ? `steam://openurl/${url}` : url;
}

export type SteamStoreOffer = { kind: "paid"; final: string; original?: string; discount?: number } | {kind:"free"|"unavailable"};
export type SteamStoreGame = GameSummary & {offer:SteamStoreOffer};
export type SteamStorePage = { games:SteamStoreGame[]; country:string; total:number; nextOffset:number|null; cachedAt?:number };
const record = (value:unknown):Record<string,unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string,unknown> : {};
const displayPrice = (value:unknown) => typeof value === "string" && value.trim().length <= 80 && !/[<>\u0000-\u001f\u007f]/.test(value) ? value.trim() : "";

export function parseSteamStoreOffer(value:unknown):SteamStoreOffer {
  const item=record(value), purchase=record(item.best_purchase_option), final=displayPrice(purchase.formatted_final_price);
  if(item.is_free===true)return {kind:"free"};
  // Use Steam's formatted regional values. A missing purchase option is not a free game.
  if(!final)return {kind:"unavailable"};
  const percent=purchase.discount_pct,original=displayPrice(purchase.formatted_original_price);
  const showDiscount=Number.isInteger(percent)&&Number(percent)>0&&Number(percent)<=100&&purchase.hide_discount_pct_for_compliance!==true&&purchase.price_cannot_be_displayed_as_discount!==true;
  return {kind:"paid",final,...(showDiscount?{discount:Number(percent),...(original&&original!==final?{original}:{})}:{})};
}
export function parseSteamStoreSearch(value:unknown,ids:number[],country:string,total:number,offset:number):SteamStorePage {
  steamStoreParameters("",country,offset);
  if(!Number.isSafeInteger(total)||total<0)throw Error("steam_store_response");
  const items=record(record(value).response).store_items;
  const games=ids.length?parseSteamStoreItems(value,ids).map(item=>{
    const {price:_,...game}=item;
    return {...game,offer:parseSteamStoreOffer(Array.isArray(items)?items.find(raw=>record(raw).appid===game.steamId):null)};
  }):[];
  return {games,country,total,nextOffset:ids.length&&offset+STEAM_STORE_PAGE_SIZE<total?offset+STEAM_STORE_PAGE_SIZE:null};
}
/** Region and page identity are part of the persisted cache contract. */
export function decodeSteamStoreSearch(key:string,value:unknown):SteamStorePage|null {
  const params=new URLSearchParams(key.slice("steam-store-search:v1:".length)),country=params.get("cc")??"auto",v=record(value);
  if(!validStoreCountry(country)||v.country!==country||!Array.isArray(v.games)||v.games.length>STEAM_STORE_PAGE_SIZE||!Number.isSafeInteger(v.total)||Number(v.total)<0)return null;
  const offset=Number(params.get("start"));
  if(!Number.isSafeInteger(offset)||offset<0||v.nextOffset!==null&&v.nextOffset!==offset+STEAM_STORE_PAGE_SIZE)return null;
  const seen=new Set<number>(),games:SteamStoreGame[]=[];
  for(const raw of v.games){
    const item=record(raw),id=item.steamId,offer=record(item.offer);
    if(!Number.isSafeInteger(id)||Number(id)<=0||Number(id)>0xffffffff||item.id!==`steam:${id}`||seen.has(Number(id))||typeof item.name!=="string"||!item.name.trim()||item.name.length>400||!Array.isArray(item.platforms)||item.platforms.some(x=>typeof x!=="string")||typeof item.comingSoon!=="boolean")return null;
    if(offer.kind!=="free"&&offer.kind!=="unavailable"&&offer.kind!=="paid")return null;
    if(offer.kind==="paid"&&(!displayPrice(offer.final)||offer.original!==undefined&&!displayPrice(offer.original)||offer.discount!==undefined&&(!Number.isInteger(offer.discount)||Number(offer.discount)<=0||Number(offer.discount)>100)))return null;
    seen.add(Number(id));games.push({id:`steam:${id}`,steamId:Number(id),name:item.name,capsule:gameImage(item.capsule),platforms:item.platforms as string[],comingSoon:item.comingSoon,...(typeof item.adultContent==="boolean"?{adultContent:item.adultContent}:{}),...(gameImage(item.portrait)?{portrait:gameImage(item.portrait)}:{}),...(Number.isSafeInteger(item.releaseTimestamp)&&Number(item.releaseTimestamp)>0?{releaseTimestamp:Number(item.releaseTimestamp)}:{}),offer:offer.kind==="paid"?{kind:"paid",final:displayPrice(offer.final),...(offer.original?{original:displayPrice(offer.original)}:{}),...(offer.discount?{discount:Number(offer.discount)}:{})}:{kind:offer.kind}});
  }
  return {games,country,total:Number(v.total),nextOffset:v.nextOffset as number|null};
}

export type SteamStorePreferences={country:string;showLibrary:boolean};
export const steamStorePreferencesKey=(profile:string)=>`harbor.games.steam-store.v1:${encodeURIComponent(profile)}`;
export function readSteamStorePreferences(profile:string):SteamStorePreferences {
  const raw=localStorage.getItem(steamStorePreferencesKey(profile));
  if(raw===null)return {country:"auto",showLibrary:true};
  if(raw.length>512)throw Error("steam_store_preferences");
  const value=JSON.parse(raw);
  if(!validStoreCountry(value?.country)||typeof value.showLibrary!=="boolean")throw Error("steam_store_preferences");
  return {country:value.country,showLibrary:value.showLibrary};
}
export function writeSteamStorePreferences(profile:string,patch:Partial<SteamStorePreferences>) {
  const next={...readSteamStorePreferences(profile),...patch};
  if(!validStoreCountry(next.country)||typeof next.showLibrary!=="boolean")throw Error("steam_store_preferences");
  localStorage.setItem(steamStorePreferencesKey(profile),JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("harbor:steam-store-preferences",{detail:profile}));return next;
}
