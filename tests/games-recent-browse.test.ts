import test from 'node:test';
import assert from 'node:assert/strict';
import { recentSourceRows, mergeRecentSourcePages, type RecentSourceQuery } from '../src/lib/games/source-recent-browse.ts';
import { loadRecentSourcePage } from '../src/lib/games/recent-source-page.ts';
import { catalogBrowseCollector } from '../src/lib/games/source-catalog-browse.ts';
import { createSourceBrowseCache } from '../src/lib/games/source-browse-cache.ts';
import { sourceRecentPreview } from '../src/lib/games/source-recent-preview.ts';
import type { GameSource, SourceRelease } from '../src/lib/games/sources.ts';
const now=Date.parse('2026-10-03T12:00:00Z'),filters:RecentSourceQuery={query:'',sort:'newest',since:0,now};
const release=(n:number):SourceRelease=>({id:String(n),title:'Game '+n,date:new Date(now-n*60000).toISOString(),kind:'game',files:[{name:'Game.zip',url:'https://example.org/game.zip',kind:'direct'}]});
const source=(entries:SourceRelease[],id='one'):GameSource=>({id,name:id,url:'https://example.org/'+id,format:'harbor',entries,enabled:true,checkedAt:now,skipped:0});

test('recent browsing continues beyond the old 36-game summary through the final entry',async()=>{
 const sources=[source(Array.from({length:130},(_,i)=>release(129-i)))];
 for(const limit of [24,48,72,120,144]){
  const page=await loadRecentSourcePage(sources,filters,limit,new AbortController().signal);
  assert.equal(page.entries.length,Math.min(limit,130));
  assert.deepEqual(page.entries.map(x=>x.release.id),Array.from({length:Math.min(limit,130)},(_,i)=>String(i)));
  assert.equal(page.hasMore,limit<130);
 }
});

test('ranking metadata cannot masquerade as usable releases when the record reader is unavailable',async()=>{
 const sources=[0,1].map(group=>({...source([],String(group)),catalog:{profile:'test',version:'00000000-0000-0000-0000-000000000000',parts:1,layout:{bytes:2000000,ends:[100000]},storedEnds:[100000],recent:Array.from({length:36},(_,i)=>sourceRecentPreview(release(i*2+group),i)),recentAt:now,recentUntil:Infinity}}));
 // Node has no Worker/IndexedDB: expose failures, never fabricate file links from previews.
 const page=await loadRecentSourcePage(sources,filters,24,new AbortController().signal);
 assert.equal(page.entries.length,0);assert.deepEqual(page.failed,['0','1']);assert.equal(page.hasMore,false);
});

test('expired recent summaries cannot hide newly eligible future uploads',async()=>{
 const input={...source([]),catalog:{profile:'test',version:'00000000-0000-0000-0000-000000000000',parts:1,layout:{bytes:2000,ends:[40]},storedEnds:[40],recent:[sourceRecentPreview(release(0),0)],recentAt:now-1000,recentUntil:now}};
 const page=await loadRecentSourcePage([input],filters,24,new AbortController().signal);
 // Without a worker, expired data must report a retryable source, not a false end.
 assert.deepEqual(page.entries,[]);assert.deepEqual(page.failed,['one']);
});
test('whole-catalog search, upload period and oldest order apply before pagination',()=>{
 const entries=Array.from({length:120},(_,i)=>release(i));
 entries[110]={...entries[110],title:'Café Search'};
 assert.deepEqual([...recentSourceRows(entries,{...filters,query:'cafe'})],[110]);
 assert.deepEqual([...recentSourceRows(entries,{...filters,sort:'oldest',since:now-3*60000})],[3,2,1,0]);
});
test('deduplication preserves platform editions and rejects future, undated and non-game uploads',()=>{
 const entries=[release(0),{...release(1),title:'Game 0'}, {...release(2),title:'Game 0',platform:'SNES'}, {...release(3),date:undefined}, {...release(4),date:new Date(now+1).toISOString()}, {...release(5),kind:'patch' as const}, {...release(6),files:[]}];
 assert.deepEqual([...recentSourceRows(entries,filters)],[0,2]);
 const first=source([release(0)]),second=source([release(0),release(2)],'two');
 const merged=mergeRecentSourcePages([{source:first,entries:first.entries,total:1},{source:second,entries:second.entries,total:2}],filters,24);
 assert.equal(merged.entries.length,2);assert.equal(merged.hasMore,false);
});
test('streaming recent index retains row numbers without transferring the whole catalog',()=>{
 const entries=Array.from({length:500},(_,i)=>release(499-i)),catalog=source([]);
 const collector=catalogBrowseCollector(catalog,'',0,filters);
 collector.add(entries.slice(0,250));collector.add(entries.slice(250));
 const value=collector.finish();
 assert.equal(value.source.entries.length,0);assert.equal(value.total,500);
 assert.deepEqual(value.storedEnds,[250,500]);assert.equal(value.browseRows?.[0],499);assert.equal(value.browseRows?.at(-1),0);
 assert.equal(value.browseTitles,undefined);
});
test('ranked row cache opts in, rejects duplicate/out-of-range rows and isolates profiles',()=>{
 const cache=createSourceBrowseCache(true),token=cache.select('a');cache.put(token,'recent',Uint32Array.from([4,1,3]),5);
 assert.deepEqual([...cache.get(token,'recent')!],[4,1,3]);
 cache.put(token,'duplicate',Uint32Array.from([1,1]),5);assert.equal(cache.get(token,'duplicate'),undefined);
 cache.put(token,'invalid',Uint32Array.from([8]),5);assert.equal(cache.get(token,'invalid'),undefined);
 const next=cache.select('b');cache.put(token,'late',Uint32Array.from([2]),5);assert.equal(cache.get(next,'recent'),undefined);assert.equal(cache.get(next,'late'),undefined);
});
test('disabled and failed sources never masquerade as an empty complete catalog; canceled requests reject',async()=>{
 const page=await loadRecentSourcePage([source([release(0)]),{...source([release(1)],'disabled'),enabled:false},{...source([],'broken'),catalogIssue:{profile:'a',version:'v',parts:1,error:'source_storage'}}],filters,24,new AbortController().signal);
 assert.deepEqual(page.entries.map(x=>x.release.id),['0']);assert.deepEqual(page.failed,['broken']);
 const controller=new AbortController();controller.abort();await assert.rejects(loadRecentSourcePage([source([])],filters,24,controller.signal),{name:'AbortError'});
});
