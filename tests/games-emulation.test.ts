import assert from 'node:assert/strict';
import test from 'node:test';
import { EMPTY_EMULATION, emulationKey, folderKey, localGames, localSearchName, parseLocalMatch, parseEmulation, readEmulation, writeEmulation } from '../src/lib/games/emulation.ts';

const game={path:'W:/Games/Pocket.gba',name:'Pocket',sizeBytes:1024,system:24,format:'GBA',available:true,discs:1};
const folder={id:'old-key',root:'W:/Games',games:[game],system:24,scannedAt:50,skipped:0,limited:false};
test('restored local games validate identity, platform profiles and file paths',()=>{
 const data=parseEmulation({version:1,folders:[folder,{...folder,root:'https://remote/files'},{...folder,system:999}],profiles:{24:{kind:'mgba',path:'W:/Emulators/mGBA.exe'},7:{kind:'mgba',path:'W:/Emulators/mGBA.exe'},33:{kind:'mgba',path:'https://remote/mgba.exe'}},lastPlayed:{[game.path]:99,'https://remote/game':50}});
 assert.equal(data.folders.length,1);assert.equal(data.folders[0].id,folderKey(folder.root,24));assert.deepEqual(Object.keys(data.profiles),['24']);assert.deepEqual(data.lastPlayed,{[game.path]:99});
 assert.equal(parseEmulation({version:2,folders:[folder]}).folders.length,0);
});
test('local filtering deduplicates overlapping roots and marks disconnected folders unavailable',()=>{
 const data={...EMPTY_EMULATION(),folders:[folder,{...folder,id:'other',unavailable:true}]};
 assert.equal(localGames(data,'pock',24).length,1);assert.equal(localGames(data,'pock',24)[0].available,true);assert.equal(localGames(data,'pock',7).length,0);
 assert.equal(localGames({...data,folders:[{...folder,unavailable:true}]},'pock',24)[0].available,false);
 assert.equal(folderKey('W:\\Games',24),folderKey('w:/games',24));assert.notEqual(folderKey('/home/Games',24),folderKey('/home/games',24));
});
test('profile persistence never mixes libraries and rejects a silent truncation on reload',()=>{
 const values=new Map();globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)} as Storage;
 const data={...EMPTY_EMULATION(),folders:[folder]};writeEmulation('one',data);assert.equal(readEmulation('one').folders.length,1);assert.equal(readEmulation('two').folders.length,0);assert.notEqual(emulationKey('a/b'),emulationKey('a%2Fb'));
 assert.throws(()=>writeEmulation('one',{...data,folders:[{...folder,games:Array(12001).fill(game)}]}),/library_limit/);assert.equal(readEmulation('one').folders[0].games.length,1);
});

test('confirmed metadata survives rescans without inventing a local PC copy',()=>{
 const metadata={id:'steam:10',steamId:10,igdbId:98,name:'Pocket Adventure',capsule:'https://images.igdb.com/igdb/image/upload/t_screenshot_huge/valid_1.jpg',portrait:'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/valid_2.jpg',platforms:['Game Boy Advance']};
 const match=parseLocalMatch(metadata)!;assert.equal(match.id,'igdb:98');assert.equal(match.steamId,undefined);
 const data=parseEmulation({...EMPTY_EMULATION(),folders:[folder],matches:{[folderKey(game.path,24)]:metadata}});
 assert.equal(localGames(data,'adventure',24)[0].linked?.name,'Pocket Adventure');
 const rescanned={...data,folders:[{...folder,games:[{...game,sizeBytes:2048}]}]};assert.equal(localGames(rescanned)[0].linked?.igdbId,98);assert.equal(localGames(rescanned)[0].sizeBytes,2048);
 assert.equal(parseLocalMatch({...metadata,portrait:'javascript:alert(1)'})?.portrait,undefined);assert.equal(parseLocalMatch({...metadata,igdbId:-1}),null);
 assert.equal(localSearchName('Metroid_Fusion (USA) [!].gba'),'Metroid Fusion');assert.equal(localSearchName('Pokemon - Unbound (v2.1)'),'Pokemon - Unbound (v2.1)');
});

import { romPlayerMode } from '../src/lib/games/embedded-emulation.ts';
test('configured external player wins over an available embedded core',()=>{
 const cartridge={system:24,format:'GBA'};
 assert.equal(romPlayerMode(cartridge),'embedded');
 assert.equal(romPlayerMode(cartridge,{kind:'mgba',path:'W:/Emulators/mGBA.exe'}),'external');
 assert.equal(romPlayerMode(cartridge,{kind:'retroarch',path:'W:/Emulators/retroarch.exe',corePath:'W:/Emulators/mgba_libretro.dll'}),'external');
 assert.equal(romPlayerMode(cartridge,{kind:'retroarch',path:'W:/Emulators/retroarch.exe'}),'setup');
 assert.equal(romPlayerMode({system:5,format:'RVZ'},{kind:'dolphin',path:'W:/Emulators/Dolphin.exe'}),'external');
 assert.equal(romPlayerMode({system:5,format:'RVZ'}),'setup');
 assert.equal(romPlayerMode({system:18,format:'FDS'}),'setup');
});
