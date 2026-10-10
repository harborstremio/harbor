import { channelsForLeague, requestSportsYoutubeText } from './youtube-videos';
import type { AthleteVideo } from './athlete-videos';

export type AthleteYoutubeVideo = AthleteVideo & {publisher:string;youtube:true};
const normalize = (value:string) => value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const text = (value:any):string => typeof value?.simpleText==='string' ? value.simpleText : Array.isArray(value?.runs) ? value.runs.map((v:any)=>typeof v?.text==='string'?v.text:'').join('') : '';

/** Athlete archives include career highlights; event date windows must not apply here. */
export function parseAthleteYoutubePage(html:string, name:string, channel?:{id:string;name:string}):AthleteYoutubeVideo[] {
  if (html.length>4_000_000 || normalize(name).length<4) return [];
  const marker=/(?:var\s+ytInitialData\s*=|window\["ytInitialData"\]\s*=)\s*/.exec(html);
  if(!marker)return [];
  const start=html.indexOf('{',marker.index+marker[0].length);
  let depth=0, quoted=false, escaped=false, end=-1;
  for(let i=start;i>=0&&i<html.length;i++){
    const c=html[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}
    else if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){end=i+1;break;}
  }
  if(end===-1)return [];
  try {
    const data=JSON.parse(html.slice(start,end));
    if(channel && data?.metadata?.channelMetadataRenderer?.externalId!==channel.id)return [];
    const result:AthleteYoutubeVideo[]=[],seen=new Set<string>(),stack=[data.contents];let visited=0;
    while(stack.length&&visited++<20_000&&result.length<12){
      const node=stack.pop();if(!node||typeof node!=='object')continue;
      const v=node.videoRenderer||node.gridVideoRenderer;
      if(v){
        const id=v.videoId,title=text(v.title).slice(0,300),byline=v.ownerText||v.shortBylineText||v.longBylineText;
        const owner=byline?.runs?.find((run:any)=>run?.navigationEndpoint?.browseEndpoint?.browseId);
        const ownerId=owner?.navigationEndpoint?.browseEndpoint?.browseId;
        const status=JSON.stringify([v.badges,v.thumbnailOverlays]);
        if(typeof id==='string'&&/^[\w-]{11}$/.test(id)&&!seen.has(id)&&` ${normalize(title)} `.includes(` ${normalize(name)} `)
          && !v.upcomingEventData&&!v.isLiveNow&&!/"(?:LIVE|UPCOMING|BADGE_STYLE_TYPE_LIVE_NOW)"/.test(status)
          &&(!channel||ownerId===channel.id)){
          seen.add(id);result.push({id:`youtube:${id}`,title,publisher:channel?.name||text(byline).slice(0,100)||'YouTube',youtube:true,
            image:`https://i.ytimg.com/vi/${id}/hqdefault.jpg`,url:`https://www.youtube.com/watch?v=${id}`,
            embed:`https://www.youtube-nocookie.com/embed/${id}?autoplay=0&rel=0`,duration:text(v.lengthText).slice(0,15)||undefined});
        }
      }
      // Preserve the provider's search ranking and ignore ads/sidebars.
      if(!node.adSlotRenderer&&!node.promotedSparklesWebRenderer)for(const value of Object.values(node).reverse())if(value&&typeof value==='object')stack.push(value);
    }
    return result;
  }catch{return [];}
}

const cache=new Map<string,{until:number;videos:AthleteYoutubeVideo[]}>();
export async function loadAthleteYoutubeVideos(name:string,league:string,signal:AbortSignal):Promise<AthleteYoutubeVideo[]>{
  signal.throwIfAborted();
  if(!name.trim()||normalize(name).length<4)return [];
  const key=`${league}:${normalize(name)}`,held=cache.get(key);
  if(held&&held.until>Date.now())return held.videos;
  const timeout=AbortSignal.any([signal,AbortSignal.timeout(14_000)]),channel=channelsForLeague(league)[0];
  let videos:AthleteYoutubeVideo[]=[];
  if(channel){
    try {
      const params=new URLSearchParams({query:`${name.slice(0,100)} highlights`,hl:'en'});
      videos=parseAthleteYoutubePage(await requestSportsYoutubeText(`https://www.youtube.com/channel/${channel.id}/search?${params}`,timeout),name,channel);
    }catch{timeout.throwIfAborted();}
  }
  if(!videos.length){
    const params=new URLSearchParams({search_query:`${name.slice(0,100)} ${league.slice(0,40)} highlights`,hl:'en',sp:'EgIQAQ=='});
    videos=parseAthleteYoutubePage(await requestSportsYoutubeText(`https://www.youtube.com/results?${params}`,timeout),name);
  }
  signal.throwIfAborted();
  if(videos.length){cache.set(key,{until:Date.now()+30*60_000,videos});while(cache.size>48)cache.delete(cache.keys().next().value!);}
  return videos;
}
