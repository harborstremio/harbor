const CHANNEL='harbor-spooktober';
export const isHarborEmbedded=true;
function send(intent,payload={}){window.__spookIntent({channel:CHANNEL,intent,...payload});return true}
function hostItem(item){
 const result={};
 for(const key of ['id','imdbId','title','type','year','creator','album','duration','description','runtime','imdbRating','seasonLabel','seasonYear']){
  const value=item[key];if(typeof value==='string'||typeof value==='number')result[key]=value;
 }
 if(Array.isArray(item.genres))result.genres=item.genres.filter(value=>typeof value==='string');
 if(typeof item.explicit==='boolean')result.explicit=item.explicit;
 for(const key of ['poster','source','preview','serviceUrl'])if(typeof item[key]==='string')result[key]=new URL(item[key],location.href).href;
 if(result.poster)result.image=result.poster;
 result.imdbId=[result.imdbId,result.source?.match(/imdb\.com\/title\/(tt\d+)(?:\/|$|\?)/)?.[1],result.id].find(value=>typeof value==='string'&&/^tt\d+$/.test(value));
 return result;
}
export function hostOpenItem(item){
 const intent={Film:'meta',Series:'meta',Music:'track'}[item?.type];if(!intent)return false;
 const metadata=hostItem(item);if(intent==='meta'&&!metadata.imdbId)return false;
 return send(intent,{item:metadata});
}
export function hostOpenVideo(video){if(!video||typeof video.id!=='string'||!/^[\w-]{11}$/.test(video.id))return false;return send('video',{item:{id:video.id,title:String(video.title||''),artist:String(video.artist||''),image:typeof video.image==='string'?new URL(video.image,location.href).href:''}})}
export function hostOpenPlaylist(id){return typeof id==='string'&&send('playlist',{id})}
export function notifyHarborReady(){return send('ready')}
export function initHarborBridge({onVisibilityChange}={}){
 document.body.classList.add('harbor-native');
 document.addEventListener('visibilitychange',()=>onVisibilityChange?.(document.hidden));
 function external(event){
  if(event.type==='auxclick'&&event.button!==1)return;
  const anchor=event.target.closest?.('a[href]');if(!anchor||event.defaultPrevented)return;
  const raw=anchor.getAttribute('href');if(!raw)return;
  if(raw.startsWith('#')){
   const target=document.querySelector(raw);if(target){event.preventDefault();target.scrollIntoView({behavior:document.body.classList.contains('motion-off')?'instant':'smooth',block:'start'});target.focus?.({preventScroll:true})}return;
  }
  let url;try{url=new URL(raw,location.href)}catch{return}
  if(!['http:','https:','tauri:'].includes(url.protocol))return;
  event.preventDefault();event.stopPropagation();send('external',{url:url.href});
 }
 document.addEventListener('click',external,true);document.addEventListener('auxclick',external,true);
 document.addEventListener('keydown',event=>{
  if(event.defaultPrevented||!(event.key==='Escape'||event.altKey&&event.key==='ArrowLeft'))return;
  event.preventDefault();event.stopPropagation();
  if(!window.__spookBack())send('back');
 });
}
