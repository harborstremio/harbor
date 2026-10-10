import assert from "node:assert/strict";
import test from "node:test";
import { gameMediaIdentity, gameMediaQuery, gameMediaTarget, gameMediaUrl, gameMediaRelationKey, visibleGameMedia, parseGameMedia, parseGameMediaIdentity } from "../src/lib/games/cross-media.ts";
const binding=(value:Record<string,string>)=>Object.fromEntries(Object.entries(value).map(([key,value])=>[key,{value}]));
const base={work:"http://www.wikidata.org/entity/Q47500433",workLabel:"The Witcher",relation:"sharedSource",via:"http://www.wikidata.org/entity/Q11835640",viaLabel:"The Witcher",tv:"71912",imdb:"tt5180504"};
test("cross-media identity joins exact Steam IDs or IGDB slugs, never numeric IGDB IDs or names",()=>{
  assert.equal(gameMediaIdentity({steamId:292030})?.key,"steam:292030");
  assert.equal(gameMediaIdentity({url:"https://www.igdb.com/games/the-witcher-3-wild-hunt"})?.clause,'?game wdt:P5794 "the-witcher-3-wild-hunt" .');
  for(const url of ["https://www.igdb.com/games/1942","https://fake.igdb.com/games/witcher","https://www.igdb.com/games/a%22%20}","javascript:alert(1)"])assert.equal(gameMediaIdentity({url}),null);
  assert.equal(gameMediaIdentity({steamId:NaN}),null);assert.throws(()=>gameMediaQuery('Q1 }'));
  assert.equal(parseGameMediaIdentity([binding({game:"http://www.wikidata.org/entity/Q4267401"}),binding({game:"Q4267401"})]),"Q4267401");
  assert.equal(parseGameMediaIdentity([binding({game:"Q1"}),binding({game:"Q2"})]),null);assert.equal(parseGameMediaIdentity([null,{}]),null);
});
test("relationships retain provenance, prefer direct adaptations and deduplicate release dates",()=>{
  const links=parseGameMedia([binding(base),binding({...base,date:"2019-12-20T00:00:00Z"}),binding({...base,date:"2020-01-01T00:00:00Z"}),binding({...base,work:"Q2",relation:"universe"}),binding({...base,work:"Q2",relation:"adaptation"})]);
  assert.equal(links.length,2);assert.equal(links[0].relation,"adaptation");assert.equal(links[1].relation,"sharedSource");assert.equal(links[1].year,2019);assert.equal(links[1].via?.qid,"Q11835640");
  const target=gameMediaTarget(links[1]);assert.equal(target?.kind,"series");assert.equal(target?.id,"tmdb:tv:71912");
});
test("malformed identifiers, unknown relationships and untraceable indirect links are omitted",()=>{
  const links=parseGameMedia([null,binding({...base,tv:"not an id",imdb:"javascript:foo"}),binding({...base,workLabel:"Q9"}),binding({...base,relation:"lookalike"}),binding({...base,via:"bad"}),binding({...base,viaLabel:""}),binding({...base,tv:"",book:"OL12A"})]);assert.deepEqual(links,[]);
  const valid=parseGameMedia([binding({...base,imdb:"not an id"})])[0];assert.equal(valid.imdbId,undefined);assert.equal(gameMediaUrl(valid),"https://www.themoviedb.org/tv/71912");
});
test("books distinguish external catalog records from readable Gutenberg destinations",()=>{
  const book=parseGameMedia([binding({work:"Q1",workLabel:"A real book",relation:"source",book:"OL123W"})])[0];assert.equal(book.kind,"book");assert.equal(gameMediaTarget(book),null);assert.equal(gameMediaUrl(book),"https://openlibrary.org/works/OL123W");assert.equal(gameMediaTarget({...book,gutenbergId:"123"})?.id,"source:gutendex:123");
});

test("default related-media filtering hides adult and unclassified records before artwork can be rendered",()=>{
  const items=parseGameMedia([
    binding({...base,work:"Q1",workLabel:"Warcraft",film:"68735",tv:"",relation:"seriesAdaptation",adult:"false",parody:"false"}),
    binding({...base,work:"Q2",workLabel:"An adult parody",adult:"true",parody:"true"}),
    binding({...base,work:"Q3",workLabel:"Unclassified source"}),
  ]);
  assert.deepEqual(visibleGameMedia(items).map(item=>item.qid),["Q1"]);
  assert.equal(visibleGameMedia(items,false).length,3);
  // Reapplying the default policy must also filter a shared cache previously read with adult content enabled.
  assert.deepEqual(visibleGameMedia(visibleGameMedia(items,false),true).map(item=>item.qid),["Q1"]);
  assert.equal(gameMediaRelationKey(items.find(item=>item.qid==="Q2")!),"games.media.relation.parody");
});

test("duplicate relationship rows cannot downgrade adult or parody classifications",()=>{
  const rows=[binding({...base,adult:"true",parody:"true"}),binding({...base,relation:"adaptation",adult:"false",parody:"false"})];
  for(const values of [rows,[...rows].reverse()]){
    const [item]=parseGameMedia(values);
    assert.equal(item.relation,"adaptation");assert.equal(item.adult,true);assert.equal(item.parody,true);
    assert.deepEqual(visibleGameMedia([item]),[]);assert.equal(gameMediaRelationKey(item),"games.media.relation.parody");
    assert.equal(gameMediaRelationKey({...item,relation:"source"}),"games.media.relation.source");
  }
});

test("hidden records do not crowd genuine connections out of the visible result limit",()=>{
  const rows=Array.from({length:40},(_,index)=>binding({...base,work:`Q${index+1}`,workLabel:`A hidden record ${index}`,adult:"true",parody:"true"}));
  rows.push(binding({...base,work:"Q99",workLabel:"Visible source",adult:"false"}));
  const items=parseGameMedia(rows);
  assert.deepEqual(visibleGameMedia(items).map(item=>item.qid),["Q99"]);
  assert.equal(visibleGameMedia(items,false).length,32);
});
