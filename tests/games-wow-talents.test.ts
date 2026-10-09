import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWowTalents, wowTalentPositions, wowSpellUrl } from '../src/lib/games/wow-talents.ts';
import { parseWowCharacter, wowCharacterUrl } from '../src/lib/games/wow-character-data.ts';

const spell=(id:number)=>({id,name:`Spell ${id}`,icon:'spell_test'});
const selected=(id:number,x=3000,y=1200)=>({node:{id,treeId:750,type:2,posX:x,posY:y,entries:[{spell:spell(id),maxRanks:1},{spell:spell(id+100),maxRanks:1}]},entryIndex:1,rank:1});
const raw=()=>({loadout_spec_id:250,loadout_text:'A'.repeat(80),class_talents:[selected(1)],spec_talents:[selected(2,5000)],hero_talents:[selected(3,7000)],active_hero_tree:{id:31,traitTreeId:750,name:"San'layn",slug:'sanlayn',description:'Blood and shadow',iconUrl:'https://cdn.raiderio.net/images/site/hero_specs/herospec_sanlayn.png'}});

test('Categorized loadouts preserve selected choices, hero artwork and source import code',()=>{
 const result=parseWowTalents(raw())!;assert.equal(result.groups.class[0].id,101);assert.equal(result.groups.class[0].alternatives[0].id,1);assert.equal(result.hero?.name,"San'layn");assert.equal(result.code,'A'.repeat(80));assert.equal(result.partial,false);
 assert.match(result.groups.class[0].image,/cdn\.raiderio\.net\/images\/wow\/icons\/large\/spell_test\.jpg$/);
});
test('Apex aggregate ranks are preserved without treating sequential entries as unselected choices',()=>{
 const value=raw();value.spec_talents[0].node.type=1;value.spec_talents[0].rank=4;
 const result=parseWowTalents(value)!.groups.spec[0];assert.equal(result.rank,4);assert.equal(result.choice,false);assert.deepEqual(result.alternatives,[]);
});
test('Unknown, malformed, duplicate and mixed-tree loadouts cannot appear as complete or correctly identified',()=>{
 assert.equal(parseWowTalents({}),null);assert.equal(parseWowTalents({...raw(),loadout_spec_id:'250'}),null);
 const partial=raw();partial.class_talents[0].entryIndex=3;assert.equal(parseWowTalents(partial)!.partial,true);assert.equal(parseWowTalents(partial)!.groups.class.length,0);
 const duplicate=raw();duplicate.spec_talents.push(selected(1));const d=parseWowTalents(duplicate)!;assert.equal(d.groups.class.length,0);assert.equal(d.groups.spec.length,1);assert.equal(d.partial,true);
 const mixed=raw();mixed.hero_talents[0].node.treeId=751;assert.equal(parseWowTalents(mixed),null);
 assert.equal(parseWowTalents({...raw(),class_talents:Array(101).fill(selected(1))})!.partial,true);
});
test('Unsafe artwork and malformed import codes stay unavailable without losing valid talent names',()=>{
 const value=raw();value.loadout_text='https://bad.test';value.active_hero_tree.iconUrl='https://bad.test/sanlayn.png';value.class_talents[0].node.entries[1].spell.icon='../../other';
 const result=parseWowTalents(value)!;assert.equal(result.code,null);assert.equal(result.hero?.image,'');assert.equal(result.groups.class[0].image,'');assert.equal(result.groups.class[0].name,'Spell 101');
 assert.throws(()=>wowSpellUrl(-1));assert.throws(()=>wowSpellUrl(NaN));assert.equal(wowSpellUrl(48792),'https://www.wowhead.com/spell=48792');
});
test('Tree positions preserve provider geometry and reading order; conflicting or missing positions fall back',()=>{
 const value=raw();value.class_talents=[selected(1,3600,1800),selected(4,3000,1200),selected(5,4200,1200)];
 const nodes=parseWowTalents(value)!.groups.class,layout=wowTalentPositions(nodes)!;assert.deepEqual(layout.points.map(item=>item.node.nodeId),[4,5,1]);assert.deepEqual(layout.points.map(item=>[item.x,item.y]),[[0,0],[1,0],[.5,58]]);assert.equal(nodes[0].nodeId,1);
 assert.equal(wowTalentPositions([nodes[0],{...nodes[0],nodeId:99}]),null);assert.equal(wowTalentPositions([{...nodes[0],x:null}]),null);assert.equal(wowTalentPositions([nodes[0],{...nodes[1],x:49_999}]),null);
});
test('Character parsing attaches talents independently of season scores and retains strict profile identity',()=>{
 const target={region:'eu' as const,realm:'silvermoon',name:'Test'};
 const profile={name:'Test',region:'eu',realm:'Silvermoon',profile_url:'https://raider.io/characters/eu/silvermoon/Test',talentLoadout:raw()};
 assert.equal(parseWowCharacter(profile,target).talents?.groups.class.length,1);assert.equal(parseWowCharacter({...profile,talentLoadout:null},target).talents,null);
 assert.ok(new URL(wowCharacterUrl(target)).searchParams.get('fields')?.includes('talents:categorized'));assert.throws(()=>parseWowCharacter({...profile,name:'Other'},target));
});
