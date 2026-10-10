// Devil's Night belongs to Gotham. This shelf exists on October 31 and no other day.
const CINEMETA='https://v3-cinemeta.strem.io/meta/movie';
const GOTHAM=['tt14324650','tt14402926','tt0106364'];
const SECTION='gotham';

export const HALLOWEEN_NIGHT_SECTION=[SECTION,'**','DEVIL’S NIGHT','Halloween night in Gotham','Only tonight.'];

export function isHalloweenNight(date=new Date()){
 return date.getMonth()===9&&date.getDate()===31;
}

function toItem(meta){
 const id=typeof meta?.imdb_id==='string'&&meta.imdb_id?meta.imdb_id:meta?.id;
 if(typeof id!=='string'||!/^tt\d{6,}$/.test(id))return null;
 const title=typeof meta.name==='string'?meta.name.trim():'';
 if(!title)return null;
 return {
  id,title,type:'Film',section:SECTION,
  year:String(meta.releaseInfo??meta.year??'').slice(0,4),
  poster:typeof meta.poster==='string'&&meta.poster?meta.poster.replace('/poster/small/','/poster/medium/'):`https://images.metahub.space/poster/medium/${id}/img`,
  description:typeof meta.description==='string'?meta.description:'',
  genres:Array.isArray(meta.genres)?meta.genres.filter(g=>typeof g==='string'):[],
  creator:typeof meta.director==='string'?meta.director:Array.isArray(meta.director)?meta.director.join(', '):'',
  runtime:typeof meta.runtime==='string'?meta.runtime:'',
  source:`https://www.imdb.com/title/${id}/`,
  shelfLabel:'Halloween night',
 };
}

/** Returns how many Gotham films joined the catalogue; zero on any night but the 31st. */
export async function loadHalloweenNight(items,date=new Date()){
 if(!isHalloweenNight(date))return 0;
 const known=new Set(items.map(item=>item.id));
 const settled=await Promise.allSettled(GOTHAM.filter(id=>!known.has(id)).map(async id=>{
  const response=await fetch(`${CINEMETA}/${id}.json`,{cache:'no-cache'});
  if(!response.ok)throw Error(id);
  return toItem((await response.json())?.meta);
 }));
 let added=0;
 for(const result of settled){
  if(result.status!=='fulfilled'||!result.value)continue;
  items.push(result.value);added+=1;
 }
 return added;
}
