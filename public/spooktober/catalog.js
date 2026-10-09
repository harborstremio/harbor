// A small local catalog. The main app will supply its own data and UI primitives
// when this standalone design is approved for integration.
const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const chevron='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';
const check='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
let opened=null;

function choiceControl(button,options,onChange){
 let value=options[0].value,active=0,buffer='',typingTimer;
 const panel=document.createElement('div');
 panel.className='catalog-menu';panel.id=button.id+'-options';panel.role='listbox';
 panel.setAttribute('aria-label',button.getAttribute('aria-label'));panel.tabIndex=-1;panel.hidden=true;
 button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',panel.id);
 document.body.append(panel);
 function render(){
  const selected=options.find(o=>o.value===value);
  button.innerHTML=`<span>${esc(selected.label)}</span>${chevron}`;
  panel.innerHTML=options.map((o,i)=>`<div id="${panel.id}-${i}" role="option" aria-selected="${o.value===value}" data-index="${i}" class="catalog-option"><span>${o.icon?`<img src="assets/icons/${o.icon}.svg" alt="">`:''}${esc(o.label)}</span>${o.count!==undefined?`<small>${o.count}</small>`:''}${check}</div>`).join('');
  highlight();
 }
 function highlight(){
  [...panel.children].forEach((el,i)=>el.classList.toggle('highlighted',active===i));
  panel.setAttribute('aria-activedescendant',panel.id+'-'+active);
  if(!panel.hidden)panel.children[active]?.scrollIntoView({block:'nearest'});
 }
 function place(){
  if(panel.hidden)return;
  const r=button.getBoundingClientRect();
  const width=Math.min(innerWidth-24,Math.max(230,r.width));panel.style.width=width+'px';
  panel.style.left=Math.max(12,Math.min(innerWidth-width-12,r.left))+'px';
  const below=innerHeight-r.bottom-16,above=r.top-16;
  const up=below<Math.min(panel.scrollHeight,300)&&above>below;
  panel.style.maxHeight=Math.max(90,Math.min(360,up?above:below))+'px';
  panel.classList.toggle('opens-up',up);
  panel.style.top=(up?Math.max(12,r.top-panel.offsetHeight-8):r.bottom+8)+'px';
 }
 function close(restore=false){
  panel.hidden=true;button.setAttribute('aria-expanded','false');
  if(opened?.panel===panel)opened=null;
  buffer='';clearTimeout(typingTimer);if(restore)button.focus({preventScroll:true});
 }
 function open(){
  opened?.close();active=options.findIndex(o=>o.value===value);panel.hidden=false;
  button.setAttribute('aria-expanded','true');opened={panel,button,close,place};place();highlight();panel.focus({preventScroll:true});
 }
 function select(){value=options[active].value;render();close(true);onChange(value)}
 button.onclick=()=>panel.hidden?open():close(true);
 button.onkeydown=e=>{if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();open();if(e.key==='Home')active=0;if(e.key==='End')active=options.length-1;highlight()}};
 panel.onpointermove=e=>{const el=e.target.closest('[data-index]');if(el){active=Number(el.dataset.index);highlight()}};
 panel.onclick=e=>{const el=e.target.closest('[data-index]');if(el){active=Number(el.dataset.index);select()}};
 panel.onkeydown=e=>{
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
   e.preventDefault();active=e.key==='Home'?0:e.key==='End'?options.length-1:(active+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;highlight();
  }else if(e.key==='Enter'||e.key===' '){e.preventDefault();select()}
  else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true)}
  else if(e.key==='Tab'){close(true)}
  else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
   e.preventDefault();clearTimeout(typingTimer);buffer+=e.key.toLowerCase();
   let index=options.findIndex(o=>o.label.toLowerCase().startsWith(buffer));
   if(index<0){buffer=e.key.toLowerCase();index=options.findIndex(o=>o.label.toLowerCase().startsWith(buffer))}
   if(index>=0){active=index;highlight()}typingTimer=setTimeout(()=>buffer='',600);
  }
 };
 render();return {set(next){if(options.some(o=>o.value===next)){value=next;render()}},close};
}
document.addEventListener('pointerdown',e=>{if(opened&&!opened.panel.contains(e.target)&&!opened.button.contains(e.target))opened.close()});
document.addEventListener('focusin',e=>{if(opened&&!opened.panel.contains(e.target)&&!opened.button.contains(e.target))opened.close()});
addEventListener('resize',()=>opened?.place());
addEventListener('scroll',()=>opened?.place(),{passive:true});

