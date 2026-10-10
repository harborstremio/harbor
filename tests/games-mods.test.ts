import test from "node:test";
import assert from "node:assert/strict";
import { modIcon, modUrl, parseModGames, parseModProject, parseModProjects, parseModVersions } from "../src/lib/games/mods.ts";
test("mod catalog requests preserve exact version, loader, query and bounded pages", () => {
  const url=modUrl({kind:"search",query:"shaders & light",loader:"fabric",game:"1.21.1",offset:48,sort:"updated"});
  assert.equal(url.origin,"https://api.modrinth.com"); assert.equal(url.searchParams.get("query"),"shaders & light"); assert.equal(url.searchParams.get("offset"),"48"); assert.deepEqual(JSON.parse(url.searchParams.get("facets")!),[["project_type:mod"],["categories:fabric"],["versions:1.21.1"]]);
  assert.throws(()=>modUrl({kind:"versions",query:"../secret"}));assert.throws(()=>modUrl({kind:"search",offset:10001}));
});
test("mod parser bounds data and rejects unsafe artwork and unusable releases",()=>{
  assert.equal(modIcon("https://cdn.modrinth.com/data/id/icon.png"),"https://cdn.modrinth.com/data/id/icon.png");assert.equal(modIcon("javascript:alert(1)"),"");assert.equal(modIcon("https://cdn.modrinth.com.evil.test/icon.png"),"");
  const parsed=parseModProjects({hits:[{project_id:"valid",slug:"valid",title:"A mod",description:"a".repeat(800),downloads:5,icon_url:"https://evil.test/x.png"},{project_id:"../../bad",slug:"bad",title:"bad"}],total_hits:123});assert.equal(parsed.hits.length,1);assert.equal(parsed.hits[0].description.length,500);assert.equal(parsed.hits[0].icon,"");assert.equal(parsed.total,123);
  assert.deepEqual(parseModGames([{version:"26.3",version_type:"release"},{version:"snapshot",version_type:"snapshot"}]),["26.3"]);
  assert.equal(parseModVersions([{id:"valid",name:"Test",version_number:"1.0",version_type:"release",files:[{primary:true,size:500}]},{id:"bad",files:[]}]).length,1);assert.throws(()=>parseModProjects({error:true}));
});

test("installed mod identity must match before enriching artwork or project links", () => {
  const project = {id:"AANobbMI",project_type:"mod",slug:"sodium",title:"Sodium",description:"Fast rendering",icon_url:"https://cdn.modrinth.com/data/AANobbMI/icon.png"};
  assert.equal(parseModProject(project,"AANobbMI").slug,"sodium");
  assert.throws(()=>parseModProject(project,"unrelated"));
  assert.throws(()=>parseModProject({...project,project_type:"modpack"},"AANobbMI"));
  assert.throws(()=>parseModProject({...project,slug:"../other"},"AANobbMI"));
  assert.equal(parseModProject({...project,icon_url:"https://untrusted.test/icon.png"},"AANobbMI").icon,"");
});
