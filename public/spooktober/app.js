import {twilightMarkup,initTwilight,spotlightsMarkup} from './cult-features.js?v=22325b118b';
import {mountHorrorPaths} from './horror-paths.js?v=30bf8db3ea';
import {playlistPage,initPlaylistPage} from './playlist-pages.js?v=e5a1a11f67';
import {createPageNavigation} from './page-navigation.js?v=7cd41f8d91';
import {initInlineSurface} from './inline-surface.js?v=6e1bc38cc9';
import {setEditorialCollections,editorialMarkup,editorialCollection,collectionDialog} from './editorial.js?v=5df726cbd6';
import {initBackToTop} from './back-to-top.js?v=225191b8d7';
import {mastersMarkup,initMasters,DIRECTORS} from './masters.js?v=1a46ac5da7';
import {setMusicCollections,musicCollections,playlistMarkup,mixArt} from './mixtapes.js?v=775e223144';
import {playOfficialVideo,stopOfficialVideo} from './official-video.js?v=4d1ff16c58';
import {heroMarkup,shudderShelf,musicWorld,videoDialog,initCinema} from './cinema.js?v=9ada986878';
import {createCatalog} from './catalog.js?v=505aa6ad9f';
import {initSceneLife} from './scene-life.js?v=98eb23e78d';
import {initHeroDepth} from './hero-depth.js?v=d07a6b5daa';
import {railMarkup,initRails,scrollRail,updateRail} from './rails.js?v=a56521c2bb';
import {loadFreshReleases} from './fresh-releases.js?v=fd2831878e';
import {loadHalloweenNight,isHalloweenNight,HALLOWEEN_NIGHT_SECTION} from './halloween-night.js?v=21842b1d69';
import {initShudderArt} from './shudder-art.js?v=4f8a5e3ec3';
import {mountEncounter} from './encounter.js?v=01a1931711';
import {isHarborEmbedded,initHarborBridge,hostOpenItem,hostOpenPlaylist,notifyHarborReady} from './harbor-bridge.js?v=b5675d7b97';
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const displayYear=item=>item.yearBasis==='English edition'?item.year+' edition':item.year;
const inlineSurface=initInlineSurface($('#detail'));
const pages=createPageNavigation(()=>{$$('#song-audio,#playlist-audio').forEach(audio=>{audio.dispatchEvent(new Event('spook:pause'));audio.pause()});stopOfficialVideo()},()=>restorePageRoute());
let restoringRoute=false;
let twilightData={items:[]},spotlightData=[];
let songShelf={songIds:[]},mangaShelf=null,horrorPaths=null,seriesHighlights=[],expandedShelves={};
function showFullPage(html,trigger,key,title){pages.show(html,{key,title,trigger,replace:restoringRoute});}
const art = name => `assets/art/${name}.svg`;
let screening={features:[],shudder:[],videos:[]};
let musicUnavailable=false, catalogView, directorContext=null, playlistContext=null, collectionContext=null, dialogFromCatalog=false;
let items = [], saved = new Set(), lastTrigger = null;
try { const data=JSON.parse(localStorage.getItem('harbor-spookfest-list')||'[]'); if(Array.isArray(data)) saved=new Set(data.filter(x=>typeof x==='string')); } catch {}
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let motion = !reduced.matches;
let hostPaused=false;
try { motion = !reduced.matches && localStorage.getItem('harbor-spookfest-motion') !== 'off'; } catch {}
const sectionDefinitions = [
  ['classics','01','THE OLD GROUNDS','Halloween classics','Essential horror films.'],
  ['new','02','FRESHLY UNEARTHED','New & coming soon','2026 releases.'],
  ['series','03','THE LONG WAY HOME','Horror series','Find your next series.'],
  ['books','04','THE FORBIDDEN LIBRARY','Horror books','Your Halloween reading list.'],
  ['manga','05','BEYOND THE VEIL','Horror manga','Discover horror manga.'],
  ['cozy','06','THE PUMPKIN PATCH','Halloween favorites','For a lighter Halloween.'],
  ['modern','07','','Modern horror','Contemporary horror.'],
  ['international','08','','Horror from around the world','International films.'],
  ['music','09','','Halloween songs','Listen to song previews.'],
  ['true-crime','10','','Reality is scarier than fiction','True-crime documentaries.'],
  ['anime','11','','Anime after dark','Anime series & films.'],
];
const POSTER_LABELS={halloween:'Slasher',shining:'Psychological',thing:'Sci-fi horror',psycho:'Suspense',alien:'Sci-fi horror',exorcist:'Possession',dracula:'Gothic novel',frankenstein:'Gothic novel',uzumaki:'Junji Ito',tomie:'Junji Ito',gyo:'Junji Ito',coraline:'Stop-motion','hallow-eve':'Anthology',backrooms:'Horror',obsession:'Horror','other-mommy':'Oct 9',tt39143902:'Horror' };
function malScore(item){return Number.isInteger(item.malId)&&item.malId>0&&Number.isFinite(item.malRating)&&item.malRating>0&&item.malRating<=10?item.malRating.toFixed(2):null;}
function cardRatings(item){
 const imdb=item.imdbRating?`<span class="media-rating imdb-rating"><img src="assets/services/imdb.svg" alt="IMDb" width="28" height="14"><span>${escape(item.imdbRating)}</span></span>`:'';
 const mal=malScore(item);if(!mal)return imdb;
 const entry=[item.malTitle||item.title,item.malYear].filter(Boolean).join(' · ');
 const label=`MyAnimeList: ${mal} / 10 — ${entry}`;
 return `<span class="media-ratings">${imdb}<span class="media-rating mal-rating" title="${escape(label+(item.malCheckedAt?' · Checked '+item.malCheckedAt:''))}"><img src="assets/services/myanimelist.svg" alt="MAL" width="30" height="12"><span>${mal}</span></span></span>`;
}
function card(item,decorated=false) {
 const label=decorated?(item.shelfLabel || POSTER_LABELS[item.id] || (item.type==='Music'?Math.floor(item.duration/60)+':'+String(item.duration%60).padStart(2,'0'):item.type==='Manga'?'Manga':item.type==='Book'?'Book':item.release?.includes('In theaters')?'In theaters':item.genres?.[1]||item.genres?.[0]||item.type)):'';
 const metadata=item.type==='Music'?item.creator:([item.seasonLabel||displayYear(item),(item.runtime&&!item.seasonLabel?item.runtime+(item.type==='Series'?' / ep.':''):'') || (item.type==='Book'||item.type==='Manga'?item.creator:item.seasonLabel?item.seasonYear:item.type)].filter(Boolean).join(' · '));
 return `<button class="media-card ${item.type==='Music'?'music-card':''}" data-item="${item.id}" aria-label="View ${escape(item.title)}, ${item.type}, ${item.year}${decorated&&malScore(item)?', MyAnimeList '+malScore(item)+' out of 10 for '+escape(item.malTitle||item.title)+(item.malYear?' '+escape(item.malYear):''):''}"><span class="poster-mat"><span class="poster-wrap"><img src="${item.poster}" alt="" loading="lazy" width="320" height="480"></span>${label?`<span class="poster-label ${item.type==='Music'?'label-music':''}">${escape(label)}</span>`:''}</span><span class="media-title">${escape(item.title)}</span><span class="media-meta" title="${escape(metadata)}">${escape(metadata)}</span>${decorated?cardRatings(item):''}</button>`;
}
function shelf(def) {
 const [id,n,kicker,title,description]=def;
 const ordered=expandedShelves[id]||(id==='music'?songShelf.songIds:id==='manga'?mangaShelf?.collection?.itemIds:id==='series'?[...new Set([...seriesHighlights.map(i=>i.id),...items.filter(i=>i.section==='series').map(i=>i.id)])]:null);
 const lookup=new Map(items.map(i=>[i.id,i]));
 const selected=ordered?.length?ordered.map(id=>lookup.get(id)).filter(Boolean):items.filter(i=>i.section===id);
 if(!selected.length)return '';
 const scenery=id==='new'?`<div class="shelf-garden" aria-hidden="true"><img class="garden-tree" src="${art('foreground-tree')}" alt=""><img class="garden-ghost" src="${art('ghost-float')}" alt=""><img class="garden-stone-front" src="${art('headstone-ornate')}" alt=""><img class="garden-grass" src="${art('grass-clump')}" alt=""></div>`:id==='books'?`<div class="reading-stone" aria-hidden="true"><img src="${art('headstone-cross')}" alt=""><img src="${art('grass-clump')}" alt=""></div>`:'';
 return `<section id="section-${id}" class="shelf scene ${id==='cozy'?'cozy-shelf':''}" data-section="${id}" tabindex="-1" aria-labelledby="heading-${id}">
   
   <div class="section-top"><div class="section-heading"><img class="collection-icon" src="assets/icons/${({classics:'midnight-film',new:'candle',series:'ghost-tv',books:'haunted-book',manga:'ink-eye',cozy:'candy',modern:'moon',anime:'anime-spirit',international:'ink-eye',music:'haunted-record','true-crime':'case-file',gotham:'moon'})[id]}.svg" alt=""><div><h2 id="heading-${id}">${title}</h2><p>${id==='music'?selected.length+(isHarborEmbedded?' songs. Play in Harbor.':' songs. Listen to previews.'):id==='manga'?selected.length+' titles to discover.':id==='true-crime'?selected.length+' documentaries and docuseries.':id==='anime'?selected.length+' anime series &amp; films.':description}</p></div></div>${sectionAction(id)}</div></div>
   ${id==='new'?'<div class="new-release-layout">':''}${railMarkup(selected.map(i=>card(i,true)).join(''),title,'media-row',id==='new'?'garden-rail':'')}
   ${scenery}${id==='new'?'</div>':''}
 </section>`;
}
let observer;
function render() {
 observer?.disconnect();
 $('#collections').innerHTML = formatDoorways()+shelf(sectionDefinitions[0])+shudderShelf(screening,railMarkup)+shelf(sectionDefinitions[1])+mastersMarkup(railMarkup)+'<div id="editorial-mount"></div>'+shelf(sectionDefinitions[6])+shelf(sectionDefinitions[10])+'<div id="spotlight-mount"></div>'+shelf(sectionDefinitions[7])+'<div id="horror-paths-mount"></div><div id="encounter-mount"></div>'+shelf(sectionDefinitions[5])+'<div id="twilight-mount"></div>'+shelf(sectionDefinitions[2])+shelf(sectionDefinitions[9])+`<div class="reading-pair">${shelf(sectionDefinitions[3])}${shelf(sectionDefinitions[4])}</div>`+musicWorld(screening,railMarkup)+playlistMarkup(items,railMarkup)+shelf(sectionDefinitions[8])+(isHalloweenNight()?shelf(HALLOWEEN_NIGHT_SECTION):'');
 initWatchers();

 initRails();
 initShudderArt();
 initMasters();
 observer=new IntersectionObserver(entries=>entries.forEach(e=>e.target.classList.toggle('offscreen',!e.isIntersecting)),{rootMargin:'100px'});
 $$('.scene').forEach(el=>observer.observe(el));
}
function setMotion(){document.body.classList.toggle('motion-off',!motion||document.hidden||hostPaused);}
setMotion();
document.addEventListener('visibilitychange',()=>{setMotion();syncWatchers()});
reduced.addEventListener('change',()=>{motion=!reduced.matches;setMotion()});
document.addEventListener('click',e=>{
 const saveFeature=e.target.closest('[data-feature-save]');if(saveFeature){const id=saveFeature.dataset.featureSave;saved.has(id)?saved.delete(id):saved.add(id);persist();syncFeatureSaves();return}
 const collection=e.target.closest('[data-collection]');if(collection){openCollection(collection.dataset.collection,collection);return}
 const filter=e.target.closest('[data-collection-filter]');if(filter){filterCollection(filter.dataset.collectionFilter);return}
 const playlist=e.target.closest('[data-playlist]');if(playlist){openPlaylist(playlist.dataset.playlist,playlist);return}
 const video=e.target.closest('[data-video]');if(video){const v=screening.videos.find(x=>x.id===video.dataset.video);if(v)showFullPage(videoDialog(v),video,'video/'+v.id,v.title);return}
 const load=e.target.closest('[data-load-video]');if(load){const v=screening.videos.find(x=>x.id===load.dataset.loadVideo);if(v)playOfficialVideo(v,load);return}
 const browse=e.target.closest('[data-browse]');if(browse){browseFormat(browse.dataset.browse);return}
 const item=e.target.closest('[data-item]');if(item){openItem(item.dataset.item,item);return}
 const direction=e.target.closest('[data-direction]');if(direction){scrollRail($('.rail-track',direction.closest('.harbor-rail')),Number(direction.dataset.direction));return}
 const director=e.target.closest('[data-director]');if(director)openDirector(director.dataset.director,director);
});
document.addEventListener('keydown',e=>{
 const cardEl=e.target.closest('.media-card');
 if(cardEl&&['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){
  const cards=$$('.media-card',cardEl.parentElement);let index=cards.indexOf(cardEl);index=e.key==='Home'?0:e.key==='End'?cards.length-1:index+(e.key==='ArrowRight'?1:-1);
  if(cards[index]){e.preventDefault();cards[index].focus({preventScroll:true});cards[index].scrollIntoView({behavior:motion?'smooth':'instant',block:'nearest',inline:'nearest'})}
 }
});
function showDialog(html,trigger){
 const dialog=$('#detail');if(dialog.open&&trigger&&!dialog.contains(trigger)&&trigger!==lastTrigger)dialog.close();$('#song-audio')?.pause();stopOfficialVideo();
 if(!dialog.open){lastTrigger=trigger||document.activeElement;dialogFromCatalog=!!lastTrigger?.closest('.gallery-section');directorContext=null;playlistContext=null;collectionContext=null}
 $('#dialog-back').hidden=true;$('#dialog-content').innerHTML=html;
 inlineSurface.open(trigger);$('.dialog-close').focus({preventScroll:true});dialog.scrollTop=0;
}
function bindSave(id,button){
 const paint=()=>{button.setAttribute('aria-pressed',String(saved.has(id)));button.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${saved.has(id)?'m5 12 4 4L19 6':'M6 4h12v17l-6-4-6 4Z'}"/></svg><span>${saved.has(id)?'Saved for later':'Save for later'}</span>`};
 paint();button.onclick=()=>{const exists=saved.has(id);exists?saved.delete(id):saved.add(id);persist();paint();toast(exists?'Removed from saved titles.':'Saved for later.')};
}
function openItem(id,trigger){
 const i=items.find(x=>x.id===id);if(!i)return;
 if(hostOpenItem(i))return;
 const parent=$('#detail').open?directorContext:null;
 const collectionParent=$('#detail').open?collectionContext:null;
 if(collectionParent)collectionParent.scroll=$('#detail').scrollTop;
 if(parent)parent.scroll=$('#detail').scrollTop;
 if(i.type==='Music'){openSong(i,trigger);return}
 const typeLabel=i.shelfLabel==='Documentary'?(i.type==='Series'?'Documentary series':'Documentary'):({Film:'Movie',Series:'Show',Book:'Book',Manga:'Manga'}[i.type]||i.type);
 showDialog(`<div class="detail-layout"><div class="detail-art"><img class="detail-poster" src="${i.poster}" alt="${escape(i.title)} cover"></div><div class="detail-copy"><p class="detail-meta">${escape(i.release||[typeLabel,i.seasonLabel,i.seasonYear||displayYear(i),i.seasonLabel?'':i.runtime,i.imdbRating?'IMDb '+i.imdbRating:''].filter(Boolean).join(' · '))}</p><h2 id="dialog-title">${escape(i.title)}</h2>${i.creator?`<p class="detail-creator">${escape(i.creator)}</p>`:''}${i.description?`<p class="description">${escape(i.description)}</p>`:''}<button id="save-item" class="primary-button save-title"></button>${i.serviceUrl?`<a class="source-link provider-detail" href="${escape(i.serviceUrl)}" target="_blank" rel="noopener">View on ${escape(i.service)} ↗</a>`:''}${['dracula','frankenstein'].includes(i.id)?`<a class="source-link" href="https://www.gutenberg.org/ebooks/${i.id==='dracula'?'345':'84'}" target="_blank" rel="noopener">Read at Project Gutenberg ↗</a>`:''}<a class="source-link" href="${escape(i.source)}" target="_blank" rel="noopener noreferrer">${i.type==='Book'||i.type==='Manga'?'About this edition':'More about this title'} <span aria-hidden="true">↗</span></a></div></div>`,trigger);
 bindSave(id,$('#save-item'));
 if(collectionParent){const back=$('#dialog-back');back.hidden=false;back.onclick=()=>{openCollection(collectionParent.id,collectionParent.trigger,collectionParent.filter);$('#detail').scrollTop=collectionParent.scroll;$('.collection-title-grid [data-item="'+id+'"]')?.focus({preventScroll:true})};}
 if(parent){
  const back=$('#dialog-back');back.hidden=false;
  back.onclick=()=>{openDirector(parent.name,parent.trigger);$('#detail').scrollTop=parent.scroll;const item=$('.list-item[data-item="'+id+'"]');item?.focus({preventScroll:true})};
 }
}
function openDirector(name,trigger){
 const person=DIRECTORS[name];if(!person)return;
 const choices=[...new Map(items.filter(i=>i.creator===name&&i.type==='Film').map(i=>[i.title+'-'+i.year,i])).values()];
 showDialog(`<div class="director-detail"><div class="director-intro"><img src="${person.photo}" alt="${escape(name)}"><div><p class="detail-meta">The masters of horror</p><h2 id="dialog-title">${escape(name)}</h2><p>${person.line}</p><span>${choices.length} films to explore</span></div></div><div class="list-items director-films">${choices.map(i=>`<button class="list-item" data-item="${i.id}"><img src="${i.poster}" alt="" loading="lazy"><span class="list-item-text"><strong>${escape(i.title)}</strong><small>${i.year}</small></span></button>`).join('')}</div></div>`,trigger);
 directorContext={name,trigger,scroll:0};
}
function openPlaylist(id,trigger){const p=musicCollections(items).find(p=>p.id===id);if(!p)return;if(hostOpenPlaylist(id))return;showFullPage(playlistPage(p,saved,mixArt),trigger,'playlist/'+id,p.title);initPlaylistPage($('#route-root'),p);const button=$('#save-playlist');button.onclick=()=>{p.songs.forEach(i=>saved.add(i.id));persist();button.textContent='All songs saved';button.disabled=true};}
function filterCollection(type){
 if(collectionContext)collectionContext.filter=type;
 $$('[data-collection-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.collectionFilter===type)));
 $$('[data-collection-type]').forEach(el=>el.hidden=type!=='all'&&el.dataset.collectionType!==type);
}
function openCollection(id,trigger,filter='all'){
 const c=editorialCollection(id,items);if(!c)return;
 if(!c.entries.length){toast('The collection is still loading. Try again in a moment.');return}
 showDialog(collectionDialog(c,card),trigger);directorContext=null;playlistContext=null;collectionContext={id,trigger,filter,scroll:0};filterCollection(filter);
}
function syncFeatureSaves(){$$('[data-feature-save]').forEach(b=>{const active=saved.has(b.dataset.featureSave);b.setAttribute('aria-pressed',String(active));$('span',b).textContent=active?'Saved':'Save'})}
function persist(){syncFeatureSaves();catalogView?.refreshSaved();try{localStorage.setItem('harbor-spookfest-list',JSON.stringify([...saved]))}catch{toast('Your list is available for this visit.')}}
$('.dialog-close').onclick=()=>$('#detail').close();
$('#detail').addEventListener('close',()=>{directorContext=null;playlistContext=null;collectionContext=null;$('#song-audio')?.pause();stopOfficialVideo();if(lastTrigger?.isConnected)lastTrigger.focus({preventScroll:true});else if(dialogFromCatalog&&$('#saved-only'))$('#saved-only').focus({preventScroll:true});else $('#about-button').focus({preventScroll:true})});

let toastTimer;function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2800)}
$('#about-button').onclick=e=>showDialog(`<div class="list-content"><p class="eyebrow">HARBOR SPOOKTOBER</p><h2 id="dialog-title" style="margin-top:16px">About Spooktober</h2><p>${isHarborEmbedded?'Explore Halloween films, shows, books, manga and music in Harbor. Films and shows open their Harbor details; songs and playlists use your music player.':'A standalone design preview using Harbor’s original vector artwork. The opening 2026 films follow Cinemeta’s horror popularity feed checked September 28, 2026. Seasonal, upcoming and service picks follow; this preview is a dated snapshot. Your list stays in this browser. '+items.filter(i=>i.type==='Music'&&i.preview).length+' song previews, curated playlists and '+screening.videos.length+' official YouTube videos are available; full films and the Harbor library are not connected.'}</p><p style="margin-top:18px">Recent release details checked September 28, 2026. Dates refer to the U.S. release where shown; availability varies by region. Cover art belongs to its respective owners.</p><div class="about-links"><a href="credits.html" target="_blank" rel="noopener">Artwork &amp; sources ↗</a><a href="assets/art/Harbor-Spookfest-Original.svg" target="_blank">Original illustration ↗</a></div></div>`,e.currentTarget);
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>$$('.rail-track').forEach(updateRail),100)},{passive:true});
async function init(){try{const response=await fetch('content.json?v=ec8991e26f');if(!response.ok)throw Error('content');items=await response.json();try{const songs=await fetch('music.json?v=4cf8c17c53');if(!songs.ok)throw Error('songs');items.push(...await songs.json())}catch{musicUnavailable=true}try{const r=await fetch('screening.json?v=5c41a4b956');if(!r.ok)throw Error('screening');screening=await r.json();for(const i of [...screening.features,...screening.shudder]){const found=items.find(x=>x.id===i.id);if(found)Object.assign(found,i,{section:found.section});else items.push(i)}$('#cinema-root').innerHTML=heroMarkup(screening,railMarkup)}catch{$('#cinema-root').innerHTML='<p class="cinema-error">Featured films couldn’t load. <button id="retry-feature">Try again</button></p>';$('#retry-feature').onclick=()=>location.reload()}try{const r=await fetch('playlist-data.json?v=7e7943d45e');if(r.ok)setMusicCollections(await r.json())}catch{}
try{const r=await fetch('alt-collections.json?v=c8ce825689');if(r.ok){const c=await r.json();setEditorialCollections(c);const known=new Set(items.map(i=>i.id));for(const i of c.flatMap(c=>c.items||[])){if(!known.has(i.id)){items.push(i);known.add(i.id)}}}}catch{}
for(const [file,assign] of [['twilight-data.json?v=3fc0f22c45',data=>twilightData=data],['spotlight-data.json?v=5ede2e3c17',data=>spotlightData=data]]){try{const r=await fetch(file);if(!r.ok)continue;const data=await r.json();assign(data);const records=Array.isArray(data)?data.flatMap(c=>c.items||[]):data.items||[];for(const i of records){const existing=items.find(x=>x.id===i.id);if(existing)Object.assign(existing,i,{section:existing.section});else items.push(i)}}catch{}}
await loadExpandedShelves();try{await loadFreshReleases(items,expandedShelves)}catch{}try{await loadHalloweenNight(items)}catch{}persist();render();initHeroDepth();initSceneLife();initCinema(screening);await initCatalog();initBackToTop();catalogView?.refreshSaved();restorePageRoute();notifyHarborReady()}catch{$('#collections').innerHTML='<div class="collection-error"><p>The collection couldn’t load.</p><button class="primary-button" id="retry">Try again</button></div>';$('#retry').onclick=init}}
init();

