import test from "node:test";
import assert from "node:assert/strict";
import { checkGuideAvailability } from "../src/lib/games/guide-availability";
import { GuideSourceNotFound, GuideSourceRateLimit } from "../src/lib/games/guide-source-status";
import { parseGuideVideoPage } from "../src/lib/games/guides-data";

const signal=()=>new AbortController().signal;
const empty=()=>({written:async()=>({items:[],more:false,categories:[],empty:true}),videos:async()=>({items:[]}),technical:async()=>{throw new GuideSourceNotFound();}});

test("ROM hacks without a supported written source do not imply guide availability from gameplay or PC troubleshooting",async()=>{
  assert.equal(await checkGuideAvailability({},signal()),"empty");
  assert.equal(await checkGuideAvailability({written:empty().written},signal()),"empty");
});
test("Only confirmed absence across written, video and technical sources hides Guides",async()=>{
  assert.equal(await checkGuideAvailability(empty(),signal()),"empty");
  assert.equal(await checkGuideAvailability({...empty(),written:undefined},signal()),"empty");
  assert.equal(await checkGuideAvailability({...empty(),written:async()=>({items:[],more:false,categories:[]})},signal()),"unknown");
});
test("Steam guides short-circuit unnecessary video and wiki requests",async()=>{
  let others=0;
  assert.equal(await checkGuideAvailability({written:async()=>({items:[],total:229,more:true,categories:[]}),videos:async()=>{others++;return {items:[]};},technical:async()=>{others++;}},signal()),"available");
  assert.equal(others,0);
});
test("Empty Steam does not hide video or technical guides; continuations remain unknown",async()=>{
  assert.equal(await checkGuideAvailability({...empty(),technical:async()=>({sections:[{}]})},signal()),"available");
  assert.equal(await checkGuideAvailability({...empty(),videos:async()=>({items:[{id:"1",source:"youtube",title:"Guide",author:"",description:"",url:"",image:""}]})},signal()),"available");
  assert.equal(await checkGuideAvailability({...empty(),videos:async()=>({items:[],cursor:{token:"next",clientVersion:"1"}})},signal()),"unknown");
});
test("Failures, content warnings and rate limits never establish absence",async()=>{
  for(const source of ["written","videos","technical"] as const)for(const error of [new Error("HTTP 503"),new Error("Guide catalog unavailable"),new GuideSourceRateLimit(Date.now()+60000)]){
    assert.equal(await checkGuideAvailability({...empty(),[source]:async()=>{throw error;}},signal()),"unknown");
  }
});
test("Leaving the game aborts discovery without caching a negative result",async()=>{
  const controller=new AbortController();
  await assert.rejects(()=>checkGuideAvailability({...empty(),written:async()=>{controller.abort();return {items:[],more:false,categories:[],empty:true};}},controller.signal),{name:"AbortError"});
});
test("Malformed video payloads are errors, while a recognized empty search is valid",()=>{
  assert.throws(()=>parseGuideVideoPage({},"Unknown",false));
  assert.deepEqual(parseGuideVideoPage({contents:{twoColumnSearchResultsRenderer:{primaryContents:{sectionListRenderer:{contents:[]}}}}},"Unknown",false).items,[]);
});
