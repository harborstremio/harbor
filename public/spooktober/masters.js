import {revealRailCard} from './rails.js?v=a56521c2bb';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const filmmakers=[
 {name:'Alfred Hitchcock',image:'hitchcock',sub:'Suspense',film:'Psycho · 1960',line:'Explore his suspense classics.',photo:'https://image.tmdb.org/t/p/w500/108fiNM6poRieMg7RIqLJRxdAwG.jpg',background:'https://images.metahub.space/background/medium/tt0054215/img'},
 {name:'John Carpenter',image:'carpenter',sub:'Cult classics',film:'The Thing · 1982',line:'Independent horror and cult classics.',photo:'https://image.tmdb.org/t/p/w500/3Qp0mg61u1qSZNJh30BFEUZrIMG.jpg',background:'https://images.metahub.space/background/medium/tt0084787/img'},
 {name:'Wes Craven',image:'craven',sub:'Slasher nightmares',film:'Scream · 1996',line:'The director behind Scream and Freddy Krueger.',photo:'https://image.tmdb.org/t/p/w500/eqwl6owrYykeTGTpKxwcAkbEJmg.jpg',background:'https://images.metahub.space/background/medium/tt0117571/img'},
 {name:'Ari Aster',image:'aster',sub:'Uneasy families',film:'Midsommar · 2019',line:'Horror built around family trauma.',photo:'https://image.tmdb.org/t/p/w500/45lOHyHwdMgyKm6u3jwLtyfwOjc.jpg',background:'https://images.metahub.space/background/medium/tt8772262/img'},
 {name:'Robert Eggers',image:'eggers',sub:'Dark folklore',film:'The Witch · 2015',line:'Period horror drawn from folklore.',photo:'https://image.tmdb.org/t/p/w500/8Mbq0G8FguELKC8zNFunapPpkt5.jpg',background:'https://images.metahub.space/background/medium/tt4263482/img'},
 {name:'Jordan Peele',image:'peele',sub:'Modern nightmares',film:'Get Out · 2017',line:'Social horror with a sharp point of view.',photo:'https://image.tmdb.org/t/p/w500/kFUKn5g3ebpyZ3CSZZZo2HFWRNQ.jpg',background:'https://images.metahub.space/background/medium/tt5052448/img'},
 {name:'James Wan',image:'wan',sub:'Haunted houses',film:'The Conjuring · 2013',line:'The director behind The Conjuring.',photo:'https://image.tmdb.org/t/p/w500/bNJccMIKzCtYnndcOKniSKCzo5Y.jpg',background:'https://images.metahub.space/background/medium/tt1457767/img'},
 {name:'Guillermo del Toro',image:'del-toro',sub:'Monsters & fairy tales',film:'Pan’s Labyrinth · 2006',line:'Gothic stories with a human heart.',photo:'https://image.tmdb.org/t/p/w500/cWvt8FdPAH0j3QtLzAN1j7ZJJrr.jpg',background:'https://images.metahub.space/background/medium/tt0457430/img'},
 {name:'Tim Burton',image:'burton',portrait:'burton-photo',sub:'Gothic mischief',film:'Sleepy Hollow · 1999',line:'A stranger side of Halloween.',photo:'https://image.tmdb.org/t/p/w500/yHEHAHQpN9PfSEQx1UxZPczhcAi.jpg',background:'https://images.metahub.space/background/medium/tt0162661/img'},
 {name:'Dario Argento',image:'argento',sub:'Italian horror',film:'Suspiria · 1977',line:'A defining voice in Italian horror.',photo:'https://image.tmdb.org/t/p/w500/2WjQlcLxhvmO9NtCfNh2npMVYqp.jpg',background:'https://images.metahub.space/background/medium/tt0076786/img'},
 {name:'George A. Romero',image:'romero',sub:'The living dead',film:'Night of the Living Dead · 1968',line:'The filmmaker who reinvented the zombie.',photo:'https://image.tmdb.org/t/p/w500/w2zVF92x149qK79ZxwUowcSp2c6.jpg',background:'https://images.metahub.space/background/medium/tt0063350/img'},
].map(d=>({...d,portrait:d.portrait||d.image}));
export const DIRECTORS=Object.fromEntries(filmmakers.map(d=>[d.name,d]));

