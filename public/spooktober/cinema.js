import {revealRailCard} from './rails.js?v=a56521c2bb';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rating=value=>`<span class="imdb-rating"><img src="assets/services/imdb.svg" alt="IMDb" width="28" height="14"><span>${esc(value)}</span></span>`;
const play='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/></svg>';
const meta=i=>[i.seasonLabel,i.seasonYear||i.year,i.seasonLabel?'':i.runtime?i.runtime+(i.type==='Series'?' / ep.':''):'',i.genres?.slice(0,2).join(' / ')].filter(Boolean).join(' · ');
export function heroMarkup(data,rail){
 const selectors=data.features.map((i,n)=>`<button data-slide="${n}" class="feature-selector" aria-label="Show ${esc(i.title)}${i.seasonLabel?', '+esc(i.seasonLabel):''}" aria-pressed="${n===0}"><img src="${i.seasonLabel?i.poster:i.background}" alt="" loading="lazy"><span class="queue-copy"><strong>${esc(i.title)}</strong><small class="queue-facts"><span>${esc(i.seasonLabel||i.service)} · ${esc(i.seasonLabel?i.service:i.year)}</span><span aria-hidden="true">${esc(i.seasonLabel?i.featureTag||i.type:i.runtime||i.type)}${i.imdbRating?` · ${rating(i.imdbRating)}`:''}</span></small></span><i aria-hidden="true"></i></button>`).join('');
 return `<div class="cinema-images" aria-hidden="true">${data.features.map((i,n)=>`<div class="cinema-image ${n===0?'is-current':''}" data-backdrop="${n}"><img src="${i.background}" alt="" ${n?'loading="lazy"':'fetchpriority="high"'}></div>`).join('')}</div><div class="film-hero" role="region" aria-roledescription="carousel" aria-label="Spooktober featured titles">
 <div class="feature-slides">${data.features.map((i,n)=>`<article class="feature-slide ${n===0?'is-current':''}" data-feature="${n}" aria-hidden="${n!==0}" ${n?'inert':''}>
 <div class="cinema-copy"><p class="service-line">${i.serviceLogo?`<img class="brand-${i.service.toLowerCase().replace(/[^a-z]/g,'')}" src="${i.serviceLogo}" alt="${esc(i.service)}">`:`<span class="service-wordmark service-${i.service.toLowerCase().replace(/[^a-z]/g,'')}">${esc(i.service)}</span>`}${i.featureTag?`<span>${esc(i.featureTag)}</span>`:''}</p>
 <h2 class="film-title"><span class="sr-only">${esc(i.title)}</span>${i.logo?`<img src="${i.logo}" alt="" onerror="this.hidden=true;this.previousElementSibling.className=''" />`:esc(i.title)}</h2>
 <div class="feature-metadata"><span>${esc(meta(i))}</span>${i.imdbRating?`<span class="hero-imdb">${rating(i.imdbRating)}</span>`:''}</div><p class="feature-synopsis">${esc(i.description)}</p>
 <div class="film-actions"><button class="primary-button feature-explore" data-item="${i.id}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg>Explore ${i.type==='Series'?'show':'film'}</button><button class="feature-save" data-feature-save="${i.id}" aria-label="Save ${esc(i.title)} for later" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4Z"/></svg><span>Save</span></button><a class="provider-link" href="${esc(i.serviceUrl)}" target="_blank" rel="noopener">${esc(i.serviceAction||'View on '+i.service)}</a></div></div></article>`).join('')}</div>
 <div class="feature-controller"><div class="queue-top"><span>Featured now</span><span class="queue-position">1 / ${data.features.length}</span><button class="rotation-toggle" role="switch" aria-label="Automatically change featured title" aria-checked="true"><span>Auto-advance</span><i aria-hidden="true"></i></button></div><div class="feature-queue">${rail(selectors,'Featured titles','feature-selectors')}</div></div>
 <p class="sr-only" id="feature-status" aria-live="polite"></p></div>`;
}
export function shudderShelf(data,rail){
 return `<section class="shudder-shelf shelf scene" id="section-shudder" aria-labelledby="shudder-title"><div class="shudder-intro"><div><p class="service-heading">Spotlight on <img src="${data.shudderLogo}" alt="Shudder"></p><h2 id="shudder-title">Shudder picks</h2></div><a class="section-cta" href="https://www.shudder.com/" target="_blank" rel="noopener">Explore Shudder</a></div>
 ${rail(data.shudder.map(i=>`<button class="media-card landscape-card" data-item="${i.id}" aria-label="View ${esc(i.title)}"><span class="poster-wrap"><img class="landscape-image" src="${i.background}" alt="" loading="lazy"><span class="landscape-shade"></span>${i.backdropHasTitle?'':`<img class="landscape-logo" src="${i.logo}" alt="" loading="lazy">`}<span class="art-label">${esc(i.genres?.[1]||'Horror')}</span></span><span class="media-title">${esc(i.title)}</span><span class="media-meta">${esc(i.year)} · ${esc(i.runtime||'Movie')}${i.imdbRating?`<span class="rating-meta">${rating(i.imdbRating)}</span>`:''}</span></button>`).join(''),'Shudder picks','media-row landscape-row')}
 <p class="availability-note">U.S. collection checked September 28. Availability varies by region.</p></section>`;
}
export function musicWorld(data,rail){
 if(!data.videos.length)return '';
 const [lead,...rest]=data.videos;
 const card=v=>`<button class="media-card video-card" data-video="${v.id}" aria-label="Watch ${esc(v.title)}, ${esc(v.artist)}"><span class="poster-wrap"><img src="${v.image}" alt="" loading="lazy"><span class="video-card-play">${play}</span></span><span class="media-title">${esc(v.title)}</span><span class="media-meta">${esc(v.artist)}</span></button>`;
 return `<section id="music-world" class="music-world scene" tabindex="-1" aria-labelledby="music-feature-title"><div class="section-top"><div><p class="feature-label">Music &amp; videos</p><h2 id="music-feature-title">Halloween music videos</h2><p>${data.videos.length} official videos.</p></div></div>
 <div class="video-program"><div class="video-frame"><button class="video-feature" data-video="${lead.id}" aria-label="Watch ${esc(lead.title)}, ${esc(lead.artist)}"><img src="${lead.image}" alt="${esc(lead.artist)} in ${esc(lead.title)}" loading="lazy"><span class="video-scrim"></span><span class="video-type">Official music video</span><span class="video-caption"><span class="video-play">${play}</span><span><strong>${esc(lead.title)}</strong><small>${esc(lead.artist)}</small></span></span></button><div class="video-pumpkins" aria-hidden="true"><img src="assets/art/pumpkin-mischief.svg" alt=""><img src="assets/art/pumpkin-grin.svg" alt=""></div></div>
 <div class="video-side">${rest.slice(0,2).map(v=>`<button class="video-tile" data-video="${v.id}" aria-label="Watch ${esc(v.title)}, ${esc(v.artist)}"><span class="video-picture"><img src="${v.image}" alt="" loading="lazy"><span>${play}</span></span><span class="video-tile-copy"><strong>${esc(v.title)}</strong><span>${esc(v.artist)}</span></span></button>`).join('')}</div></div>
 <div class="video-library"><h3>Keep watching</h3>${rail(rest.slice(2).map(card).join(''),'Halloween music videos','media-row video-row')}</div></section>`;
}
export function videoDialog(video){
 return `<div class="video-detail"><p class="detail-meta">Official artist video · ${esc(video.channel)}</p><h2 id="dialog-title">${esc(video.title)}</h2><p>${esc(video.artist)}</p><div class="video-player"><button class="load-video" data-load-video="${video.id}"><img src="${video.image}" alt=""><span>${play}<strong>Play official video</strong><small>Loads the YouTube player</small></span></button></div><a class="source-link" href="${video.url}" target="_blank" rel="noopener noreferrer">Open on YouTube ↗</a></div>`;
}
export function initCinema(data){
 const hero=document.querySelector('.film-hero');if(!hero)return;
 const stage=document.querySelector('.graveyard-stage'),original=stage?.querySelector('.original-scene');
 if(stage&&original&&!document.querySelector('.cinema-tree-stage')){
  const trees=stage.cloneNode(false),scene=original.cloneNode(false);
  trees.className='graveyard-stage cinema-tree-stage';
  scene.removeAttribute('id');
  const near=original.querySelector('.near-depth'),layer=near?.cloneNode(false);
  if(layer){
   layer.removeAttribute('data-depth');
   for(const tree of near.querySelectorAll('.art-foreground-tree')){
    const copy=tree.cloneNode(true);copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));layer.append(copy);
   }
   scene.append(layer);trees.append(scene);stage.after(trees);
  }
 }
 const slides=[...hero.querySelectorAll('[data-feature]')],buttons=[...hero.querySelectorAll('[data-slide]')],toggle=hero.querySelector('.rotation-toggle'),track=hero.querySelector('.feature-selectors');
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const ROTATION_DELAY=10000;
 let index=0,paused=reduced.matches,visible=true,hovered=false,timer=0;
 function schedule(){
  clearTimeout(timer);
  const running=!paused&&!hovered&&visible&&!document.hidden&&!reduced.matches&&!document.querySelector('#detail[open]');
  hero.classList.toggle('rotation-running',running);
  if(running)timer=setTimeout(()=>select((index+1)%slides.length),ROTATION_DELAY);
 }
 function select(next,manual=false){
  index=next;
  slides.forEach((el,n)=>{el.classList.toggle('is-current',n===next);el.inert=n!==next;el.setAttribute('aria-hidden',String(n!==next))});
  buttons.forEach((b,n)=>b.setAttribute('aria-pressed',String(n===next)));
  document.querySelectorAll('[data-backdrop]').forEach((el,n)=>el.classList.toggle('is-current',n===next));
  hero.querySelector('.queue-position').textContent=(next+1)+' / '+slides.length;
  revealRailCard(buttons[next]);
  if(manual)hero.querySelector('#feature-status').textContent=data.features[next].title;
  schedule();
 }
 function paint(){toggle.setAttribute('aria-checked',String(!paused));schedule()}
 buttons.forEach((b,n)=>b.addEventListener('click',()=>{paused=true;select(n,true);paint()}));
 toggle.addEventListener('click',()=>{paused=!paused;paint()});
 hero.addEventListener('pointerenter',()=>{hovered=true;schedule()});hero.addEventListener('pointerleave',()=>{hovered=false;schedule()});
 hero.addEventListener('focusin',event=>{if(event.target!==toggle){paused=true;paint()}});
 document.addEventListener('visibilitychange',schedule);document.querySelector('#detail')?.addEventListener('close',schedule);
 new MutationObserver(schedule).observe(document.querySelector('#detail'),{attributes:true,attributeFilter:['open']});
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule()},{threshold:.25}).observe(hero);
 reduced.addEventListener('change',()=>{if(reduced.matches)paused=true;paint()});paint();
}
