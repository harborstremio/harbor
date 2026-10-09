import test from 'node:test';import assert from 'node:assert/strict';
import {webIntent,webIntentKey} from '../src/lib/games/cloud-web-jobs.ts';
test('web job persistence validates untrusted storage and does not store credentials or arbitrary metadata',()=>{
 const value={version:1,url:'https://files.example/game',title:'Game',remoteId:null,createdAt:1};assert.deepEqual(webIntent({...value,key:'secret',extra:'private'}),value);assert.equal(webIntent(undefined),null);
 for(const bad of [{...value,remoteId:'../file'},{...value,url:'file:///local'},{...value,url:'https://user:pass@files.example/game'},{...value,createdAt:NaN},{...value,title:'x'.repeat(501)}])assert.throws(()=>webIntent(bad),/web_storage/);
});
test('intent identity isolates profiles, connected account keys and exact source links',async()=>{
 const id=await webIntentKey('one',' key ','https://files.example/game');assert.match(id,/^[a-f0-9]{64}$/);assert.equal(id,await webIntentKey('one','key','https://files.example/game'));
 for(const args of [['two','key','https://files.example/game'],['one','changed','https://files.example/game'],['one','key','https://files.example/game?part=2']])assert.notEqual(id,await webIntentKey(...args));
});
test('source file keys survive durable provider jobs and distinct keys have distinct identities',async()=>{
 const url='https://mega.nz/folder/ExampleA#fixture-key/file/ExampleB';
 const value={version:1,url,title:'Community project',remoteId:null,createdAt:1};
 assert.equal(webIntent(value)?.url,url);
 for(const provider of ['tb','pm','ad'] as const){
  const id=await webIntentKey('profile','key',url,provider);
  assert.notEqual(id,await webIntentKey('profile','key',url.replace('fixture-key','different-key'),provider));
  assert.notEqual(id,await webIntentKey('profile','key',url.split('#')[0],provider));
 }
});
test('Premiumize job IDs persist without colliding with existing TorBox account/link identities',async()=>{
 const value={version:1,url:'https://files.example/project',title:'Project',remoteId:'job-ab_7:one',createdAt:1};assert.equal(webIntent(value)?.remoteId,value.remoteId);
 for(const remoteId of ['..','.','job/other','x'.repeat(129),'id\nsecret'])assert.throws(()=>webIntent({...value,remoteId}),/web_storage/);
 const old=await webIntentKey('profile','key',value.url);assert.equal(old,await webIntentKey('profile','key',value.url,'tb'));assert.notEqual(old,await webIntentKey('profile','key',value.url,'pm'));
});