export function mastersMarkup(rail){
 return `<section id="masters-world" class="masters-world scene" aria-label="The masters of horror" aria-roledescription="carousel">
 <div class="feature masters-feature"><div class="feature-bg masters-backdrops" aria-hidden="true">${filmmakers.map((d,n)=>`<img data-master-backdrop="${n}" ${n?'data-src':'src'}="${d.background}" class="${n?'':'is-current'}" alt="" loading="lazy">`).join('')}</div>
 <div class="masters-content"><p class="feature-label">The masters of horror</p><div id="master-feature" class="master-panels">${filmmakers.map((d,n)=>`<article data-master-panel="${n}" class="master-panel ${n?'':'is-current'}" aria-hidden="${!!n}" ${n?'inert':''}><h2>${esc(d.name)}</h2><p>${esc(d.line)}</p><button class="text-button" data-director="${esc(d.name)}" aria-label="Explore films by ${esc(d.name)}">Explore films</button></article>`).join('')}</div></div>
 <span class="master-film-caption" aria-hidden="true">${filmmakers[0].film}</span></div>
 <div class="directors"><div class="director-controls"><span>11 filmmakers</span><button class="master-rotation rotation-toggle" role="switch" aria-label="Automatically change featured filmmaker" aria-checked="true"><span>Auto-advance</span><i aria-hidden="true"></i></button></div>
 ${rail(filmmakers.map((d,n)=>`<button class="director-button" data-director-select="${n}" aria-label="Feature ${esc(d.name)}" aria-controls="master-feature" aria-pressed="${n===0}"><span class="director-photo"><img class="director-portrait" src="${d.photo}" alt="" loading="lazy" width="400" height="440"></span><span class="director-name">${esc(d.name)}</span><span class="director-sub">${esc(d.sub)}</span></button>`).join(''),'Horror directors','director-row')}
 </div><p class="sr-only master-status" aria-live="polite"></p></section>`;
}

export function initMasters(){
 const root=document.querySelector('#masters-world');if(!root)return;
 const buttons=[...root.querySelectorAll('[data-director-select]')],panels=[...root.querySelectorAll('[data-master-panel]')],images=[...root.querySelectorAll('[data-master-backdrop]')],track=root.querySelector('.director-row'),toggle=root.querySelector('.master-rotation'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
 // Storyboard: old film holds until the next image decodes; backdrop dissolves
 // for 700ms, copy enters after 130ms. Portrait selection never shifts the rail.
 const TIMING={rotation:11000};
 let index=0,timer=0,revision=0,visible=false,hovered=false,paused=reduced.matches;
 function preload(n){const img=images[n];if(img.dataset.src){img.src=img.dataset.src;delete img.dataset.src}return img.decode().catch(()=>{});}
 function schedule(){
  clearTimeout(timer);
  const eligible=!paused&&!hovered&&visible&&!document.hidden&&!reduced.matches&&!document.querySelector('#detail[open]')&&!root.contains(document.activeElement);
  if(eligible)timer=setTimeout(()=>select((index+1)%buttons.length),TIMING.rotation);
 }
 function paint(){toggle.setAttribute('aria-checked',String(!paused));schedule();}
 async function select(next,manual=false){
  const request=++revision;clearTimeout(timer);if(manual){paused=true;paint()}
  await preload(next);if(request!==revision)return;index=next;
  panels.forEach((el,n)=>{el.classList.toggle('is-current',n===next);el.inert=n!==next;el.setAttribute('aria-hidden',String(n!==next))});
  images.forEach((el,n)=>el.classList.toggle('is-current',n===next));
  buttons.forEach((el,n)=>el.setAttribute('aria-pressed',String(n===next)));
  root.querySelector('.master-film-caption').textContent=filmmakers[next].film;
  revealRailCard(buttons[next]);
  if(manual)root.querySelector('.master-status').textContent='Featuring '+filmmakers[next].name;
  preload((next+1)%images.length);schedule();
 }
 buttons.forEach((b,n)=>b.addEventListener('click',()=>select(n,true)));
 toggle.addEventListener('click',()=>{paused=!paused;paint()});
 root.addEventListener('pointerenter',()=>{hovered=true;schedule()});root.addEventListener('pointerleave',()=>{hovered=false;schedule()});
 root.addEventListener('focusin',schedule);root.addEventListener('focusout',()=>queueMicrotask(schedule));
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)preload((index+1)%images.length);schedule()},{threshold:.2}).observe(root);
 document.addEventListener('visibilitychange',schedule);
 new MutationObserver(schedule).observe(document.querySelector('#detail'),{attributes:true,attributeFilter:['open']});
 reduced.addEventListener('change',()=>{if(reduced.matches)paused=true;paint()});paint();
}
