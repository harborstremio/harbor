import assert from 'node:assert/strict';
import test from 'node:test';
import {sourceTransfer} from '../src/lib/games/source-transfer-state.ts';
import type {GameTorrent} from '../src/lib/games/torrents.ts';
import type {GameTransfer} from '../src/lib/games/transfers.ts';
test('release status follows exact torrent hash across tracker variations, never title',()=>{
 const record={id:'one',name:'same name',infoHash:'a'.repeat(40),status:'downloading',received:5,totalBytes:10} as GameTorrent;
 assert.equal(sourceTransfer({kind:'magnet',url:`magnet:?xt=urn:btih:${'A'.repeat(40)}&tr=udp://tracker.example:80`},[record],[])?.id,'one');
 assert.equal(sourceTransfer({kind:'magnet',url:`magnet:?xt=urn:btih:${'b'.repeat(40)}`},[record],[]),undefined);
 assert.equal(sourceTransfer({kind:'magnet',url:'broken'},[record],[]),undefined);
});
test('direct source uses most recent exact URL and ignores canceled attempts',()=>{
 const rows=[{id:'old',url:'https://example.com/file.zip',status:'complete',createdAt:1},{id:'new',url:'https://example.com/file.zip',status:'downloading',createdAt:2},{id:'canceled',url:'https://example.com/file.zip',status:'canceled',createdAt:3}] as GameTransfer[];
 assert.equal(sourceTransfer({kind:'direct',url:rows[0].url},[],rows)?.id,'new');
 assert.equal(sourceTransfer({kind:'page',url:rows[0].url},[],rows),undefined);
});
test('browser handoff follows persisted original page, never a host or release title',()=>{
 const page='https://gofile.io/d/Abc123';
 const rows=[{id:'first',sourcePage:page,url:'https://cdn.example/signed-one.zip',status:'complete',createdAt:1},{id:'current',sourcePage:page,url:'https://cdn.example/signed-two.zip',status:'downloading',createdAt:2,received:45,total:100},{id:'canceled',sourcePage:page,status:'canceled',createdAt:3},{id:'other',sourcePage:'https://gofile.io/d/Def456',status:'downloading',createdAt:4}] as GameTransfer[];
 const found=sourceTransfer({kind:'page',url:page},[],JSON.parse(JSON.stringify(rows)));
 assert.equal(found?.id,'current');assert.equal(found?.status,'downloading');assert.equal(found?.received,45);
 assert.equal(sourceTransfer({kind:'page',url:'https://gofile.io/d/Xyz789'},[],rows),undefined);
 assert.equal(sourceTransfer({kind:'page',url:rows[1].url},[],rows),undefined);
 rows[1].status='failed';assert.equal(sourceTransfer({kind:'page',url:page},[],rows)?.status,'failed');
});

test('public adapters and connected services follow durable selected links across CDN changes',()=>{
 for(const page of ['https://pixeldrain.com/l/ListID#item=62','https://archive.org/details/community-release','https://www.mediafire.com/file/ExactID/project.zip/file']){
  const rows=[{id:'prior',sourceLink:page,url:'https://cdn.example/old.zip',status:'complete',createdAt:1},{id:'active',sourceLink:page,url:'https://cdn.example/new.zip',status:'downloading',createdAt:2,received:33,total:100},{id:'canceled',sourceLink:page,status:'canceled',createdAt:3},{id:'other',sourceLink:page+'other',status:'downloading',createdAt:4}] as GameTransfer[];
  const result=sourceTransfer({kind:'page',url:page},[],JSON.parse(JSON.stringify(rows)));
  assert.equal(result?.id,'active');assert.equal(result?.received,33);
  assert.equal(sourceTransfer({kind:'page',url:page+'missing'},[],rows),undefined);
  assert.equal(sourceTransfer({kind:'page',url:rows[1].url},[],rows),undefined);
  rows[1].status='failed';assert.equal(sourceTransfer({kind:'page',url:page},[],rows)?.status,'failed');
 }
});

test('source progress follows the whole persisted batch, including failed or canceled parts',()=>{
 const page='https://pixeldrain.com/l/parts';
 const rows=[
  {id:'one',profile:'p',batchId:'latest',sourceLink:page,status:'complete',createdAt:4,received:100,total:100},
  {id:'two',profile:'p',batchId:'latest',sourceLink:page,status:'downloading',createdAt:3,received:50,total:100},
  {id:'old',profile:'p',batchId:'earlier',sourceLink:page,status:'failed',createdAt:1,received:0,total:9000},
  {id:'other-profile',profile:'other',batchId:'latest',sourceLink:page,status:'failed',createdAt:1,received:0,total:9000}
 ] as GameTransfer[];
 let found=sourceTransfer({kind:'page',url:page},[],rows);
 assert.equal(found?.status,'downloading');assert.equal(found?.id,'two');assert.equal(found?.received,150);assert.equal(found?.total,200);
 rows[1].status='failed';assert.equal(sourceTransfer({kind:'page',url:page},[],rows)?.status,'failed');
 rows[1].status='canceled';assert.equal(sourceTransfer({kind:'page',url:page},[],rows)?.status,'canceled');
 rows[1].status='complete';rows[1].received=100;assert.equal(sourceTransfer({kind:'page',url:page},[],rows)?.status,'complete');
 rows[1].total=null;rows[1].expectedBytes=null;assert.equal(sourceTransfer({kind:'page',url:page},[],rows)?.total,null);
});