async function loadExpandedShelves(){
 const results=await Promise.allSettled(['halloween-song-shelf.json?v=d497a9c2d0','manga-expanded.json?v=ce72547fad','horror-paths.json?v=2cb40c0307','series-features.json?v=7b424912e4','new-releases-expanded.json?v=63a5ce1cac','international-expanded.json?v=289531393b','reading-cozy-expanded.json?v=977871a4ca','screen-shelves-expanded.json?v=99cceb7688','true-crime-expanded.json?v=6ccc45d52c','anime-expanded.json?v=465221f3ac'].map(async file=>{const r=await fetch(file);if(!r.ok)throw Error(file);return r.json()}));
 results.forEach((result,index)=>{
  if(result.status!=='fulfilled')return;const data=result.value;
  if(index===0)songShelf=data;else if(index===1)mangaShelf=data;else if(index===2)horrorPaths=data;else if(index===3)seriesHighlights=Array.isArray(data)?data:data.features||[];else Object.assign(expandedShelves,data.shelves||{});
  for(const item of [...(data.items||[]),...(index===3?seriesHighlights:[])]){const existing=items.find(i=>i.id===item.id);if(existing)Object.assign(existing,item,{section:existing.section});else items.push(item)}
 });
 if(seriesHighlights.length){
  const keys=new Set(seriesHighlights.map(i=>i.imdbId||i.id)),films=screening.features.filter(i=>!keys.has(i.imdbId||i.id));
  screening.features=[];
  for(let n=0;n<Math.max(seriesHighlights.length,films.length);n++){if(seriesHighlights[n])screening.features.push(seriesHighlights[n]);if(films[n])screening.features.push(films[n])}
  $('#cinema-root').innerHTML=heroMarkup(screening,railMarkup);
 }
}

