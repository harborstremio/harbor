import test from 'node:test';
import assert from 'node:assert/strict';
import {isRomHack,hackRelease} from '../src/lib/games/hack-catalog.ts';
import {parseAtlasGame,atlasQuery,DEFAULT_ATLAS_FILTERS} from '../src/lib/games/igdb-data.ts';

test('console catalog excludes unparented entries and explicitly identified ports',()=>{
  const raw={id:1,name:'A hack',game_type:5,platforms:[{id:24,name:'GBA'}],parent_game:{id:2,name:'Original'},summary:'An adventure with teleporting creatures.'};
  assert.equal(isRomHack(parseAtlasGame(raw)),true);
  assert.equal(isRomHack(parseAtlasGame({...raw,parent_game:null})),false);
  assert.equal(isRomHack(parseAtlasGame({...raw,summary:'An unofficial port for the PSP.'})),false);
  assert.equal(isRomHack(parseAtlasGame({...raw,game_type:0})),false);
  assert.equal(isRomHack(parseAtlasGame({...raw,platforms:[{id:6,name:'PC'}]})),false);
  const query=atlasQuery({kind:'romhacks',name:'Hacks'},DEFAULT_ATLAS_FILTERS);
  assert.match(query,/parent_game != null/);assert.match(query,/parent_game.platforms =/);
});
test('download knowledge distinguishes creator patches from Wii mod packs',()=>{
  const unbound=hackRelease({igdbId:141663,name:'Pokémon Unbound'});
  assert.equal(unbound?.method,'patch');assert.equal(new URL(unbound!.download!).hostname,'www.mediafire.com');
  assert.equal(hackRelease({name:'Project+'})?.method,'modpack');
  assert.equal(hackRelease({name:'Project M'})?.method,'modpack');
  assert.equal(hackRelease({name:'Project Minus'}),undefined);
  assert.equal(hackRelease({name:'Another hack',projectUrl:'https://creator.example/patch'})?.page,'https://creator.example/patch');
});
