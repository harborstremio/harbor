import test from 'node:test';
import assert from 'node:assert/strict';
import { atlasQuery, DEFAULT_ATLAS_FILTERS, parseAtlasGame, ROM_HACK_PLATFORMS } from '../src/lib/games/igdb-data.ts';
import { decodeIgdbRows } from '../src/lib/games/igdb-records.ts';
import { EMPTY_EMULATION, withLocalOutput, parseEmulation, localGames } from '../src/lib/games/emulation.ts';

const original={id:'igdb:1559',igdbId:1559,name:'FireRed',capsule:'',platforms:['GBA']};
test('hack catalog combines exact original identity with console, search and pagination',()=>{
 const query=atlasQuery({kind:'romhacks',name:'FireRed',baseGame:original},{...DEFAULT_ATLAS_FILTERS,platform:24,query:'Unbound'},24);
 assert.match(query,/parent_game = 1559/);assert.match(query,/platforms = \(24\)/);assert.match(query,/offset 24/);assert.match(query,/game_type = 5/);
 assert.ok(ROM_HACK_PLATFORMS.includes(18));assert.ok(ROM_HACK_PLATFORMS.includes(29));
 assert.throws(()=>atlasQuery({kind:'romhacks',name:'x',baseGame:{...original,igdbId:-3}},DEFAULT_ATLAS_FILTERS));
 assert.throws(()=>atlasQuery({kind:'romhacks',name:'x'},{...DEFAULT_ATLAS_FILTERS,platform:999}));
});
test('greats and co-op have a rating floor, released cutoff and appropriate game types',()=>{
 for(const kind of ['greats','coop'] as const){const q=atlasQuery({kind,name:kind},{...DEFAULT_ATLAS_FILTERS,sort:'rated'});assert.match(q,/total_rating_count >= 100/);assert.match(q,/game_type = \(0,8,9\)/);assert.match(q,/first_release_date </);assert.match(q,/sort total_rating desc/);if(kind==='coop')assert.match(q,/game_modes = \(3\)/);}
});
test('project websites survive the public cache decoder and unsafe/unrelated URLs do not',()=>{
 const data={id:141663,name:'Unbound',game_type:5,parent_game:{id:1559,name:'FireRed'},websites:[{type:2,url:'https://wiki.example/info'},{type:1,url:'javascript:alert(1)'},{type:1,url:'https://user:password@example.com/'},{type:1,url:'https://project.example/patch'}]};
 const game=parseAtlasGame(decodeIgdbRows([data])![0]);assert.equal(game.projectUrl,'https://project.example/patch');assert.equal(game.parent?.igdbId,1559);
 assert.equal(parseAtlasGame({...data,websites:[{type:2,url:'https://wiki.example/'}]}).projectUrl,undefined);
});
test('adding patched output keeps metadata and only that file through store reload',()=>{
 const output={root:'W:/ROMs',path:'W:/ROMs/Unbound.gba',name:'Unbound',sizeBytes:64,system:24,format:'gba',available:true,discs:1};
 const saved=withLocalOutput(EMPTY_EMULATION(),output,{...original,id:'igdb:141663',igdbId:141663,name:'Unbound'});
 const again=withLocalOutput(saved,output);assert.equal(again.folders.length,1);assert.equal(again.folders[0].games.length,1);
 saved.folders[0].games.push({...output,path:'W:/ROMs/unrelated.gba'});
 const restored=parseEmulation(saved);assert.equal(localGames(restored).length,1);assert.equal(localGames(restored)[0].linked?.name,'Unbound');
 assert.deepEqual(restored.folders[0].files,['W:/ROMs/Unbound.gba']);assert.throws(()=>withLocalOutput(saved,{...output,root:'W:/Other'}));
});
test('adding output to a previously watched folder preserves its full scan behavior',()=>{
 const output={root:'W:/ROMs',path:'W:/ROMs/New.sfc',name:'New',sizeBytes:64,system:19,format:'sfc',available:true,discs:1};
 const store=EMPTY_EMULATION();store.folders.push({root:output.root,id:'19:w:/roms',system:19,games:[],scannedAt:1,skipped:0,limited:false});
 assert.equal(withLocalOutput(store,output).folders[0].files,undefined);
});