async function initCatalog(){
 try{
  const r=await fetch('catalog.json?v=be6e2e58a4');if(!r.ok)throw Error('catalog');
  const enriched=new Map(items.map(i=>[i.id,i]));const catalogItems=(await r.json()).map(i=>({...i,...enriched.get(i.id)}));const catalogIds=new Set(catalogItems.map(i=>i.id));catalogItems.push(...items.filter(i=>!catalogIds.has(i.id)));
  const known=new Set(items.map(i=>i.id));items.push(...catalogItems.filter(i=>!known.has(i.id)));
  const editorial=$('#editorial-mount');editorial.innerHTML=editorialMarkup(items,card,railMarkup);initRails(editorial);
  const twilight=$('#twilight-mount');twilight.innerHTML=twilightMarkup(twilightData,card,railMarkup);initTwilight();initRails(twilight);
  const spotlights=$('#spotlight-mount');spotlights.innerHTML=spotlightsMarkup(spotlightData,items,card,railMarkup);initRails(spotlights);
  mountHorrorPaths($('#horror-paths-mount'),horrorPaths,items,card);
  mountEncounter($('#encounter-mount'),horrorPaths,items,card);
  catalogView=createCatalog($('#collections'),{items:catalogItems,card,isSaved:id=>saved.has(id)});
 }catch(error){
  console.error('Spooktober catalog failed to load:',error);
  $('#collections').insertAdjacentHTML('beforeend','<section class="gallery-section"><h2>Keep exploring</h2><p class="catalog-status">The extended collection couldn’t load.</p><button id="catalog-retry" class="load-more">Try again</button></section>');
  $('#catalog-retry').onclick=()=>{$('.gallery-section').remove();initCatalog()};
 }
}

