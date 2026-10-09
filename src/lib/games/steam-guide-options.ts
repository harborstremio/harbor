/** Public Steam guide-browser filters, verified against its category/language form. */
export const STEAM_GUIDE_CATEGORIES = [
  ["Achievements","achievements"],["Characters","characters"],["Classes","classes"],["Co-op","coop"],
  ["Crafting","crafting"],["Game Modes","modes"],["Gameplay Basics","basics"],["Loot","loot"],
  ["Maps or Levels","maps"],["Modding or Configuration","modding"],["Multiplayer","multiplayer"],
  ["Secrets","secrets"],["Story or Lore","story"],["Trading","trading"],["Walkthroughs","walkthroughs"],
  ["Weapons","weapons"],["Workshop","workshop"],
] as const;
export const STEAM_GUIDE_LANGUAGES = [
  ["English","en"],["Bulgarian","bg"],["schinese","zh-Hans"],["tchinese","zh-Hant"],["Czech","cs"],
  ["Danish","da"],["Dutch","nl"],["Finnish","fi"],["French","fr"],["German","de"],["Greek","el"],
  ["Hungarian","hu"],["Italian","it"],["Japanese","ja"],["Korean","ko"],["Norwegian","no"],
  ["Polish","pl"],["Portuguese","pt-PT"],["brazilian","pt-BR"],["Romanian","ro"],["Russian","ru"],
  ["Spanish","es"],["Swedish","sv"],["Thai","th"],["Turkish","tr"],["Ukrainian","uk"],
  ["latam","es-419"],["vietnamese","vi"],
] as const;
export const STEAM_GUIDE_PERIODS = [1,7,90,180,365] as const;
export type SteamGuideFilters = { sort:"popular"|"rated"|"recent"; days:number; categories:string[]; language:string };
/** Public community preference for the exact game the user has opened, not a login cookie. */
export function steamGuideHeaders(appId:number):HeadersInit {
  if(!Number.isSafeInteger(appId)||appId<=0)throw Error("Invalid guide game");
  return {Cookie:`wants_mature_content_apps=${appId}`};
}
export function defaultSteamGuideFilters(locale:string):SteamGuideFilters {
  const language=STEAM_GUIDE_LANGUAGES.find(([,code])=>code===locale || code.split("-")[0]===locale)?.[0]??"";
  return {sort:"rated",days:7,categories:[],language};
}
export function normalizeSteamGuideFilters(filters:SteamGuideFilters):SteamGuideFilters {
  return {
    sort:["popular","rated","recent"].includes(filters.sort)?filters.sort:"rated",
    days:STEAM_GUIDE_PERIODS.includes(filters.days as typeof STEAM_GUIDE_PERIODS[number])?filters.days:7,
    categories:STEAM_GUIDE_CATEGORIES.map(([value])=>value).filter(value=>filters.categories.includes(value)),
    language:STEAM_GUIDE_LANGUAGES.some(([value])=>value===filters.language)?filters.language:"",
  };
}
export function steamGuidesUrl(appId:number,query:string,page:number,filters:SteamGuideFilters):string {
  if(!Number.isSafeInteger(appId)||appId<=0||!Number.isSafeInteger(page)||page<1||page>100000)throw Error("Invalid guide catalog page");
  const chosen=normalizeSteamGuideFilters(filters),order={popular:"trend",rated:"toprated",recent:"mostrecent"}[chosen.sort];
  const params=new URLSearchParams({l:"english",browsefilter:order,browsesort:order,p:String(page),numperpage:"30",searchText:query.trim().slice(0,180)});
  if(chosen.sort==="popular")params.set("days",String(chosen.days));
  for(const tag of [...chosen.categories,...(chosen.language?[chosen.language]:[])])params.append("requiredtags[]",tag);
  return `https://steamcommunity.com/app/${appId}/guides/?${params}`;
}
