const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let collections=[];
export function setEditorialCollections(data){collections=Array.isArray(data)?data:[];}
export function editorialCollection(id,items){const c=collections.find(c=>c.id===id);if(!c)return null;const byId=new Map(items.map(i=>[i.id,i]));return {...c,entries:c.itemIds.map(id=>byId.get(id)).filter(Boolean)};}
export function editorialMarkup(items,card,rail){
 if(!collections.length)return '';
 return `<div class="editorial-world" aria-labelledby="editorial-heading"><div class="section-top editorial-heading"><h2 id="editorial-heading">Find your kind of horror</h2></div>${collections.map(collection=>{const c=editorialCollection(collection.id,items);return `<section class="editorial-shelf scene editorial-${esc(c.id)}" aria-labelledby="collection-${c.id}-heading"><div class="editorial-intro"><img class="editorial-backdrop" src="${esc(c.background)}" alt="" loading="lazy"><div class="editorial-intro-copy"><span class="editorial-count">${c.itemIds.length} titles</span><h3 id="collection-${c.id}-heading">${esc(c.title)}</h3><p>${esc(c.description)}</p><button class="section-cta" data-collection="${esc(c.id)}" aria-label="Explore ${esc(c.title)}, ${c.itemIds.length} titles">Explore collection</button></div></div>${rail(c.entries.map(i=>card(i,true)).join(''),c.title,'media-row editorial-row')}</section>`}).join('')}</div>`;
}
export function collectionDialog(c,card){
 const groups=[...new Set(c.entries.map(i=>i.type))];
 const labels={Film:'Films',Series:'Shows',Book:'Books',Manga:'Manga'};
 return `<div class="editorial-detail"><div class="editorial-detail-heading"><p class="detail-meta">Spooktober collection · ${c.entries.length} titles</p><h2 id="dialog-title">${esc(c.title)}</h2><p>${esc(c.description)}</p></div>${groups.length>1?`<div class="collection-filters" aria-label="Filter collection"><button class="quiet-button" data-collection-filter="all" aria-pressed="true">All</button>${groups.map(type=>`<button class="quiet-button" data-collection-filter="${type}" aria-pressed="false">${labels[type]||type}</button>`).join('')}</div>`:''}<div class="collection-title-grid">${c.entries.map(i=>`<div data-collection-type="${i.type}">${card(i,true)}</div>`).join('')}</div></div>`;
}