reduced.addEventListener('change',syncWatchers);

function watcher(kind,position){return `<span class="watcher ${position}" data-watcher="${kind}" aria-hidden="true"><img class="eye-lids" src="assets/art/eyes-${kind}.svg" alt=""></span>`}
function sectionAction(id){
 const types={classics:['Film','Explore films'],series:['Series','Explore shows'],books:['Book','Explore books'],manga:['Manga','Explore manga'],music:['Music','Explore songs']};
 const choice=types[id];
 return `<div class="section-actions">${choice?`<button class="section-cta" data-browse="${choice[0]}"><span>${choice[1]}</span></button>`:''}`;
}
function formatDoorways(){
 const formats=[['classics','midnight-film','Movies'],['series','ghost-tv','Shows'],['books','haunted-book','Books'],['manga','ink-eye','Manga'],['music','haunted-record','Music']];
 return `<section class="discovery-formats" aria-label="Explore Spooktober by format">${formats.map(([id,icon,label])=>`<a class="format-link" href="${id==='music'?'#music-world':'#section-'+id}"><img src="assets/icons/${icon}.svg" alt=""><span>${label}</span></a>`).join('')}</section>`;
}
function browseFormat(type){
 if(!$('#catalog-type')){toast('The collection is still loading. Try again in a moment.');return}
 catalogView.browse(type);
 const heading=$('#catalog-title');heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});heading.scrollIntoView({behavior:motion?'smooth':'instant',block:'start'});
}
function openSong(i,trigger){
 if(hostOpenItem(i))return;
 const minutes=Math.floor(i.duration/60),seconds=String(i.duration%60).padStart(2,'0');
 showFullPage(`<div class="song-detail"><img class="song-cover" src="${i.poster}" alt="${escape(i.album)} cover"><div class="detail-copy"><p class="detail-meta">Song · ${minutes}:${seconds}</p><h2 id="dialog-title">${escape(i.title)}</h2><p class="song-artist">${escape(i.creator)}</p><p class="song-album">${escape(i.album)}</p>${i.preview?`<label class="song-preview-label" for="song-audio">Song preview</label><audio id="song-audio" controls preload="none" src="${escape(i.preview)}"></audio><div id="preview-failure" class="preview-failure" hidden><p role="status">This preview couldn’t play.</p><button id="retry-song" class="quiet-button">Try preview again</button></div>`:''}<button id="save-song" class="primary-button">${saved.has(i.id)?'✓ In tonight’s list':'+ Add to tonight’s list'}</button><a class="source-link" href="${escape(i.source)}" target="_blank" rel="noopener noreferrer">Listen on Apple Music ↗</a></div></div>`,trigger,'song/'+i.id,i.title);
 bindSave(i.id,$('#save-song'));$('#save-song').classList.add('save-title');
 const audio=$('#song-audio'),failure=$('#preview-failure');
 if(audio){
  audio.addEventListener('error',()=>failure.hidden=false);
  audio.addEventListener('playing',()=>failure.hidden=true);
  $('#retry-song').onclick=()=>{failure.hidden=true;audio.load();audio.play().catch(()=>failure.hidden=false)};
 }

}
/* Eye storyboard:
 * On entering view: open eyes appear quietly in the dark.
 * After 3.2–5.8s: close → open over 190ms, then wait 6.1–10.3s.
 * Offscreen / hidden / reduced motion: cancel the timer, hold eyes open.
 * Different offsets keep the three creatures from blinking together.
 */
