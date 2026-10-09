const JUMP_SECTIONS=[
 ['Movies','#section-classics','midnight-film'],
 ['Shows','#section-series','ghost-tv'],
 ['Books','#section-books','haunted-book'],
 ['Manga','#section-manga','ink-eye'],
 ['Music','#music-world','haunted-record'],
 ['New & coming soon','#section-new','candle'],
 ['Shudder picks','#section-shudder','midnight-film'],
 ['Masters of horror','#masters-world','moon'],
 ['Anime','#section-anime','anime-spirit'],
 ['Playlists','.playlist-world','haunted-record','playlist-heading'],
 ['True crime','#section-true-crime','case-file'],
 ['Go deeper','.horror-paths','path-folk-horror','horror-paths-heading'],
 ['Aliens & abductions','#encounter-world','moon'],
 ['Filters & search','.gallery-section',null,'catalog-title']
];
const FILTER_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16M8 4v6m8 4v6"/></svg>';

export function initBackToTop(){
 if(document.querySelector('.scroll-return'))return;
 const dock=document.createElement('div');dock.className='scroll-return';dock.inert=true;dock.setAttribute('aria-hidden','true');
 dock.innerHTML=`<button type="button" class="back-to-filters" aria-label="Back to filters and search" hidden>${FILTER_ICON}<span>Filters &amp; search</span></button><button type="button" class="jump-trigger" aria-label="Jump to section" aria-haspopup="menu" aria-controls="scroll-jump-menu" aria-expanded="false" title="Jump to section"><span>Jump to</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 14 5-5 5 5"/></svg></button><button type="button" class="back-to-top" aria-label="Back to top" title="Back to top"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 14 6-6 6 6"/></svg></button><div class="scroll-jump-menu" id="scroll-jump-menu" role="menu" aria-label="Jump to section" hidden></div>`;
 document.body.append(dock);
 const top=dock.querySelector('.back-to-top'),filters=dock.querySelector('.back-to-filters'),trigger=dock.querySelector('.jump-trigger'),menu=dock.querySelector('.scroll-jump-menu'),reduced=matchMedia('(prefers-reduced-motion:reduce)');let frame=0;
 const behavior=()=>reduced.matches||document.body.classList.contains('motion-off')?'instant':'smooth';
 const menuItems=()=>[...menu.querySelectorAll('[role="menuitem"]')];
 function closeMenu(restoreFocus=false){
  if(menu.hidden)return;
  menu.hidden=true;trigger.setAttribute('aria-expanded','false');
  if(restoreFocus)trigger.focus({preventScroll:true});
 }
 function openMenu(last=false){
  menu.innerHTML=JUMP_SECTIONS.map(([label,selector,icon],index)=>document.querySelector(selector)?`${index===5?'<div class="jump-divider" role="separator"></div>':''}<button type="button" role="menuitem" tabindex="-1" data-jump="${index}">${icon?`<img src="assets/icons/${icon}.svg" alt="" width="24" height="24">`:FILTER_ICON}<span>${label.replaceAll('&','&amp;')}</span></button>`:'').join('');
  menu.hidden=false;trigger.setAttribute('aria-expanded','true');
  const choices=menuItems();(last?choices.at(-1):choices[0])?.focus({preventScroll:true});menu.scrollTop=last?menu.scrollHeight:0;
 }
 function jumpTo(index){
  const [,selector,,anchor]=JUMP_SECTIONS[index],section=document.querySelector(selector);if(!section)return;
  closeMenu();const heading=[...section.querySelectorAll('h2,h1')].find(el=>!el.closest('[inert],[hidden],[aria-hidden="true"]'))||section;heading.tabIndex=-1;heading.focus({preventScroll:true});
  history.replaceState(history.state,'',location.pathname+location.search+'#'+(anchor||section.id));
  section.scrollIntoView({behavior:behavior(),block:'start'});
 }
 function update(){
  frame=0;const toolbar=document.querySelector('.catalog-toolbar'),show=scrollY>Math.min(720,innerHeight*.85)&&!document.body.classList.contains('viewing-page')&&!document.querySelector('#detail[open]');
  const deepCatalog=!!toolbar&&toolbar.getBoundingClientRect().bottom<0;
  if(!show)closeMenu();
  if(!deepCatalog&&document.activeElement===filters)trigger.focus({preventScroll:true});
  dock.classList.toggle('is-visible',show);dock.classList.toggle('has-filters',deepCatalog);dock.inert=!show;dock.setAttribute('aria-hidden',String(!show));filters.hidden=!deepCatalog;
 }
 function queue(){if(!frame)frame=requestAnimationFrame(update)}
 document.addEventListener('spook:navigate',()=>{closeMenu();queue()});addEventListener('scroll',queue,{passive:true});addEventListener('resize',queue,{passive:true});
 const collections=document.querySelector('#collections'),detail=document.querySelector('#detail');
 if(collections)new ResizeObserver(queue).observe(collections);
 if(detail)new MutationObserver(queue).observe(detail,{attributes:true,attributeFilter:['open']});
 new MutationObserver(queue).observe(document.body,{attributes:true,attributeFilter:['class']});
 top.addEventListener('click',()=>{closeMenu();const title=document.querySelector('.festival-title h1');if(title){title.tabIndex=-1;title.focus({preventScroll:true})}history.replaceState(history.state,'',location.pathname+location.search);scrollTo({top:0,behavior:behavior()})});
 filters.addEventListener('click',()=>jumpTo(JUMP_SECTIONS.length-1));
 trigger.addEventListener('click',()=>menu.hidden?openMenu():closeMenu(true));
 menu.addEventListener('click',event=>{const item=event.target.closest('[data-jump]');if(item)jumpTo(Number(item.dataset.jump))});
 dock.addEventListener('keydown',event=>{
  if(event.target===trigger&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();openMenu(event.key==='ArrowUp'||event.key==='End');return}
  if(menu.hidden)return;
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeMenu(true);return}
  if(event.key==='Tab'){closeMenu(true);return}
  if(!menu.contains(event.target))return;
  const choices=menuItems(),index=choices.indexOf(document.activeElement);let next;
  if(event.key==='ArrowDown')next=(index+1)%choices.length;
  if(event.key==='ArrowUp')next=(index-1+choices.length)%choices.length;
  if(event.key==='Home')next=0;
  if(event.key==='End')next=choices.length-1;
  if(next!==undefined){event.preventDefault();choices[next].focus()}
 });
 document.addEventListener('pointerdown',event=>{if(!dock.contains(event.target))closeMenu()});
 dock.addEventListener('focusout',event=>{if(!dock.contains(event.relatedTarget))closeMenu()});
 update();
}
