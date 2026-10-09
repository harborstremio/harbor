const CHANNEL='harbor-spooktober';
export const isHarborEmbedded=new URLSearchParams(location.search).get('embedded')==='1'&&window.parent!==window;
let dispose;

function send(intent,payload={}){
 if(!isHarborEmbedded)return false;
 window.parent.postMessage({channel:CHANNEL,intent,...payload},location.origin==='null'?'*':location.origin);
 return true;
}

function absoluteUrl(value){
 if(typeof value!=='string'||!value)return undefined;
 try{const url=new URL(value,location.href);return ['http:','https:','tauri:'].includes(url.protocol)?url.href:undefined}catch{return undefined}
}

function hostItem(item){
 const result={};
 for(const key of ['id','imdbId','title','type','year','creator','album','duration','description','runtime','imdbRating','seasonLabel','seasonYear','isbn','googleBooksId']){
  const value=item[key];if(typeof value==='string'||typeof value==='number')result[key]=value;
 }
 if(Array.isArray(item.genres))result.genres=item.genres.filter(value=>typeof value==='string');
 for(const key of ['poster','source','preview','serviceUrl']){const value=absoluteUrl(item[key]);if(value)result[key]=value}
 if(result.poster)result.image=result.poster;
 // Early curated entries use descriptive ids; their verified IMDb links are the stable native identity.
 result.imdbId=[result.imdbId,result.source?.match(/imdb\.com\/title\/(tt\d+)(?:\/|$|\?)/)?.[1],result.id].find(value=>typeof value==='string'&&/^tt\d+$/.test(value));
 return result;
}

export function hostOpenItem(item){
 // Book and manga ids identify curated editions, not Harbor's native providers.
 const intent={Film:'meta',Series:'meta',Music:'track'}[item?.type];
 if(!intent)return false;
 const metadata=hostItem(item);
 if(intent==='meta'&&!metadata.imdbId)return false;
 return send(intent,{item:metadata});
}
export function hostOpenPlaylist(id){return typeof id==='string'&&send('playlist',{id})}
export function notifyHarborReady(){return send('ready')}

export function initHarborBridge({onVisibilityChange}={}){
 dispose?.();if(!isHarborEmbedded)return;
 document.body.classList.add('harbor-embedded');
 function receive(event){
  if(event.source!==window.parent||event.origin!==location.origin||event.data?.channel!==CHANNEL)return;
  if(event.data.intent==='pause'||event.data.intent==='resume')onVisibilityChange?.(event.data.intent==='pause');
 }
 function external(event){
  if(event.type==='auxclick'&&event.button!==1)return;
  const anchor=event.target.closest?.('a[href]');if(!anchor||event.defaultPrevented)return;
  const raw=anchor.getAttribute('href');if(!raw||raw.startsWith('#'))return;
  const url=absoluteUrl(raw);if(!url)return;
  const next=new URL(url);
  if(next.origin===location.origin&&next.pathname===location.pathname&&next.search===location.search&&next.hash)return;
  event.preventDefault();event.stopPropagation();send('external',{url});
 }
 function back(event){
  if(event.defaultPrevented||!(event.key==='Escape'||event.altKey&&event.key==='ArrowLeft'))return;
  const detail=document.querySelector('#detail[open]');
  if(detail){event.preventDefault();event.stopPropagation();detail.close();return}
  if(document.querySelector('dialog[open],[role="dialog"][aria-modal="true"]'))return;
  if(document.querySelector('[aria-expanded="true"][aria-haspopup], [role="menu"]:not([hidden])'))return;
  event.preventDefault();event.stopPropagation();
  const nested=document.body.classList.contains('viewing-page');
  if(nested)document.querySelector('#page-back')?.click();else send('back');
 }
 addEventListener('message',receive);
 document.addEventListener('click',external,true);
 document.addEventListener('auxclick',external,true);
 document.addEventListener('keydown',back);
 dispose=()=>{removeEventListener('message',receive);document.removeEventListener('click',external,true);document.removeEventListener('auxclick',external,true);document.removeEventListener('keydown',back)};
}
