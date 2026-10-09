import assert from 'node:assert/strict';
import test from 'node:test';
import { filterOverwatchHeroes, isOverwatch, overwatchHeroUrl, overwatchLocale, overwatchMedia, parseOverwatchHero, parseOverwatchHeroes, parseOverwatchMaps, parseOverwatchModes } from '../src/lib/games/overwatch-data.ts';

const portrait='https://d15f34w2p8l1cc.cloudfront.net/overwatch/985b06beae46b7ba3ca87d1512d0fc62ca7f206ceca58ef16fc44d43a1cc84ed.png';
const hero=(extra={})=>({key:'ana',name:'Ana',role:'support',portrait,gamemodes:['quickplay','stadium'],...extra});
const ability=(extra={})=>({name:'Sleep Dart',description:'Fires a dart that puts an enemy to sleep.',icon:portrait,...extra});
const detail=(extra={})=>({name:'Ana',role:'support',description:'A founding member of Overwatch.',backgrounds:[{sizes:['md','lg'],url:'https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/blt97ec60cf959e81f3/631a8babe337fa0dc7263beb/1600_Ana.jpg'}],abilities:[ability()],perks:{minor:[ability({name:'Groggy'})],major:[]},stadium_powers:null,...extra});

test('Overwatch companion preserves exact live Steam/native identity and excludes original editions and PTR',()=>{
 assert.equal(isOverwatch({id:'steam:2357570',steamId:2357570}),true);
 assert.equal(isOverwatch({id:'battlenet:prometheus'}),true);
 for(const item of [{id:'battlenet:pro'},{id:'battlenet:prometheus_test'},{id:'igdb:9509',steamId:2357570},{id:'steam:1',steamId:2357570},{id:'custom:Overwatch',steamId:2357570},{id:'battlenet:wow',steamId:2357570}])assert.equal(isOverwatch(item),false,item.id);
});
test('Roster validates roles and identities, keeps missing portraits useful and reports partial provider output',()=>{
 const result=parseOverwatchHeroes([hero(),hero(),hero({key:'mercy',name:'Mercy',portrait:null}),hero({key:'bad/../hero'}),hero({key:'new',role:'unknown'})]);
 assert.deepEqual(result.items.map(item=>item.key),['ana','mercy']);assert.equal(result.items[1]?.portrait,'');assert.equal(result.partial,true);
 assert.throws(()=>parseOverwatchHeroes({error:'unavailable'}));assert.throws(()=>parseOverwatchHeroes([]));assert.throws(()=>parseOverwatchHeroes(Array(251).fill(hero())));
 const data=parseOverwatchHeroes([hero(),hero({key:'dva',name:'D.Va',role:'tank'}),hero({key:'bastion',name:'Bastion',role:'damage',gamemodes:['quickplay']})]).items;
 assert.deepEqual(filterOverwatchHeroes(data,' Ａｎａ ','all',true).map(item=>item.key),['ana']);assert.deepEqual(filterOverwatchHeroes(data,'','damage',true),[]);
 assert.equal(filterOverwatchHeroes(data,'','tank',false)[0]?.name,'D.Va');
});
test('Selected hero requires matching localized identity; unknown optional data never creates powers or demos',()=>{
 const expected=parseOverwatchHeroes([hero()]).items[0]!;
 const parsed=parseOverwatchHero(detail(),expected);assert.equal(parsed.abilities[0]?.name,'Sleep Dart');assert.equal(parsed.stadium.length,0);assert.ok(parsed.background.endsWith('1600_Ana.jpg'));
 assert.throws(()=>parseOverwatchHero(detail({name:'Mercy'}),expected));assert.throws(()=>parseOverwatchHero(detail({role:'tank'}),expected));assert.throws(()=>parseOverwatchHero(detail({abilities:[]}),expected));
 const partial=parseOverwatchHero(detail({abilities:[ability(),{name:'No description'}],stadium_powers:[{name:'Bad'}],backgrounds:[{sizes:['md'],url:'https://evil.test/picture.jpg'}]}),expected);
 assert.equal(partial.partial,true);assert.equal(partial.abilities.length,1);assert.equal(partial.stadium.length,0);assert.equal(partial.background,'');
});
test('Only observed publisher/CDN media can become images or playable video',()=>{
 const movie='https://blz-contentstack-assets.akamaized.net/v3/assets/a/b/ana.mp4';
 assert.equal(overwatchMedia(movie,true),movie);assert.equal(overwatchMedia(movie),'');assert.equal(overwatchMedia(portrait),portrait);
 for(const url of ['https://evil.test/video.mp4','http://blz-contentstack-assets.akamaized.net/v3/assets/a.mp4','https://user@blz-contentstack-assets.akamaized.net/v3/assets/a.mp4','https://blz-contentstack-assets.akamaized.net.evil.test/v3/assets/a.mp4','https://blz-contentstack-assets.akamaized.net/v3/assets/a.svg','data:video/mp4,x'])assert.equal(overwatchMedia(url,true),'',url);
 for(const url of ['javascript:alert(1)','https://overfast-api.tekrop.fr/players/ana.png','https://overfast-api.tekrop.fr/static/maps/../../file.svg','https://d15f34w2p8l1cc.cloudfront.net/other/a.png'])assert.equal(overwatchMedia(url),'',url);
 const parsed=parseOverwatchHero(detail({abilities:[ability({video:{thumbnail:portrait,link:{mp4:movie}}}),ability({name:'Blocked',video:{link:{mp4:'https://evil.test/a.mp4'}}})]}),parseOverwatchHeroes([hero()]).items[0]!);
 assert.equal(parsed.abilities[0]?.video,movie);assert.equal(parsed.abilities[1]?.video,'');
});
test('Map modes remain provider associations including legacy modes; localization and source routes are bounded',()=>{
 const maps=parseOverwatchMaps([{key:'hanamura',name:'Hanamura',gamemodes:['assault','assault'],screenshot:'https://overfast-api.tekrop.fr/static/maps/hanamura.jpg',location:'Japan'},{key:'invalid',name:'Invalid',gamemodes:[]}]);
 assert.equal(maps.partial,true);assert.deepEqual(maps.items[0]?.modes,['assault']);
 assert.equal(parseOverwatchModes([{key:'assault',name:'Assault',description:'Legacy mode',icon:'https://overfast-api.tekrop.fr/static/gamemodes/assault-icon.svg'}]).items[0]?.name,'Assault');
 assert.equal(overwatchLocale('de'),'de-de');assert.equal(overwatchLocale('ar'),'en-us');assert.equal(overwatchHeroUrl('../admin','en'),'');assert.equal(overwatchHeroUrl('ana','de'),'https://overwatch.blizzard.com/de-de/heroes/ana/');
});
