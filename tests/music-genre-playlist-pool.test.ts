import assert from 'node:assert/strict';
import test from 'node:test';
import { musicGenre, MUSIC_GENRES } from '../src/lib/music/genre-catalog.ts';
import { loadGenrePlaylistPage, playlistFitsScene } from '../src/lib/music/genre-playlist-pool.ts';
const genre=musicGenre(10116)!;
const track=(id:number,title=`Song ${id}`)=>({id,title,artist:{name:'Artist'},readable:true});

test('regional playlist matching rejects generic drill and unrelated provider promotions',()=>{
 assert.equal(playlistFitsScene('Drill Chicago',genre),true);
 assert.equal(playlistFitsScene('Chicago Drill',genre),true);
 assert.equal(playlistFitsScene('UK Drill',genre),false);
 assert.equal(playlistFitsScene('Drill Scenes',genre),false);
 assert.equal(playlistFitsScene('Detroit Rock City Movie Soundtrack',musicGenre(10124)!),false);
 assert.equal(MUSIC_GENRES.some(g=>g.slug==='soundcloud-rap'),false);
 assert.ok(MUSIC_GENRES.findIndex(g=>g.slug==='russian-rap')-MUSIC_GENRES.findIndex(g=>g.slug==='ukrainian-wartime')>15);
});
test('live playlist contents merge, deduplicate across pages and preserve loaded order',async()=>{
 const calls:string[]=[];
 const entries=async(path:string)=>{
  calls.push(path);
  if(path.startsWith('search/'))return [{id:1,title:'Chicago Drill',nb_tracks:40},{id:2,title:'Drill Chicago',nb_tracks:40},{id:3,title:'UK Drill'}];
  const url=new URL('https://api.deezer.com/'+path),start=Number(url.searchParams.get('index')),source=path.startsWith('playlist/1/')?1:2;
  return Array.from({length:Math.min(12,40-start)},(_,i)=>track(source===1?start+i+1:start+i+101,`Song ${start+i+1}`));
 };
 const first=await loadGenrePlaylistPage(genre,0,entries),before=calls.length;
 assert.equal(first.data.length,24);assert.equal(first.done,false);
 assert.deepEqual(await loadGenrePlaylistPage(genre,0,entries),first);assert.equal(calls.length,before);
 const second=await loadGenrePlaylistPage(genre,1,entries);
 assert.equal(second.data.length,16);assert.equal(second.done,true);
 const titles=[...first.data,...second.data].map((t:any)=>t.title);assert.equal(new Set(titles).size,40);
 assert.ok(calls.every(path=>!path.startsWith('playlist/3/')));
});
test('playlist pages do not preload the entire catalog and concurrent readers share work',async()=>{
 let active=0,peak=0,requests=0;
 const entries=async(path:string)=>{
  if(path.startsWith('search/'))return Array.from({length:6},(_,i)=>({id:i+1,title:'Chicago Drill'}));
  peak=Math.max(peak,++active);requests++;await new Promise(resolve=>setTimeout(resolve,2));active--;
  const id=Number(path.split('/')[1]);return Array.from({length:12},(_,i)=>track(id*100+i));
 };
 const [a,b]=await Promise.all([loadGenrePlaylistPage(genre,0,entries),loadGenrePlaylistPage(genre,0,entries)]);
 assert.deepEqual(a,b);assert.equal(peak,3);assert.equal(requests,6);assert.equal(a.data.length,24);assert.equal(a.done,false);
});
test('outage keeps cursors retryable and invalid pages do not fetch',async()=>{
 let broken=true;
 const entries=async(path:string)=>{if(path.startsWith('search/'))return [{id:1,title:'Chicago Drill'}];if(broken)throw Error('offline');return [track(1)];};
 await assert.rejects(loadGenrePlaylistPage(genre,0,entries),/unavailable/);broken=false;
 const retry=await loadGenrePlaylistPage(genre,0,entries);assert.equal(retry.data.length,1);assert.equal(retry.done,true);
 await assert.rejects(loadGenrePlaylistPage(genre,-1,entries),/Invalid/);
});
test('playlist edits reach a fresh provider session; missing/hidden tracks never become cards',async()=>{
 const first=await loadGenrePlaylistPage(genre,0,async path=>path.startsWith('search/')?[{id:1,title:'Chicago Drill'}]:[track(1),{...track(2),readable:false},{id:3}]);
 const refreshed=await loadGenrePlaylistPage(genre,0,async path=>path.startsWith('search/')?[{id:1,title:'Chicago Drill'}]:[track(4)]);
 assert.equal(first.data.length,1);assert.equal((refreshed.data[0] as any).id,4);
});
test('removed playlists are skipped while transient failures keep retryable cursors',async()=>{
 const entries=async(path:string)=>{
  if(path.startsWith('search/'))return [{id:1,title:'Chicago Drill'},{id:2,title:'Drill Chicago'}];
  if(path.startsWith('playlist/1/'))throw new Error('No data',{cause:{deezerCode:800}});
  return [track(2)];
 };
 const result=await loadGenrePlaylistPage(genre,0,entries);assert.equal(result.data.length,1);assert.equal(result.done,true);
});
