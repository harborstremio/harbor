import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';
function load(file, mocks={}) {
 const source=fs.readFileSync(new URL(`../src/lib/music/${file}.ts`,import.meta.url),'utf8');
 const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 const mod={exports:{}};new Function('require','module','exports',outputText)(name=>{if(!(name in mocks))throw Error(`Unmocked: ${name}`);return mocks[name]},mod,mod.exports);return mod.exports;
}
const genres=load('genre-catalog');
const track=(id,title='Song',artist='Artist')=>({id,title,artist,artwork:'https://example.com/cover.jpg',durationSeconds:180,durationLabel:'3:00',connectorId:'catalog'});
const entry=(id,rank=10)=>({id,title:`Song ${id}`,rank,duration:180,artist:{id:4,name:'Artist',picture_big:'https://example.com/artist.jpg'},album:{id:55,title:'Album',cover_big:'https://example.com/cover.jpg'}});
const discovery=(fetch)=>load('discovery',{'@/lib/safe-fetch':{safeFetch:fetch},'./genre-catalog':genres});
const response=data=>({ok:true,json:async()=>data});

test('genre artist roster follows tagged artists beyond the first page and retries failed pages',async()=>{
 const calls=[];let fail=true;
 const api=load('genre-artist-roster',{'./genre-catalog':genres,'./recording-profile':{scheduleMusicBrainzRequest:fn=>fn()},'@/lib/safe-fetch':{safeFetch:async url=>{
  const params=new URL(url).searchParams,offset=Number(params.get('offset'));calls.push(offset);
  assert.match(params.get('query'),/tag:"hip-hop"/);assert.match(params.get('query'),/tag:"rap"/);
  if(offset===24&&fail){fail=false;throw Error('offline')}
  return response({count:60,artists:Array.from({length:Math.min(24,60-offset)},(_,i)=>({id:`00000000-0000-0000-0000-${String(offset+i).padStart(12,'0')}`,name:`Tagged rapper ${offset+i}`}))});
 }}});
 const one=await api.loadGenreArtistRoster(116);assert.equal(one.artists.length,24);assert.equal(one.next,24);
 await assert.rejects(api.loadGenreArtistRoster(116,one.next),/offline/);
 const two=await api.loadGenreArtistRoster(116,one.next);assert.equal(two.next,48);
 const three=await api.loadGenreArtistRoster(116,two.next);assert.equal(three.next,null);
 assert.equal(new Set([...one.artists,...two.artists,...three.artists].map(a=>a.id)).size,60);
 assert.ok(one.artists.every(a=>a.connectorId==='catalog'&&a.musicBrainzId));
 await api.loadGenreArtistRoster(116);assert.deepEqual(calls,[0,24,24,48]);
});
test('shared catalog preserves all legacy taste IDs and adds the requested specific scenes',()=>{
 const legacy=[132,116,122,152,113,165,85,186,106,466,144,129,84,67,65,98,173,464,169,2,16,153,75,71,81,95,197];
 assert.equal(genres.MUSIC_GENRES.length,134);assert.equal(new Set(genres.MUSIC_GENRES.map(g=>g.id)).size,134);
 legacy.forEach(id=>assert.equal(genres.musicGenre(id)?.deezerId,id));
 for(const slug of ['nightcore','jumpstyle','hardstyle','funk-carioca','pagode'])assert.ok(genres.MUSIC_GENRES.some(g=>g.slug===slug));
});
test('filters combine countries, family and accent-insensitive alias searches',()=>{
 const list=genres.MUSIC_GENRES;
 assert.ok(genres.filterMusicGenres(list,'forro',['BR']).some(g=>g.name==='Forró'));
 assert.ok(genres.filterMusicGenres(list,'baile funk',['BR']).some(g=>g.slug==='funk-carioca'));
 assert.equal(genres.filterMusicGenres(list,'pagode',['JP']).length,0);
 assert.ok(genres.filterMusicGenres(list,'',['BR','JP']).every(g=>g.countries.includes('BR')||g.countries.includes('JP')));
});
test('niche genres use matched playlists, bounded track requests, no invented chart IDs',async()=>{
 const calls=[];const api=discovery(async url=>{calls.push(url);return response(url.includes('search/playlist')?{data:[{id:1,title:'Nightcore Hits'},{id:2,title:'Nightcore party'},{id:3,title:'Popular jazz'},{id:4,title:'Nightcore favorites'}]}:{data:[entry(10),entry(11),entry(10)]});});
 const genre=genres.MUSIC_GENRES.find(g=>g.slug==='nightcore');
 const result=await api.loadMusicGenreSelection(genre.id);
 assert.equal(calls.length,3);assert.ok(calls.every(url=>!url.includes('/chart/')));
 assert.equal(result.tracks.length,2);assert.deepEqual(result.positions,[null,null]);assert.equal(result.albums.length,1);
 assert.equal(api.matchesGenrePlaylist('popular jazz',['pop']),false);
 assert.equal(api.matchesGenrePlaylist('Baile Funk 2026',['baile funk']),true);
 await api.loadMusicGenreSelection(genre.id);assert.equal(calls.length,3);
});
test('provider failures surface instead of pretending the genre is empty',async()=>{
 const api=discovery(async()=>({ok:false,status:503}));await assert.rejects(api.loadMusicGenreSelection(genres.MUSIC_GENRES.find(g=>g.slug==='pagode').id));
});
const identity=t=>`${t.title}|${t.artist}`;
const listen=()=>load('listening-affinity',{'./local-store':{cachedLocalJson:()=>null,readLocalJson:async()=>null,writeLocalJson(){}},'./preferences':{readMusicPreference:()=>null,writeMusicPreference(){}},'./track-identity':{musicTrackIdentity:identity},'./search-artists':{artistCreditParts:n=>n.split(/ & |, /)}});
test('repeat affinity counts actual listening once, ignoring seek jumps and paused time',()=>{
 let time=0,plays=0;const observe=listen().createListeningObserver(()=>plays++,()=>time);
 const state={current:track('a'),phase:'playing',currentTime:0,duration:180};
 observe(state,'one','p');for(let i=1;i<=35;i++){time+=1000;observe({...state,currentTime:i},'one','p');}assert.equal(plays,1);
 for(let i=36;i<=80;i++){time+=1000;observe({...state,currentTime:i},'one','p');}assert.equal(plays,1);
 time+=1000;observe(state,'two','p');time+=1000;observe({...state,currentTime:100},'two','p');assert.equal(plays,1);
 time+=60_000;observe({...state,currentTime:160},'two','p');assert.equal(plays,1);
});
test('repeat seeds favor revisited music while keeping artists distinct',()=>{
 const a=track('a','A','Repeat'),b=track('b','B','Recent'),c=track('c','C','Repeat');
 const picks=listen().musicExploreSeeds([b,a,c],[],{[identity(a)]:{plays:20,at:100}},100);
 assert.equal(picks[0].id,'a');assert.equal(picks.length,2);
});
test('event results enforce event and edition, exclude trailers, and keep original video identities',()=>{
 const events=load('events',{'./video-discovery':{searchMusicVideos:async()=>[]}}),event=events.MUSIC_EVENTS[0];
 const results=events.matchEventSets([track('a','Artist Live at Coachella 2026'),track('b','Artist Coachella 2025'),track('c','Coachella 2026 lineup'),track('d','Artist Live 2026')],event,2026);
 assert.deepEqual(results.map(r=>r.track.id),['a']);assert.equal(results[0].year,2026);
 assert.equal(events.eventYears(event,new Date('2026-09-28'))[0],2026);
 assert.equal(events.eventYears(events.MUSIC_EVENTS.find(e=>e.id==='live-aid'),new Date('2026-09-28')).join(','),'1985');
});
test('recent events try the previous edition only when the current edition has no footage',async()=>{
 const calls=[];const events=load('events',{'./video-discovery':{searchMusicVideos:async q=>{calls.push(q);return q.includes('2025')?[track(q,q)]:[]}}});
 const result=await events.loadRecentEventSets(false,new Date('2026-09-28'));
 assert.equal(calls.length,8);assert.ok(result.length);assert.ok(result.every(row=>row.year===2025));
});
test('recommendation shelf recovers from an unresolvable upload using another listening artist',async()=>{
 const api=discovery(async()=>response({data:[]}));
 const rec=load('explore-recommendations',{'@/lib/safe-fetch':{safeFetch:async url=>response(url.includes('search/artist')?{data:url.includes('Known')?[{id:7,name:'Known',nb_fan:100}]:[]}:{data:[1,2,3,4,5,6].map(id=>entry(id))})},'./search-artists':{artistCreditParts:n=>[n]},'./genre-catalog':genres,'./discovery':api,'./queue-continuation':{freshContinuationTracks:(a,e)=>a.filter(t=>!e.some(x=>x.id===t.id))}});
 const result=await rec.loadExploreRecommendations([track('u','Upload','Unknown'),track('k','Known song','Known')],[]);
 assert.equal(result.seed.artist,'Known');assert.equal(result.tracks.length,6);assert.ok(result.tracks.every(t=>t.artwork));
});
test('unknown artist counts stay unknown; real listeners and plays stay separate from fans',async()=>{
 const stats=load('genre-insights',{'./artist-authority':{resolveArtist:async()=>null},'@/lib/safe-fetch':{safeFetch:async url=>response(url.includes('deezer')?{nb_fan:1500}:{artist:{stats:{listeners:'2400',playcount:'12345'}}})},'@/lib/secret-store':{loadSecrets:async()=>{},getSecret:()=> 'test-key'},'./lastfm':{LASTFM_API_KEY:'key'}});
 assert.equal(stats.realCount(undefined),undefined);assert.equal(stats.realCount(''),undefined);assert.equal(stats.realCount('0'),0);assert.equal(stats.realCount('1.5M'),undefined);
 const [result]=await stats.loadGenreArtistStats([{id:'deezer:artist:4',connectorId:'catalog',name:'Artist'}]);assert.equal(result.fans,1500);assert.equal(result.listeners,2400);assert.equal(result.plays,12345);
});
test('all Explore labels exist in every locale with matching placeholders',()=>{
 const base=new URL('../src/lib/i18n/locales/',import.meta.url);const table=lang=>Object.fromEntries([...fs.readFileSync(new URL(`${lang}/music-taste.ts`,base),'utf8').matchAll(/"(music\.explore\.[^"]+)":\s*("(?:[^"\\]|\\.)*")/g)].map(m=>[m[1],JSON.parse(m[2])]));
 const en=table('en');assert.equal(Object.keys(en).length,48);
 for(const lang of ['ar','de','es','fr','hi','id','it','ja','ko','pl','pt','ru','tr','vi','zh']){const local=table(lang);assert.deepEqual(Object.keys(local).sort(),Object.keys(en).sort(),lang);for(const key in en)assert.deepEqual(local[key].match(/\{[^}]+\}/g)?.sort(),en[key].match(/\{[^}]+\}/g)?.sort(),`${lang}:${key}`);}
});
test('every genre has artwork and its own Illustrator-exported vector',()=>{
 const art=load('genre-artwork').MUSIC_GENRE_ARTWORK;const shapes=[];
 for(const genre of genres.MUSIC_GENRES){assert.match(art[genre.id],/^https:\/\//);const svg=fs.readFileSync(new URL(`../src/assets/music-genres/${genre.slug}.svg`,import.meta.url),'utf8');assert.match(svg,/Adobe Illustrator/);assert.match(svg,/viewBox="0 0 48 48"/);assert.match(svg,/currentColor/);assert.doesNotMatch(svg,/<text|<font|<script/);shapes.push(svg);}
 assert.equal(new Set(shapes).size,134);
});

const artistEntry=id=>({...entry(id),artist:{id,name:`Artist ${id}`,picture_big:'https://example.com/artist.jpg'}});
const artistPages=fetch=>load('genre-artists',{'@/lib/safe-fetch':{safeFetch:fetch},'./genre-catalog':genres,'./discovery':discovery(fetch)});
test('genre artist browsing continues past twenty without duplicate cards or mutating the previous cursor',async()=>{
 const calls=[];const api=artistPages(async url=>{calls.push(url);const offset=Number(new URL(url).searchParams.get('index'));return response({data:Array.from({length:24},(_,i)=>artistEntry(offset+i))});});
 const initial=api.firstGenreArtistCursor(116),saved=structuredClone(initial);
 const one=await api.loadGenreArtistPage(116,initial,['deezer:artist:24']);
 assert.equal(one.artists.length,23);assert.deepEqual(initial,saved);
 const two=await api.loadGenreArtistPage(116,one.next,one.artists.map(a=>a.id));
 assert.equal(two.artists.length,24);assert.equal(new Set([...one.artists,...two.artists].map(a=>a.id)).size,47);
 assert.deepEqual(calls.map(url=>new URL(url).searchParams.get('index')),['24','48']);
});
test('repeated chart pages fall through to genre-matched playlists',async()=>{
 const calls=[];const api=artistPages(async url=>{calls.push(url);return response(url.includes('/chart/')?{data:Array.from({length:24},(_,i)=>artistEntry(i+1))}:url.includes('/search/')?{data:[null,{id:7,title:'Hip-Hop classics'},{id:8,title:'Global pop hits'}]}:{data:[artistEntry(101)]});});
 const one=await api.loadGenreArtistPage(116,api.firstGenreArtistCursor(116));
 const two=await api.loadGenreArtistPage(116,one.next,one.artists.map(a=>a.id));
 assert.ok(two.artists.some(a=>a.id==='deezer:artist:101'));
 assert.ok(calls.some(url=>url.includes('/playlist/7/')));assert.ok(calls.every(url=>!url.includes('/playlist/8/')));
 assert.equal(two.next?.chartOffset??null,null);
});
test('niche artists follow provider track pagination and retry failed pages without losing the cursor',async()=>{
 const genre=genres.MUSIC_GENRES.find(g=>g.slug==='pagode');let fail=true;const calls=[];
 const api=artistPages(async url=>{calls.push(url);if(url.includes('/search/'))return response({data:[{id:9,title:'Pagode favorites'}]});const index=Number(new URL(url).searchParams.get('index'));if(index===24&&fail){fail=false;throw Error('offline');}return response({data:Array.from({length:24},(_,i)=>artistEntry(i+index+1)),...(index===0?{next:'https://api.deezer.com/playlist/9/tracks?index=24'}:{})});});
 const one=await api.loadGenreArtistPage(genre.id,api.firstGenreArtistCursor(genre.id));
 const before=structuredClone(one.next);
 await assert.rejects(api.loadGenreArtistPage(genre.id,one.next,one.artists.map(a=>a.id)),/offline/);
 assert.deepEqual(one.next,before);
 const two=await api.loadGenreArtistPage(genre.id,one.next,one.artists.map(a=>a.id));
 assert.equal(two.artists.length,24);assert.ok(calls.every(url=>!url.includes('/chart/')));
 assert.equal(two.next,null);
});
test('artist statistics enrich every artist and preserve the browsing order',async()=>{
 const stats=load('genre-insights',{'./artist-authority':{resolveArtist:async()=>null},'@/lib/safe-fetch':{safeFetch:async url=>response({nb_fan:Number(url.split('/').at(-1))})},'@/lib/secret-store':{loadSecrets:async()=>{},getSecret:()=>null},'./lastfm':{LASTFM_API_KEY:'key'}});
 const artists=Array.from({length:25},(_,i)=>({id:`deezer:artist:${i+1}`,connectorId:'catalog',name:`Artist ${i+1}`}));
 const result=await stats.loadGenreArtistStats(artists);assert.equal(result.length,25);assert.deepEqual(result.map(r=>r.artist.id),artists.map(a=>a.id));assert.equal(result.at(-1).fans,25);
});
test('Hip-hop scene browsing exposes ten distinct rap branches using existing genres',()=>{
 const api=load('genre-scenes',{'./genre-catalog':genres});const branches=api.genreSceneBranches(genres.musicGenre(116));
 assert.equal(branches.length,10);assert.equal(new Set(branches.map(g=>g.id)).size,10);
 for(const slug of ['trap','uk-drill','phonk','french-rap','brazilian-trap'])assert.ok(branches.some(g=>g.slug===slug));
});
