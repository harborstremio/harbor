import test from 'node:test';
import assert from 'node:assert/strict';
import { matchingReleasesAsync } from '../src/lib/games/source-matches.ts';
import type { GameSource,SourceRelease } from '../src/lib/games/sources.ts';
const entry=(title:string,id='one'):SourceRelease=>({id,title,kind:'game',files:[]});
const source=(entries:SourceRelease[]):GameSource=>({id:'catalog',name:'Catalog',url:'https://example.org/catalog.json',format:'community',checkedAt:1,enabled:true,entries,skipped:0});
test('deep matching visits the full catalog while yielding to UI work; warm reads follow current source metadata',async()=>{
 const entries=Array.from({length:150000},(_,i)=>entry(`Unrelated game ${i}`,String(i)));
 entries[149999]=entry('Sengoku Rance Free Download [Build-25565749]','last');
 const catalog=source(entries);let heartbeat=false;const timer=setTimeout(()=>{heartbeat=true;},0);
 const result=await matchingReleasesAsync([catalog],{name:'Sengoku Rance'},new AbortController().signal);clearTimeout(timer);
 assert.equal(result.length,1);assert.equal(result[0].release.id,'last');assert.equal(heartbeat,true);
 const changed={...catalog,name:'Renamed catalog'};
 const warm=await matchingReleasesAsync([changed],{name:'Sengoku Rance'},new AbortController().signal);
 assert.equal(warm[0].source,changed);
 assert.equal((await matchingReleasesAsync([{...changed,enabled:false}],{name:'Sengoku Rance'},new AbortController().signal)).length,0);
 assert.equal((await matchingReleasesAsync([{...changed,entries:[entry('Another title')]}],{name:'Sengoku Rance'},new AbortController().signal)).length,0);
});
test('abandoned large searches are canceled before publishing stale results',async()=>{
 const controller=new AbortController(),catalog=source(Array.from({length:40000},(_,i)=>entry(`Other game ${i}`)));
 const promise=matchingReleasesAsync([catalog],{name:'Sengoku Rance'},controller.signal);controller.abort();
 await assert.rejects(promise,{name:'AbortError'});
 await assert.rejects(matchingReleasesAsync([],{name:'Sengoku Rance'},controller.signal),{name:'AbortError'});
});

test('matching preserves identity, date and input-order ties through cold and cached queries',async()=>{
 const sources=[
  {...source([{...entry('Example Game','old'),date:'2020-01-01'}]),id:'old'},
  {...source([{...entry('Example Game','new-first'),date:'2024-01-01'}]),id:'first'},
  {...source([{...entry('Another title','identity'),steamId:42,date:'2019-01-01'}]),id:'identity'},
  {...source([{...entry('Example Game','new-second'),date:'2024-01-01'}]),id:'second'},
 ];
 const original=[...sources],game={name:'Example Game',steamId:42};
 for(let attempt=0;attempt<2;attempt++){
  const result=await matchingReleasesAsync(sources,game,new AbortController().signal);
  assert.deepEqual(result.map(match=>match.release.id),['identity','new-first','new-second','old']);
  assert.deepEqual(sources,original);
 }
});

test('failed and disabled sources do not shift successful batches or conceal an error',async()=>{
 const broken={...source([]),id:'broken',catalogIssue:{profile:'test',version:'00000000-0000-4000-8000-000000000000',parts:1,error:'source_storage'}},
  good={...source([entry('Example Game')]),id:'good'},disabled={...source([entry('Example Game')]),id:'disabled',enabled:false};
 const failed:string[]=[];
 const result=await matchingReleasesAsync([broken,disabled,good],{name:'Example Game'},new AbortController().signal,source=>failed.push(source.id));
 assert.deepEqual(failed,['broken']);assert.deepEqual(result.map(match=>match.source.id),['good']);
 await assert.rejects(matchingReleasesAsync([broken,good],{name:'Example Game'},new AbortController().signal),/source_storage/);
 const controller=new AbortController();
 await assert.rejects(matchingReleasesAsync([good,broken],{name:'Example Game'},controller.signal,()=>controller.abort()),{name:'AbortError'});
});
