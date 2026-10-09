import type { GameMedia } from "./cross-media";

export type AdaptationTitle = { title: string; kind: "movie"|"series"; year?: number };
export type AdaptationIdentity = AdaptationTitle & { qid: string };
export type ExploreStory = GameMedia & { id: string; wikipediaTitle: string };
export const ADAPTATION_LISTS = [
  { title: "List of films based on video games", kind: "movie" },
  { title: "List of television series based on video games", kind: "series" },
] as const;
type RecordValue=Record<string,unknown>;
const record=(value:unknown):RecordValue=>value&&typeof value==="object"&&!Array.isArray(value)?value as RecordValue:{};
const array=(value:unknown):unknown[]=>Array.isArray(value)?value:[];
const text=(value:unknown)=>typeof value==="string"?value:"";

/** Only released adaptation tables: never directors, publishers, references,
 * documentaries, announced projects, or incidental mentions of video games. */
export function adaptationTitles(html:string,kind:AdaptationTitle["kind"]):AdaptationTitle[] {
  const doc=new DOMParser().parseFromString(html.replace(/<(script|style|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi,"").replace(/<img\b[^>]*>/gi,""),"text/html");
  const headings=new Map<number,string>(),titles=new Map<string,AdaptationTitle>();
  for(const node of doc.querySelectorAll("h2,h3,h4,h5,h6,table.wikitable,.div-col li")){
    if(/^H[2-6]$/.test(node.tagName)){
      const level=Number(node.tagName[1]);for(const key of headings.keys())if(key>=level)headings.delete(key);
      headings.set(level,node.textContent??"");continue;
    }
    if([...headings.values()].some(value=>/upcoming|in development|documentar|plots centered|unscripted|see also|notes|references|external links/i.test(value)))continue;
    if(node.tagName==="LI"){
      if(kind!=="series" || [...headings.values()].some(value=>/OVA series/i.test(value)))continue;
      // List entries link the adaptation in their own italic title. Never take
      // a nested franchise member, citation, or the source game's section link.
      const link=node.querySelector<HTMLAnchorElement>(':scope > i > a[href^="/wiki/"]:not(.new)');
      const href=link?.getAttribute("href")??"";if(!href||href.includes("#"))continue;
      const own=node.cloneNode(true) as HTMLElement;own.querySelectorAll("ul,ol,sup").forEach(child=>child.remove());
      const year=own.textContent?.match(/\b(?:19|20)\d{2}\b/)?.[0];if(!year)continue;
      try{const title=decodeURIComponent(href.slice(6)).replaceAll("_"," ");titles.set(title,{title,kind,year:Number(year)});}catch{ /* Invalid article encoding. */ }
      continue;
    }
    const rows=[...node.querySelectorAll("tr")],header=rows[0];if(!header)continue;
    const columns=[...header.children].map(cell=>cell.textContent?.trim()??"");
    const titleIndex=columns.findIndex(value=>/^title$/i.test(value)),dateIndex=columns.findIndex(value=>/release date|original airing|original release|first aired/i.test(value));
    if(titleIndex<0)continue;
    for(const row of rows.slice(1)){
      const cell=row.children[titleIndex];if(!cell||cell.hasAttribute("colspan"))continue;
      const link=cell.querySelector<HTMLAnchorElement>('a[href^="/wiki/"]:not(.new)');
      if(!link)continue;
      const href=link.getAttribute("href")??"";if(href.includes("#"))continue;
      let title:string;try{title=decodeURIComponent(href.slice(6)).replaceAll("_"," ");}catch{continue;}
      if(!title||/^(?:File|Help|Category|Wikipedia|Template|Special):/i.test(title))continue;
      const dates=dateIndex>=0?row.children[dateIndex]?.textContent??"":"";
      if(/TBA|in development/i.test(dates))continue;
      const year=dates.match(/\b(?:19|20)\d{2}\b/)?.[0];
      titles.set(title,{title,kind,year:year?Number(year):undefined});
    }
  }
  return [...titles.values()].sort((a,b)=>(b.year??0)-(a.year??0)||a.title.localeCompare(b.title));
}
export function adaptationIdentities(data:unknown,titles:AdaptationTitle[]):AdaptationIdentity[] {
  const query=record(record(data).query),aliases=new Map<string,string>();
  for(const value of [...array(query.normalized),...array(query.redirects)]){const row=record(value);aliases.set(text(row.from),text(row.to));}
  const canonical=(title:string)=>{let next=title;for(let i=0;i<5&&aliases.has(next);i++)next=aliases.get(next)!;return next;};
  const wanted=new Map(titles.map(item=>[canonical(item.title),item]));
  const pages=new Map(Object.values(record(query.pages)).map(value=>{const page=record(value);return [text(page.title),page] as const;}));
  return [...wanted.entries()].flatMap(([title,seed])=>{
    const page=pages.get(title);if(!page)return [];
    const qid=text(record(page.pageprops).wikibase_item);
    return /^Q[1-9]\d*$/.test(qid)&&!("missing" in page)?[{...seed,title,qid}]:[];
  });
}
function claims(entity:RecordValue,key:string):unknown[] {
  return array(record(entity.claims)[key]).filter(value=>record(value).rank!=="deprecated").map(value=>record(record(record(value).mainsnak).datavalue).value);
}
export function parseExploreStories(data:unknown,candidates:AdaptationIdentity[]):ExploreStory[] {
  const entities=record(record(data).entities);
  return candidates.flatMap(seed=>{
    const entity=record(entities[seed.qid]),name=text(record(record(entity.labels).en).value);
    const imdbId=claims(entity,"P345").find(value=>typeof value==="string"&&/^tt\d{5,12}$/.test(value)) as string|undefined;
    const tmdbId=Number(claims(entity,seed.kind==="series"?"P4983":"P4947").find(value=>typeof value==="string"&&/^[1-9]\d*$/.test(value)));
    if(!name||!imdbId||!Number.isSafeInteger(tmdbId)||tmdbId<=0)return [];
    const classifications=[...claims(entity,"P31"),...claims(entity,"P136")].map(value=>record(value).id);
    const year=seed.year??Number(text(record([...claims(entity,"P577"),...claims(entity,"P580")][0]).time).match(/^\+(\d{4})-/)?.[1]);
    return [{id:seed.qid,qid:seed.qid,name,kind:seed.kind,imdbId,tmdbId,year:year||undefined,wikipediaTitle:seed.title,relation:"adaptation",adult:classifications.some(id=>["Q291","Q185529","Q17194"].includes(String(id))),parody:classifications.includes("Q622548")} satisfies ExploreStory];
  });
}
export function adaptationWikipediaUrl(title:string) { return "https://en.wikipedia.org/wiki/"+encodeURIComponent(title.replaceAll(" ","_")); }
