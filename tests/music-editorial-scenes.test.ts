import assert from 'node:assert/strict';
import test from 'node:test';
import { MUSIC_GENRES, filterMusicGenres } from '../src/lib/music/genre-catalog.ts';
import { genreMatchesTags } from '../src/lib/music/genre-membership.ts';
import { EDITORIAL_SCENES, sceneRecordings } from '../src/lib/music/genre-editorial.ts';
import { loadEditorialRecordings, matchesSceneRecording } from '../src/lib/music/genre-editorial-loader.ts';
import { genreSceneBranches } from '../src/lib/music/genre-scenes.ts';
const genre=(slug:string)=>MUSIC_GENRES.find(g=>g.slug===slug)!;
const track=(artist:string,title='Track')=>({artist:{name:artist},title});

test('new scenes have persistent unique IDs, separate language regions and searchable artist hints',()=>{
 assert.equal(new Set(MUSIC_GENRES.map(g=>g.id)).size,MUSIC_GENRES.length);
 assert.deepEqual(filterMusicGenres(MUSIC_GENRES,'Killeva').map(g=>g.slug),['russian-hyperpop']);
 assert.ok(filterMusicGenres(MUSIC_GENRES,'Parry Gripp').some(g=>g.slug==='internet-classics'));
 assert.ok(filterMusicGenres(MUSIC_GENRES,'український реп',['UA']).some(g=>g.slug==='ukrainian-rap'));
 assert.equal(filterMusicGenres(MUSIC_GENRES,'український реп',['RU']).length,0);
 assert.equal(MUSIC_GENRES.filter(g=>g.slug==='emo').length,1);
});
test('search hints are not evidence of genre membership',()=>{
 assert.equal(genreMatchesTags(genre('russian-rap'),['rap']),false);
 assert.equal(genreMatchesTags(genre('russian-hyperpop'),['Kill Eva']),false);
 assert.equal(MUSIC_GENRES.some(genre=>genre.slug==='soundcloud-rap'),false);
 assert.equal(genreMatchesTags(genre('goth'),['rock']),false);
});
test('rap and hyperpop lead into the new scenes',()=>{
 assert.ok(genreSceneBranches(genre('hip-hop')).some(g=>g.slug==='russian-rap'));
 assert.ok(genreSceneBranches(genre('hyperpop')).some(g=>g.slug==='russian-hyperpop'));
});
test('curated song matches reject unrelated artists, covers and different songs',()=>{
 const song={artist:'Parry Gripp',title:'Raining Tacos'};
 assert.equal(matchesSceneRecording(track('Parry Gripp','Raining Tacos'),song),true);
 assert.equal(matchesSceneRecording(track('Tribute Band','Raining Tacos'),song),false);
 assert.equal(matchesSceneRecording(track('Parry Gripp',"It's Raining Tacos Again"),song),false);
 assert.equal(matchesSceneRecording(track('DJ Kay Slay','Rolling 200 Deep'),{artist:'Kai Angel'}),false);
});
test('song-led collections span pages and never substitute entire artist catalogs',()=>{
 const first=sceneRecordings('ukrainian-wartime'),next=sceneRecordings('ukrainian-wartime',1);
 assert.equal(first.length,16);assert.equal(next.length,15);
 assert.ok(first.some(s=>s.artist==='OTOY'));assert.ok(next.some(s=>s.artist==='OTOY'));
 assert.ok([...first,...next].every(s=>s.title));
 assert.ok(EDITORIAL_SCENES['ukrainian-wartime'].recordings?.every(s=>s.title));
});
test('opened scene searches stay bounded, preserve editorial order and exact identities',async()=>{
 let concurrent=0,peak=0;const paths:string[]=[];
 const result=await loadEditorialRecordings('russian-rap',0,async path=>{
   paths.push(path);peak=Math.max(peak,++concurrent);await new Promise(resolve=>setTimeout(resolve,2));concurrent--;
   const q=new URL('https://api.deezer.com/'+path).searchParams.get('q')!;
   return [track(q),track('Unrelated artist')];
 });
 assert.equal(peak,3);assert.equal(paths.length,8);assert.equal(result.data.length,8);
 assert.equal((result.data[0] as any).artist.name,'Kai Angel');
 assert.equal(result.done,true);
});
test('outages remain retryable and empty final pages stop',async()=>{
 await assert.rejects(loadEditorialRecordings('goth',0,async()=>{throw Error('offline')}),/unavailable/);
 const empty=await loadEditorialRecordings('ukrainian-wartime',2,async()=>{throw Error('must not fetch')});
 assert.deepEqual(empty,{data:[],done:true});
 await assert.rejects(loadEditorialRecordings('goth',-1,async()=>[]));
});
