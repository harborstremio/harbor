// Studios keep shipping horror through October, so the shelf asks Cinemeta for what
// landed since the bundled snapshot instead of staying frozen at build time.
const CINEMETA='https://v3-cinemeta.strem.io/catalog';
const FEEDS=[['movie','catalog','Film'],['series','series','Series']];
const CACHE_KEY='spooktober.fresh.v1';
const CACHE_MS=6*60*60*1000;
const MAX_PER_FEED=14;

function posterFor(id){return `https://images.metahub.space/poster/medium/${id}/img`}

function toItem(meta,section,type){
 const id=typeof meta?.imdb_id==='string'&&meta.imdb_id?meta.imdb_id:meta?.id;
 if(typeof id!=='string'||!/^tt\d{6,}$/.test(id))return null;
 const title=typeof meta.name==='string'?meta.name.trim():'';
 if(!title)return null;
 const year=String(meta.releaseInfo??meta.year??'').slice(0,4);
 if(!/^\d{4}$/.test(year))return null;
 return {
  id,title,type,section,year,
  poster:typeof meta.poster==='string'&&meta.poster?meta.poster.replace('/poster/small/','/poster/medium/'):posterFor(id),
  description:typeof meta.description==='string'?meta.description:'',
  genres:Array.isArray(meta.genres)?meta.genres.filter(g=>typeof g==='string'):[],
  creator:typeof meta.director==='string'?meta.director:Array.isArray(meta.director)?meta.director.join(', '):'',
  source:`https://www.imdb.com/title/${id}/`,
  fresh:true,
 };
}

function readCache(){
 try{
  const raw=sessionStorage.getItem(CACHE_KEY);if(!raw)return null;
  const saved=JSON.parse(raw);
  if(!saved||typeof saved.at!=='number'||Date.now()-saved.at>CACHE_MS)return null;
  return Array.isArray(saved.items)?saved.items:null;
 }catch{return null}
}

function writeCache(list){
 try{sessionStorage.setItem(CACHE_KEY,JSON.stringify({at:Date.now(),items:list}))}catch{}
}

async function feed(kind,section,type,earliest){
 const response=await fetch(`${CINEMETA}/${kind}/top/genre=Horror.json`,{cache:'no-cache'});
 if(!response.ok)throw Error(kind);
 const metas=(await response.json())?.metas;
 if(!Array.isArray(metas))return [];
 const out=[];
 for(const meta of metas){
  const item=toItem(meta,section,type);
  if(item&&Number(item.year)>=earliest)out.push(item);
  if(out.length>=MAX_PER_FEED)break;
 }
 return out;
}

/** Adds anything newer than the bundled data to the front of New & coming soon. */
export async function loadFreshReleases(items,expandedShelves){
 const earliest=new Date().getFullYear()-1;
 let fresh=readCache();
 if(!fresh){
  const settled=await Promise.allSettled(FEEDS.map(([kind,section,type])=>feed(kind,section,type,earliest)));
  fresh=settled.flatMap(result=>result.status==='fulfilled'?result.value:[]);
  if(!fresh.length)return 0;
  writeCache(fresh);
 }
 const known=new Map(items.map(item=>[item.id,item]));
 const added=[];
 for(const item of fresh){
  const existing=known.get(item.id);
  if(existing){if(!existing.poster)existing.poster=item.poster;continue}
  known.set(item.id,item);items.push(item);added.push(item.id);
 }
 if(!added.length)return 0;
 const ordered=Array.isArray(expandedShelves.new)?expandedShelves.new:[];
 expandedShelves.new=[...added,...ordered.filter(id=>!added.includes(id))];
 return added.length;
}