const EYE_TIMING={first:3200,stagger:1300,blink:190,rest:6100,variation:4200};
let eyeStates=[],eyeObserver;
function initWatchers(){
 eyeObserver?.disconnect();eyeStates.forEach(s=>clearTimeout(s.timer));
 eyeStates=$$('[data-watcher]').map((el,index)=>({el,index,visible:false,timer:0}));
 eyeObserver=new IntersectionObserver(entries=>{for(const entry of entries){const s=eyeStates.find(s=>s.el===entry.target);if(!s)continue;s.visible=entry.isIntersecting;scheduleEye(s,true)}},{threshold:.5});
 eyeStates.forEach(s=>eyeObserver.observe(s.el));
}
function scheduleEye(s,first=false){
 clearTimeout(s.timer);s.el.classList.remove('blinking');
 if(!s.visible||!motion||reduced.matches||document.hidden||hostPaused)return;
 s.timer=setTimeout(()=>{
  s.el.classList.add('blinking');
  s.timer=setTimeout(()=>{s.el.classList.remove('blinking');scheduleEye(s)},EYE_TIMING.blink);
 },first?EYE_TIMING.first+s.index*EYE_TIMING.stagger:EYE_TIMING.rest+Math.random()*EYE_TIMING.variation);
}
function syncWatchers(){eyeStates.forEach(s=>scheduleEye(s,true))}

initHarborBridge({onVisibilityChange(paused){
 hostPaused=paused;setMotion();syncWatchers();
 if(paused){$$('audio,video').forEach(media=>{media.dispatchEvent(new Event('spook:pause'));media.pause()});stopOfficialVideo()}
}});


function restorePageRoute(){
 const match=location.hash.match(/^#(playlist|song|video)\/(.+)$/);if(!match)return;restoringRoute=true;
 if(match[1]==='song'){const song=items.find(i=>i.id===match[2]&&i.type==='Music');if(song)openSong(song,null)}
 else if(match[1]==='video'){const video=screening.videos.find(i=>i.id===match[2]);if(video)showFullPage(videoDialog(video),null,'video/'+video.id,video.title)}
 else openPlaylist(match[2],null);
 restoringRoute=false;
}
