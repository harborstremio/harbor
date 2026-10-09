import { safeFetchBytes } from "@/lib/safe-fetch";
import { ADAPTATION_LISTS, adaptationTitles, adaptationIdentities, parseExploreStories, type AdaptationTitle, type ExploreStory } from "./explore-stories";

const TTL=24*60*60_000,PAGE_SIZE=24;
let catalog:{at:number;titles:AdaptationTitle[]}|undefined;
const pages=new Map<number,{at:number;games:ExploreStory[];nextOffset:number|null}>();
async function request(host:string,params:Record<string,string>,signal:AbortSignal):Promise<unknown> {
  const url=`https://${host}/w/api.php?${new URLSearchParams({...params,format:"json",origin:"*"})}`;
  const response=await safeFetchBytes(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])},15000,2*1024*1024);
  if(!response.ok)throw Error(`Wikipedia ${response.status}`);
  const data=await response.json();if(data?.error)throw Error("Adaptation catalog unavailable");return data;
}
async function index(signal:AbortSignal) {
  if(catalog&&Date.now()-catalog.at<TTL)return catalog.titles;
  const lists=await Promise.all(ADAPTATION_LISTS.map(async list=>{
    const raw=await request("en.wikipedia.org",{action:"parse",page:list.title,prop:"text"},signal) as {parse?:{text?:{"*"?:string}}};
    if(!raw.parse?.text?.["*"])throw Error("Adaptation list unavailable");
    const titles=adaptationTitles(raw.parse.text["*"],list.kind);
    if(!titles.length)throw Error("Adaptation list has no recognized titles");
    return titles;
  }));
  // Alternate film and television choices so neither catalog buries the other.
  const titles:AdaptationTitle[]=[];
  for(let i=0;i<Math.max(...lists.map(list=>list.length));i++)for(const list of lists)if(list[i])titles.push(list[i]);
  signal.throwIfAborted();catalog={at:Date.now(),titles};return titles;
}
export async function loadExploreStories(offset:number,signal:AbortSignal) {
  signal.throwIfAborted();
  if(!Number.isSafeInteger(offset)||offset<0)throw Error("Invalid adaptation cursor");
  const held=pages.get(offset);if(held&&Date.now()-held.at<TTL)return held;
  const titles=await index(signal),batch=titles.slice(offset,offset+PAGE_SIZE);
  if(!batch.length)return {games:[],nextOffset:null};
  const identities=adaptationIdentities(await request("en.wikipedia.org",{action:"query",titles:batch.map(item=>item.title).join("|"),redirects:"1",prop:"pageprops",ppprop:"wikibase_item"},signal),batch);
  const raw=identities.length?await request("www.wikidata.org",{action:"wbgetentities",ids:[...new Set(identities.map(item=>item.qid))].join("|"),props:"labels|claims",languages:"en"},signal):{};
  const result={at:Date.now(),games:parseExploreStories(raw,identities),nextOffset:offset+PAGE_SIZE<titles.length?offset+PAGE_SIZE:null};
  signal.throwIfAborted();pages.set(offset,result);if(pages.size>40)pages.delete(pages.keys().next().value!);return result;
}
