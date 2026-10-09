import test from 'node:test';import assert from 'node:assert/strict';
import {groupPokemonMaps,pokemonMapLocation,pokemonMapKind} from '../src/lib/games/pokemon-map-index.ts';
const map=(title:string)=>({title,url:title,image:'',width:10,height:10});
test('archive floors group together without losing variant titles or URLs',()=>{
 const groups=groupPokemonMaps(['Mt Moon 1F FRLG','Mt Moon B1F FRLG','Mt Moon B2F RBY','Route 10 FRLG','Route 2 FRLG'].map(map),'','all');
 assert.deepEqual(groups.map(g=>g.name),['Mt Moon','Route 2','Route 10']);assert.equal(groups[0].maps.length,3);assert.equal(groups[0].maps[0].url,groups[0].maps[0].title);
 assert.equal(pokemonMapLocation('Unknown Place'),'Unknown Place');
});
test('search, location types, empty results and natural route ordering',()=>{
 const maps=['Cerulean City FRLG','Cerulean City Gym FRLG','Berry Forest','Route 2 FRLG','Route 10 FRLG'].map(map);
 assert.equal(pokemonMapKind('Cerulean City Gym'),'buildings');assert.equal(pokemonMapKind('Berry Forest'),'dungeons');
 assert.equal(groupPokemonMaps(maps,'cerulean','towns').length,1);assert.equal(groupPokemonMaps(maps,'missing','all').length,0);
 assert.deepEqual(groupPokemonMaps(maps,'','routes').map(g=>g.name),['Route 2','Route 10']);
});
