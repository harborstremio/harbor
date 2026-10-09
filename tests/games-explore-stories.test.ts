import assert from "node:assert/strict";
import test from "node:test";
import { adaptationIdentities, parseExploreStories } from "../src/lib/games/explore-stories.ts";
import { gameMediaTarget, visibleGameMedia } from "../src/lib/games/cross-media.ts";
const claim=(value:unknown,rank="normal")=>({rank,mainsnak:{datavalue:{value}}});
const entity=()=>({labels:{en:{value:"Arcane"}},claims:{P4983:[claim("94605")],P345:[claim("tt11126994")],P31:[claim({id:"Q117467246"})]}});
const candidates=[{qid:"Q85518571",kind:"series" as const,title:"Arcane (TV series)",year:2021}];
test("Wikipedia title resolution follows explicit redirects and rejects unrelated page records",()=>{
  const data={query:{redirects:[{from:"Arcane (TV)",to:"Arcane (TV series)"}],pages:{"1":{title:"Arcane (TV series)",pageprops:{wikibase_item:"Q85518571"}},"2":{title:"Unrelated",pageprops:{wikibase_item:"Q1"}}}}};
  assert.deepEqual(adaptationIdentities(data,[{title:"Arcane (TV)",kind:"series",year:2021}]),candidates);
});
test("Adaptations open the verified film or series, never the original game",()=>{
  const items=parseExploreStories({entities:{Q85518571:entity()}},candidates);
  assert.equal(items.length,1);assert.equal(items[0].wikipediaTitle,"Arcane (TV series)");
  assert.equal(gameMediaTarget(items[0])?.id,"tmdb:tv:94605");
  assert.deepEqual(parseExploreStories({entities:{Q85518571:entity()}},[]),[]);
});
test("Missing and malformed destinations cannot become dead adaptation cards",()=>{
  for(const data of [null,{}, {entities:{}}])assert.deepEqual(parseExploreStories(data,candidates),[]);
  for(const id of ["", "javascript:alert(1)","94605/other","999999999999999999999"]){const changed=entity();changed.claims.P4983=[claim(id)];assert.deepEqual(parseExploreStories({entities:{Q85518571:changed}},candidates),[]);}
  const changed=entity();changed.claims.P4983=[claim("94605","deprecated")];assert.deepEqual(parseExploreStories({entities:{Q85518571:changed}},candidates),[]);
});
test("Explicit adult classifications remain filtered out of the adaptation list",()=>{
  const normal=parseExploreStories({entities:{Q85518571:entity()}},candidates);assert.equal(visibleGameMedia(normal).length,1);
  const changed=entity();changed.claims.P31.push(claim({id:"Q291"}));
  const flagged=parseExploreStories({entities:{Q85518571:changed}},candidates);
  assert.equal(visibleGameMedia(flagged).length,0);assert.equal(visibleGameMedia(flagged,false).length,1);
});
