import assert from 'node:assert/strict';
import test from 'node:test';
import { downloadGame } from '../src/lib/games/transfers.ts';

test('download display identity is exact, bounded and removes credential-bearing artwork',()=>{
  const game={id:'steam:730',name:'Counter-Strike 2',artwork:'https://art.example/730/hero.jpg',logo:'https://art.example/730/logo.png',sourceName:'Official publisher'};
  assert.deepEqual(downloadGame(game),game);
  assert.equal(downloadGame({...game,artwork:'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/730/header.jpg?t=1773680448'})?.artwork,'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/730/header.jpg');
  for(const bad of ['https://user:secret@example.com/logo.png','https://example.com/a?token=secret','https://example.com/a#secret','file:///local','javascript:alert(1)',' https://example.com/a','https://steamstatic.com.evil.test/art?t=123','https://shared.fastly.steamstatic.com/art?t=123&token=secret']) assert.equal(downloadGame({...game,logo:bad})?.logo,undefined,bad);
  assert.equal(downloadGame({...game,id:''}),undefined);
  assert.equal(downloadGame({...game,name:'x\0y'}),undefined);
  assert.equal(downloadGame(undefined),undefined);
});
