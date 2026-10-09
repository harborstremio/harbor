import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStudioProfile, parseStudioSearch, studioSearchQuery, studioShowcaseGames } from '../src/lib/games/studio-data.ts';
import { companyCatalogClause } from '../src/lib/games/company-relations.ts';
import { atlasQuery, DEFAULT_ATLAS_FILTERS } from '../src/lib/games/igdb-data.ts';
import { gameSeason } from '../src/lib/games/seasons.ts';

const takeTwo={id:139,name:'Take-Two Interactive',logo:{image_id:'cl622'},description:'A game publisher.'};
const twoK={id:8,name:'2K Games',parent:takeTwo};
const current2K={id:20228,name:'2K',logo:{image_id:'cldv8'}};
const records=[
 {id:1,name:'NBA 2K27',involved_companies:[{company:current2K},{company:twoK}]},
 {id:2,name:'Grand Theft Auto V',involved_companies:[{company:{id:13,name:'Rockstar Games',parent:takeTwo}}]},
 {id:3,name:'Grand Theft Auto IV',involved_companies:[{company:{id:13,name:'Rockstar Games',parent:takeTwo}}]},
 {id:4,name:'Red Dead Redemption 2',involved_companies:[{company:twoK}]},
 {id:5,name:'BioShock',involved_companies:[{company:twoK}]},
];
test('company profiles join verified current and legacy 2K identities without duplicating labels',()=>{
 const parent=parseStudioProfile(records,139);
 assert.equal(parent.name,'Take-Two Interactive');assert.deepEqual(parent.children.map(c=>c.name),['2K','Rockstar Games']);
 assert.equal(parent.image,'https://images.igdb.com/igdb/image/upload/t_logo_med/cl622.png');
 assert.equal(parseStudioProfile(records,20228).parent?.id,139);
 assert.throws(()=>parseStudioProfile(records,999));
 assert.equal(studioShowcaseGames(parent.games).length,4);
 assert.ok(!studioShowcaseGames(parent.games).some(g=>g.name==='Grand Theft Auto IV'));
});
test('family catalogs include current NBA publisher and preserve safe nested search, era and pagination',()=>{
 const query=atlasQuery({kind:'company',id:139,name:'Take-Two'}, {...DEFAULT_ATLAS_FILTERS,query:'NBA',era:'2020'},24);
 assert.match(query,/company = \(139,20228\)/);assert.match(query,/name ~ \*"NBA"\*/);assert.match(query,/sort total_rating_count desc/);assert.match(query,/offset 24/);
 assert.match(companyCatalogClause(20228),/company = \(8,20228\)/);
 assert.equal(companyCatalogClause(139,false),'involved_companies.company = (139)');
 assert.throws(()=>companyCatalogClause(NaN));assert.throws(()=>companyCatalogClause(-1));
});
test('studio search filters companies locally, rejects malformed IDs, deduplicates and contains query syntax',()=>{
 assert.deepEqual(parseStudioSearch(records,'Rockstar').map(c=>c.id),[13]);
 assert.deepEqual(parseStudioSearch(records,'unknown'),[]);
 const q=studioSearchQuery('x"; where id=1; * \\');
 assert.equal((q.match(/"/g)??[]).length,4);
 assert.throws(()=>studioSearchQuery('*'));
});
test('seasonal shelves change across local calendar boundaries rather than a fixed October demo',()=>{
 assert.equal(gameSeason(new Date(2026,8,14,12)),'spring');
 assert.equal(gameSeason(new Date(2026,8,15,12)),'halloween');
 assert.equal(gameSeason(new Date(2026,10,3,12)),'halloween');
 assert.equal(gameSeason(new Date(2026,10,15,12)),'holiday');
 assert.equal(gameSeason(new Date(2027,0,6,12)),'holiday');
 assert.equal(gameSeason(new Date(2027,0,7,12)),'spring');
 assert.equal(gameSeason(new Date(2027,6,1,12)),'summer');
});
