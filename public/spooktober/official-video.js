let apiPromise,activePlayer,loadGeneration=0,loadTimer,restorePreview;
function youtubeApi(){
 if(window.YT?.Player)return Promise.resolve(window.YT);
 if(apiPromise)return apiPromise;
 apiPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';
  const timeout=setTimeout(()=>reject(Error('Player unavailable')),8000);
  const previous=window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady=()=>{clearTimeout(timeout);previous?.();resolve(window.YT)};
  script.onerror=()=>{clearTimeout(timeout);reject(Error('Player unavailable'))};document.head.append(script);
 }).catch(error=>{apiPromise=null;throw error});
 return apiPromise;
}
export function stopOfficialVideo(){loadGeneration++;clearTimeout(loadTimer);activePlayer?.destroy();activePlayer=null;if(restorePreview){const {container,button}=restorePreview;container.replaceChildren(button);restorePreview=null}}
export async function playOfficialVideo(video,button){
 stopOfficialVideo();const generation=loadGeneration,container=button.closest('.video-player');restorePreview={container,button:button.cloneNode(true)};button.disabled=true;button.querySelector('strong').textContent='Opening video…';
 const fallback=()=>{
  if(generation!==loadGeneration||!container.isConnected)return;
  clearTimeout(loadTimer);activePlayer?.destroy();activePlayer=null;container.replaceChildren();
  const link=document.createElement('a');link.className='video-fallback';link.href=video.url;link.target='_blank';link.rel='noopener noreferrer';
  const image=document.createElement('img');image.src=video.image;image.alt='';
  const copy=document.createElement('span');const heading=document.createElement('strong');heading.textContent='Watch on YouTube ↗';
  const detail=document.createElement('small');detail.textContent='This video isn’t available in the embedded player.';
  copy.append(heading,detail);link.append(image,copy);container.append(link);link.focus({preventScroll:true});
 };
 try{
  const YT=await youtubeApi();if(generation!==loadGeneration||!container.isConnected)return;
  const mount=document.createElement('div');container.replaceChildren(mount);
  loadTimer=setTimeout(fallback,12000);
  activePlayer=new YT.Player(mount,{host:'https://www.youtube-nocookie.com',width:'100%',height:'100%',videoId:video.id,playerVars:{origin:location.origin,autoplay:1,playsinline:1,rel:0},events:{onReady:e=>{clearTimeout(loadTimer);e.target.getIframe().title=video.title+' — official artist video';e.target.playVideo()},onError:fallback}});
 }catch{fallback()}
}
