import test from "node:test";
import assert from "node:assert/strict";
import { defaultSteamGuideFilters, normalizeSteamGuideFilters, steamGuideHeaders, steamGuidesUrl, type SteamGuideFilters } from "../src/lib/games/steam-guide-options";

test("Community preference applies only to the selected valid Steam app",()=>{
  assert.deepEqual(steamGuideHeaders(1158310),{Cookie:"wants_mature_content_apps=1158310"});
  for(const id of [0,-1,NaN,Infinity,1.5])assert.throws(()=>steamGuideHeaders(id));
});

test("Steam guide categories, language and search remain applied across source pages",()=>{
  const filters:SteamGuideFilters={sort:"popular",days:90,categories:["Walkthroughs","Achievements"],language:"English"};
  for(const page of [1,2,101]){
    const url=new URL(steamGuidesUrl(1145350," boss & builds ",page,filters));
    assert.equal(url.origin,"https://steamcommunity.com");assert.equal(url.pathname,"/app/1145350/guides/");
    assert.equal(url.searchParams.get("browsefilter"),"trend");assert.equal(url.searchParams.get("browsesort"),"trend");
    assert.equal(url.searchParams.get("p"),String(page));assert.equal(url.searchParams.get("days"),"90");
    assert.equal(url.searchParams.get("searchText"),"boss & builds");
    assert.deepEqual(url.searchParams.getAll("requiredtags[]"),["Achievements","Walkthroughs","English"]);
  }
});
test("All-time ratings and newest sorting omit the popularity period",()=>{
  for(const [sort,source] of [["rated","toprated"],["recent","mostrecent"]] as const){
    const url=new URL(steamGuidesUrl(730,"",1,{sort,days:1,categories:[],language:""}));
    assert.equal(url.searchParams.get("browsefilter"),source);assert.equal(url.searchParams.has("days"),false);
    assert.deepEqual(url.searchParams.getAll("requiredtags[]"),[]);
  }
});
test("Only Steam's published filter terms and periods enter the request",()=>{
  const clean=normalizeSteamGuideFilters({sort:"other" as "rated",days:30,categories:["Secrets","Secrets","random","Weapons&appid=1"],language:"unknown"});
  assert.deepEqual(clean,{sort:"rated",days:7,categories:["Secrets"],language:""});
  assert.throws(()=>steamGuidesUrl(-1,"",1,clean));assert.throws(()=>steamGuidesUrl(730,"",0,clean));
  assert.equal(new URL(steamGuidesUrl(730,"x".repeat(500),1,clean)).searchParams.get("searchText")?.length,180);
});
test("Default guide language follows supported UI languages without inventing unsupported tags",()=>{
  assert.equal(defaultSteamGuideFilters("en").language,"English");assert.equal(defaultSteamGuideFilters("de").language,"German");
  assert.equal(defaultSteamGuideFilters("zh").language,"schinese");assert.equal(defaultSteamGuideFilters("ar").language,"");
});
