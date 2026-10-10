import {railMarkup,initRails} from './rails.js?v=a56521c2bb';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function mountHorrorPaths(root,data,items,card){
 if(!data?.collections?.length)return;
 const lookup=new Map(items.map(i=>[i.id,i]));
 const collections=data.collections.filter(c=>c.id!=='aliens-abductions'&&c.itemIds.some(id=>lookup.has(id)));
 root.innerHTML=`<section class="shelf horror-paths scene" aria-labelledby="horror-paths-heading"><div class="section-top"><h2 id="horror-paths-heading">Go deeper</h2></div><div class="horror-path-tabs" role="tablist" aria-label="Explore horror traditions">${collections.map((c,n)=>`<button type="button" id="path-tab-${esc(c.id)}" role="tab" aria-selected="${n===0}" aria-controls="path-panel-${esc(c.id)}" tabindex="${n===0?0:-1}"><img src="assets/icons/path-${esc(c.id)}.svg" alt="" width="34" height="34"><span>${esc(c.title)}</span></button>`).join('')}</div><div class="horror-path-panels">${collections.map((c,n)=>{
  const records=c.itemIds.map(id=>lookup.get(id)).filter(Boolean);
  const posters=records.map(i=>card(i,true)).join('');
  return `<div class="horror-path-panel ${n?'':'is-current'}" id="path-panel-${esc(c.id)}" role="tabpanel" aria-labelledby="path-tab-${esc(c.id)}" ${n?'inert aria-hidden="true"':''}><p class="horror-path-note">${esc(c.description)}</p>${railMarkup(n?posters.replace(/<img src=/g,'<img data-src='):posters,c.title,'media-row')}</div>`;
 }).join('')}</div></section>`;
 const tabs=[...root.querySelectorAll('[role="tab"]')],panels=[...root.querySelectorAll('[role="tabpanel"]')];
 function select(index){
  tabs.forEach((tab,n)=>{tab.setAttribute('aria-selected',String(n===index));tab.tabIndex=n===index?0:-1});
  panels.forEach((panel,n)=>{const active=n===index;panel.classList.toggle('is-current',active);panel.inert=!active;panel.setAttribute('aria-hidden',String(!active));if(active)panel.querySelectorAll('img[data-src]').forEach(img=>{img.src=img.dataset.src;delete img.dataset.src})});
 }
 tabs.forEach((tab,index)=>{
  tab.addEventListener('click',()=>select(index));
  tab.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;select(next);tabs[next].focus({preventScroll:true})});
 });
 initRails(root);
}