export function createCatalog(root,{items,card,isSaved}){
 let type='All',query='',sort='curated',onlySaved=false,offset=0,searchTimer;
 const formats=[['All','Everything','moon'],['Film','Movies','midnight-film'],['Series','Shows','ghost-tv'],['Book','Books','haunted-book'],['Manga','Manga','ink-eye'],['Music','Music','haunted-record']];
 root.insertAdjacentHTML('beforeend',`<section class="gallery-section" aria-labelledby="catalog-title">
  <div class="gallery-heading"><div><h2 id="catalog-title" tabindex="-1">Keep exploring</h2><p id="catalog-count"></p></div>
   <label class="catalog-search-box"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input id="catalog-search" type="search" placeholder="Search titles or creators" aria-label="Search the horror collection" autocomplete="off"><button type="button" id="clear-search" aria-label="Clear search" hidden>×</button></label></div>
  <div class="catalog-toolbar"><div class="catalog-filters"><button id="catalog-type" class="choice-trigger" aria-label="Media format"></button><button id="saved-only" class="saved-filter" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4Z"/></svg>Saved<span id="saved-total"></span></button></div><button id="catalog-sort" class="choice-trigger sort-trigger" aria-label="Sort collection"></button></div>
  <div id="catalog-grid" class="catalog-grid"></div><p id="catalog-status" class="catalog-status" aria-live="polite" aria-atomic="true"></p><button id="load-more" class="load-more">Load more</button>
 </section>`);
 const $=selector=>root.querySelector(selector),grid=$('#catalog-grid'),search=$('#catalog-search'),load=$('#load-more');
 const format=choiceControl($('#catalog-type'),formats.map(([value,label,icon])=>({value,label,icon,count:(value==='All'?items:items.filter(i=>i.type===value)).length})),value=>{type=value;draw(true)});
 const order=choiceControl($('#catalog-sort'),[{value:'curated',label:'Collection order'},{value:'newest',label:'Newest first'},{value:'oldest',label:'Oldest first'},{value:'title',label:'Title A–Z'}],value=>{sort=value;draw(true)});
 function matching(){
  const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const terms=normalize(query).split(/\s+/).filter(Boolean);
  const list=items.filter(i=>(type==='All'||i.type===type)&&(!onlySaved||isSaved(i.id))&&terms.every(term=>normalize(`${i.title} ${i.creator||''}`).includes(term)));
  if(sort==='newest'||sort==='oldest'){const direction=sort==='newest'?-1:1;list.sort((a,b)=>((parseInt(a.year)||0)-(parseInt(b.year)||0))*direction)}
  else if(sort==='title')list.sort((a,b)=>a.title.localeCompare(b.title));
  return list;
 }
 function draw(reset=false){
  const list=matching();if(reset){document.dispatchEvent(new Event('catalog:reset'));offset=0;grid.innerHTML=''}
  const batch=list.slice(offset,offset+24);offset+=batch.length;grid.insertAdjacentHTML('beforeend',batch.map(i=>card(i)).join(''));
  if(!list.length){
   grid.innerHTML=`<div class="catalog-empty"><img src="assets/icons/${onlySaved&&!query?'haunted-book':'ink-eye'}.svg" alt=""><h3>${onlySaved&&!query?'Your collection starts here':'No titles found'}</h3><p>${onlySaved&&!query?'Open a title and save it for later.':'Try a different title, creator, or format.'}</p><button id="reset-catalog" class="quiet-button">${onlySaved?'Browse all titles':'Clear filters'}</button></div>`;
   $('#reset-catalog').onclick=()=>{resetAll();search.focus({preventScroll:true})};
  }
  $('#catalog-count').textContent=`${list.length.toLocaleString()} ${list.length===1?'title':'titles'}${onlySaved?' saved':' to explore'}`;
  $('#catalog-status').textContent=list.length?`${offset.toLocaleString()} of ${list.length.toLocaleString()}`:'No matching titles';
  $('#saved-total').textContent=items.filter(i=>isSaved(i.id)).length;
  $('#saved-only').setAttribute('aria-pressed',String(onlySaved));$('#clear-search').hidden=!search.value;
  load.hidden=offset>=list.length;
 }
 function resetAll(){clearTimeout(searchTimer);type='All';query='';onlySaved=false;format.set('All');search.value='';draw(true)}
 search.oninput=()=>{clearTimeout(searchTimer);$('#clear-search').hidden=!search.value;searchTimer=setTimeout(()=>{query=search.value.trim();draw(true)},180)};
 search.onkeydown=e=>{if(e.key==='Escape'&&search.value){e.preventDefault();clearSearch()}};
 function clearSearch(){clearTimeout(searchTimer);query='';search.value='';draw(true);search.focus({preventScroll:true})}
 $('#clear-search').onclick=clearSearch;
 $('#saved-only').onclick=()=>{onlySaved=!onlySaved;draw(true)};load.onclick=()=>draw();
 const observer=new IntersectionObserver(entries=>{if(entries[0].isIntersecting&&!load.hidden)draw()},{rootMargin:'250px'});observer.observe(load);
 draw();
 return {
  browse(next){clearTimeout(searchTimer);type=next;query='';onlySaved=false;format.set(next);search.value='';draw(true);format.close();order.close()},
  refreshSaved(){ $('#saved-total').textContent=items.filter(i=>isSaved(i.id)).length;if(onlySaved)draw(true) }
 };
}
