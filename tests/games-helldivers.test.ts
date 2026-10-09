import assert from 'node:assert/strict';
import test from 'node:test';
import { helldiversCampaigns, helldiversFactionArt, helldiversLiberated, helldiversMapLinks, helldiversMapPoint, helldiversProgress, helldiversRegionArt, parseHelldiversCampaigns, parseHelldiversGalaxy, parseHelldiversOrders } from '../src/lib/games/helldivers-data.ts';
const planet=(index=4,changes={})=>({index,name:`PLANET ${index}`,sector:'Rictus',position:{x:.4,y:-.2},currentOwner:'Illuminate',disabled:false,health:750,maxHealth:1000,regenPerSecond:.1,statistics:{playerCount:50},hazards:[{name:'Tremors',description:'Earthquakes'}],biome:{name:'Desert',description:'Dry'},regions:[{id:0,name:'New town',isAvailable:true,players:10,health:50,maxHealth:100}],event:null,...changes});
const campaign=(id=1,changes={})=>({id,planet:planet(id,changes),faction:'Humans',type:0});
test('Campaign identity, faction and region progress use their own source fields',()=>{
 const data=parseHelldiversCampaigns([campaign()]);const p=data.campaigns[0];
 assert.equal(p.faction,'Illuminate');assert.equal(p.owner,'Illuminate');assert.equal(p.liberated,25);assert.equal(p.regions[0].liberated,50);assert.equal(p.regions[0].available,true);assert.equal(p.recovery,36);assert.equal(data.partial,false);
 assert.equal(helldiversLiberated(0,100),100);assert.equal(helldiversLiberated(100,100),0);
 for(const [health,max] of [[null,100],[100,0],[-1,100],[101,100],['50',100],[NaN,100]])assert.equal(helldiversLiberated(health,max),null);
});
test('Missing measurements remain unknown; partial responses keep usable planets without identity collisions',()=>{
 const parsed=parseHelldiversCampaigns([campaign(1,{statistics:{},health:null,position:{x:99,y:0},regions:[{id:0,name:'Town',health:10,maxHealth:100}]}),{}]);
 assert.equal(parsed.partial,true);assert.equal(parsed.campaigns[0].players,null);assert.equal(parsed.campaigns[0].liberated,null);assert.equal(parsed.campaigns[0].position,null);assert.equal(parsed.campaigns[0].regions[0].available,null);
 assert.deepEqual(parseHelldiversCampaigns([]),{campaigns:[],partial:false});
 for(const value of [{},[{}],[campaign(),campaign()],Array(501).fill(campaign()),[campaign(),{...campaign(2),planet:planet(1)}]])assert.throws(()=>parseHelldiversCampaigns(value));
});
test('Enemy event health is distinct from planet liberation and does not trust the elapsed war clock',()=>{
 const event={health:80,maxHealth:100,faction:'Automaton',startTime:'2026-10-02T05:00:00Z',endTime:'2026-10-03T05:00:00Z'};
 const p=parseHelldiversCampaigns([campaign(1,{currentOwner:'Humans',event})]).campaigns[0];
 assert.equal(p.owner,'Humans');assert.equal(p.faction,'Automaton');assert.equal(p.liberated,25);assert.equal(p.event?.remaining,80);assert.equal(p.event?.end,Date.parse(event.endTime));
 assert.equal(parseHelldiversCampaigns([campaign(1,{event:{...event,endTime:'1972-08-18T11:45:00Z'}})]).campaigns[0].event?.end,null);
});
test('Search and faction/sort use exact source planets, preserve missing counts and never mutate input',()=>{
 const all=parseHelldiversCampaigns([campaign(1,{name:'A',statistics:{}}),campaign(2,{name:'B',currentOwner:'Terminids',health:1}),campaign(3,{name:'C',statistics:{playerCount:100}})]).campaigns;
 assert.deepEqual(helldiversCampaigns(all,'all','','players').map(p=>p.name),['C','B','A']);
 assert.deepEqual(helldiversCampaigns(all,'Terminids','rictus','name').map(p=>p.name),['B']);assert.equal(helldiversCampaigns(all,'all','missing','name').length,0);
 assert.equal(helldiversCampaigns(all,'all','','progress')[0].name,'B');assert.deepEqual(all.map(p=>p.name),['A','B','C']);
});
test('Orders use source prose with explicit expiry; unknown task numerics are not interpreted as progress',()=>{
 const row={id:12,title:'<i=1>MAJOR ORDER</i>',briefing:'Hold the line',description:'null',expiration:'2026-10-04T12:00:00Z',tasks:[{type:999,values:[50,100]}]};
 const data=parseHelldiversOrders([row,{}]);assert.equal(data.partial,true);assert.equal(data.orders[0].title,'MAJOR ORDER');assert.equal(data.orders[0].description,'');assert.equal(data.orders[0].end,Date.parse(row.expiration));assert.equal('progress' in data.orders[0],false);
 assert.deepEqual(parseHelldiversOrders([]),{orders:[],partial:false});assert.throws(()=>parseHelldiversOrders([{}]));assert.throws(()=>parseHelldiversOrders([row,row]));
});
test('Original faction images use pinned identity mappings and unknown factions have no invented mark',()=>{
 assert.match(helldiversFactionArt('Automaton'),/4f3b5e8c9f135d90700a6d169cb1499a1b5bd081\/public\/factions\/Automatons.webp$/);assert.equal(helldiversFactionArt('unknown'),'');
});
test('Full-health Gatria shows event progress while locked regions retain their own zero',()=>{
 const [gatria,other]=parseHelldiversCampaigns([campaign(1,{currentOwner:'Humans',health:1500000,maxHealth:1500000,event:{health:825125,maxHealth:1250000},regions:[{id:0,name:'ALTONBURG',size:'Settlement',health:100000,maxHealth:100000,isAvailable:false}]}),campaign(2,{health:950})]).campaigns;
 const progress=helldiversProgress(gatria);
 assert.equal(progress.kind,'eventProgress');assert.ok(Math.abs(progress.value!-33.99)<.00001);
 assert.equal(gatria.liberated,0);assert.equal(gatria.regions[0].liberated,0);assert.equal(gatria.regions[0].available,false);
 assert.equal(helldiversRegionArt(gatria.regions[0].size),'/games/helldivers/settlement.png');assert.equal(helldiversRegionArt(null),'');
 assert.equal(helldiversCampaigns([other,gatria],'all','','progress')[0].planet,gatria.planet);
 assert.equal(helldiversProgress({...gatria,event:{remaining:null,start:null,end:null}}).value,null);
 assert.equal(helldiversProgress({...gatria,event:null}).value,100);
});
test('Regional progress is identified separately when a planet has not moved',()=>{
 const p=parseHelldiversCampaigns([campaign(1,{health:1000,regions:[{id:0,name:'CITY',size:'City',isAvailable:true,health:240,maxHealth:400}]})]).campaigns[0];
 assert.deepEqual(helldiversProgress(p),{kind:'regionProgress',region:'CITY',value:40});
 assert.equal(helldiversRegionArt(p.regions[0].size),'/games/helldivers/city.png');
 assert.equal(helldiversProgress({...p,liberated:null}).value,null);
});
test('Galaxy preserves source axes, all planets and unique real waypoint links',()=>{
 const raw=[planet(0,{position:{x:0,y:0},waypoints:[1,1,0,99,'2']}),planet(1,{position:{x:1,y:1},waypoints:[0,2]}),planet(2,{position:{x:-1,y:-1},waypoints:[]})];
 const galaxy=parseHelldiversGalaxy(raw);assert.equal(galaxy.planets.length,3);assert.equal(galaxy.partial,false);
 assert.deepEqual(helldiversMapPoint(galaxy.planets[0].position),{x:250,y:250});
 assert.deepEqual(helldiversMapPoint(galaxy.planets[1].position),{x:465,y:35});
 assert.deepEqual(helldiversMapPoint(galaxy.planets[2].position),{x:35,y:465});
 assert.deepEqual(helldiversMapLinks(galaxy.planets).map(link=>link.key),['0:1','1:2']);
 assert.throws(()=>parseHelldiversGalaxy([raw[0],raw[0]]));assert.throws(()=>parseHelldiversGalaxy([{}]));
 assert.equal(parseHelldiversGalaxy([...raw,{}]).partial,true);
});
