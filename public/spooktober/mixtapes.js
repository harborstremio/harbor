const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PICKS=[
 {id:'party',coverTitles:['Thriller','Ghostbusters'],title:'Halloween party',description:'Halloween party favorites.',art:['pumpkin-mischief','pumpkin-grin'],titles:['Thriller','Ghostbusters','Monster Mash','Somebody','Spooky, Scary','Heads Will Roll','Disturbia','Everybody','Calling All the Monsters','Superstition']},
 {id:'dark',coverTitles:['Lullaby','Red Right Hand'],title:'After dark',description:'A darker mix.',art:['foreground-tree','grass-clump'],titles:['Lullaby','Bela Lugosi','Spellbound','Red Right Hand','bury a friend','Psycho Killer','Dragula','Pet Sematary','Feed My Frankenstein','Dead Man']},
 {id:'scores',coverTitles:['Halloween Theme','Tubular Bells'],title:'Horror soundtracks',description:'Music from horror films.',art:['headstone-cross','grass-clump'],titles:['Halloween','Tubular Bells','Suspiria','This Is Halloween','The Addams Family']},
];
let curated=[];
export function setMusicCollections(data){curated=Array.isArray(data)?data:[];}
export function musicCollections(items){
 if(curated.length){const byId=new Map(items.map(i=>[i.id,i]));return curated.map(p=>({...p,covers:(p.coverIds||[]).map(id=>byId.get(id)).filter(Boolean),songs:p.songIds.map(id=>byId.get(id)).filter(Boolean)}));}
 return PICKS.map(p=>({...p,covers:p.coverTitles.map(title=>items.find(i=>i.type==='Music'&&i.title.startsWith(title))).filter(Boolean),songs:items.filter(i=>i.type==='Music'&&p.titles.some(title=>i.title.startsWith(title)))}));
}
export function mixArt(p){return `<span class="mix-art mix-art-${p.id}" aria-hidden="true">${p.art.map((name,n)=>`<img class="mix-prop mix-prop-${n}" src="assets/art/${name}.svg" alt="" loading="lazy">`).join('')}<span class="mix-albums">${p.covers.map(i=>`<img src="${i.poster}" alt="" loading="lazy" width="160" height="160">`).join('')}</span></span>`}
export function playlistMarkup(items,railMarkup){
 return `<section class="playlist-world scene" aria-labelledby="playlist-heading"><div class="section-top"><div><h2 id="playlist-heading">Halloween playlists</h2><p>Find your Halloween soundtrack.</p></div></div>${railMarkup(musicCollections(items).map(p=>`<button class="playlist-card" data-playlist="${p.id}" aria-label="Explore ${p.title}, ${p.songs.length} songs">${mixArt(p)}<span class="playlist-copy"><strong>${p.title}</strong><small>${p.songs.length} songs</small><span>${p.description}</span></span></button>`).join(''),'Halloween playlists','playlist-grid')}</section>`;
}
export function playlistDialog(p,saved){
 return `<div class="playlist-detail"><div class="playlist-intro">${mixArt(p)}<div><p class="detail-meta">Spooktober playlist · ${p.songs.length} songs</p><h2 id="dialog-title">${p.title}</h2><p>${p.description}</p><button class="quiet-button" id="save-playlist">${p.songs.every(i=>saved.has(i.id))?'All songs saved':'Save all songs'}</button></div></div><div class="playlist-tracks">${p.songs.map((i,n)=>`<button class="playlist-track" data-item="${i.id}"><span class="track-number">${String(n+1).padStart(2,'0')}</span><img src="${i.poster}" alt="" loading="lazy"><span class="track-title"><strong>${esc(i.title)}</strong><small>${esc(i.creator)}</small></span><span class="track-duration">${Math.floor(i.duration/60)}:${String(i.duration%60).padStart(2,'0')}</span></button>`).join('')}</div></div>`;
}
