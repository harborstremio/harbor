import type { GameRelease } from "./release-data";
import type { GameSummary } from "./types";

export type ReleaseWindow = { start:number; end:number; precision:"day"|"month"|"quarter"|"year" };
export type SavedRelease = { label:string; platform:string; region?:string; window?:ReleaseWindow; cancelled:boolean };
export type SavedReleaseInfo = { source:"Steam"|"IGDB"; releases:SavedRelease[]; comingSoon?:boolean; cachedAt?:number };
export type SavedReleaseResult = { info?:SavedReleaseInfo; failed:boolean };
export type SavedReleaseFilter = "all"|"upcoming"|"released"|"unknown"|"cancelled";
export type SavedReleaseSort = "recent"|"next"|"name";
const months=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
const monthNumber=(value:string)=>/^(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)$/i.test(value)?months.indexOf(value.toLowerCase().slice(0,3)):-1;

/** A publisher's month/quarter/year is a window, never an invented launch day. */
export function releaseWindow(label:string):ReleaseWindow|undefined {
  const value=label.trim();let year=0,month=0,day=0,precision:ReleaseWindow["precision"]="day";
  let match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if(match){year=+match[1];month=+match[2]-1;day=+match[3];}
  else if((match=/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/.exec(value))){year=+match[3];month=monthNumber(match[2]);day=+match[1];}
  else if((match=/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/.exec(value))){year=+match[3];month=monthNumber(match[1]);day=+match[2];}
  else if((match=/^([A-Za-z]+)\s+(\d{4})$/.exec(value))){year=+match[2];month=monthNumber(match[1]);day=1;precision="month";}
  else if((match=/^Q([1-4])\s+(\d{4})$/i.exec(value))){year=+match[2];month=(+match[1]-1)*3;day=1;precision="quarter";}
  else if((match=/^(\d{4})$/.exec(value))){year=+match[1];day=1;precision="year";}
  else return;
  if(year<1900||year>2199||month<0||month>11||day<1||day>31)return;
  const start=Date.UTC(year,month,day),date=new Date(start);
  if(date.getUTCMonth()!==month||date.getUTCDate()!==day)return;
  const end=precision==="day"?start+86400_000:Date.UTC(year+(precision==="year"?1:0),precision==="year"?0:month+(precision==="quarter"?3:1),1);
  return {start,end,precision};
}

export function steamSavedRelease(release:string,comingSoon:boolean,cachedAt?:number):SavedReleaseInfo {
  return {source:"Steam",comingSoon,cachedAt,releases:[{label:release.trim(),platform:"PC",region:"US",window:releaseWindow(release),cancelled:false}]};
}
export function atlasSavedRelease(releases:GameRelease[],cachedAt?:number):SavedReleaseInfo {
  return {source:"IGDB",cachedAt,releases:releases.map(release=>{
    // Date-format IDs are references, not the deprecated category enum.
    const day=release.dateFormatName==="YYYYMMDD"&&release.date!==undefined?new Date(release.date*1000).toISOString().slice(0,10):"";
    const label=release.label||day,window=releaseWindow(label);
    const expected=release.dateFormatName==="YYYY"?"year":release.dateFormatName==="YYYYMM"?"month":/^YYYYQ[1-4]$/.test(release.dateFormatName??"")?"quarter":release.dateFormatName==="TBD"?"none":undefined;
    return {label,platform:release.platform.name,region:release.region?.name,window:expected&&expected!==window?.precision?undefined:window,cancelled:/cancel/i.test(release.status?.name??"")};
  })};
}
export function savedReleaseState(info:SavedReleaseInfo|undefined,now=Date.now()) {
  if(!info)return {status:"unknown" as const};
  const releases=info.releases.filter(release=>!release.cancelled),upcoming=releases.filter(release=>release.window&&release.window.end>now).sort((a,b)=>a.window!.start-b.window!.start);
  const past=releases.filter(release=>release.window&&release.window.end<=now).sort((a,b)=>b.window!.start-a.window!.start);
  const release=upcoming[0]??past[0]??releases[0]??info.releases[0];
  const status=info.comingSoon===true?"upcoming":info.comingSoon===false?"released":upcoming.length?"upcoming":past.length?"past":!releases.length&&info.releases.length?"cancelled":"unknown";
  return {status,release} as {status:"upcoming"|"released"|"past"|"unknown"|"cancelled";release?:SavedRelease};
}
export function savedReleaseGames(games:GameSummary[],results:Record<string,SavedReleaseResult>,query:string,filter:SavedReleaseFilter,sort:SavedReleaseSort,now=Date.now()):GameSummary[] {
  const search=query.normalize("NFKD").replace(/\p{M}/gu,"").toLocaleLowerCase().trim();
  const found=games.filter(game=>{const status=savedReleaseState(results[game.id]?.info,now).status;return game.name.normalize("NFKD").replace(/\p{M}/gu,"").toLocaleLowerCase().includes(search)&&(filter==="all"||status===filter||filter==="released"&&status==="past");});
  if(sort==="name")found.sort((a,b)=>a.name.localeCompare(b.name));
  if(sort==="next")found.sort((a,b)=>{
    const order=(game:GameSummary)=>{const state=savedReleaseState(results[game.id]?.info,now),window=state.release?.window;return state.status==="upcoming"&&window&&window.end>now?window.start:Infinity;};
    return order(a)-order(b)||games.indexOf(a)-games.indexOf(b);
  });
  return found;
}
