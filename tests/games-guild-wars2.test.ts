import assert from 'node:assert/strict';
import test from 'node:test';
import { gw2Budget, gw2Image, gw2Language, gw2Selected, gw2Total, joinGw2Rewards, parseGw2Items, parseGw2Listings, parseGw2Season, readGw2Plan } from '../src/lib/games/guild-wars2-data.ts';

const rawSeason = { title: 'Current season', start: '2026-09-01T00:00:00Z', end: '2026-12-01T00:00:00Z', listings: [2, 1] };
const season = parseGw2Season(rawSeason);
const rawOffers = [{ id: 1, item_id: 10, item_count: 5, type: 'Normal', cost: 8 }, { id: 2, item_id: 10, item_count: 1, type: 'Legacy', cost: 30 }, { id: 3, item_id: 30, item_count: 1, type: 'Featured', cost: 100 }];
const offers = parseGw2Listings(rawOffers);
const item = { id: 10, name: 'Item name', chat_link: '[&AgEVIQAA]', icon: 'https://render.guildwars2.com/file/CD9AE149AEB121C53522C814B7C809CA0BC3A5A6/849451.png' };
const rewards = joinGw2Rewards(season, offers, parseGw2Items([item]));
test('Season dates and exact listing membership are required, bounded and preserved', () => {
  assert.deepEqual(season.listings, [2,1]);
  assert.deepEqual(parseGw2Season({...rawSeason,listings:[]}).listings,[]);
  for(const bad of [{end:'bad'},{end:rawSeason.start},{listings:[1,'2']},{listings:Array(1001).fill(1)},{title:''}]) assert.throws(()=>parseGw2Season({...rawSeason,...bad}));
});
test('Current offers retain provider order and distinct prices for the same item', () => {
  assert.deepEqual(rewards.map(x=>[x.id,x.itemId,x.cost]),[[2,10,30],[1,10,8]]);
  assert.equal(gw2Total(rewards),38); //Cost belongs to the bundle, not count*cost.
  assert.equal(rewards[1].count,5);
});
test('Incomplete or ambiguous offer records cannot produce a misleading plan', () => {
  assert.throws(()=>joinGw2Rewards(season,offers.slice(0,1),[]));
  assert.throws(()=>parseGw2Listings([rawOffers[0],rawOffers[0]]));
  for(const bad of [{cost:-1},{item_count:0},{type:'Unknown'},{id:0},{cost:NaN},{item_id:1.5}]) assert.throws(()=>parseGw2Listings([{...rawOffers[0],...bad}]));
});
test('Missing item metadata preserves known offer costs without inventing names or images', () => {
  const partial=joinGw2Rewards(season,offers,[]);
  assert.equal(partial.length,2);assert.equal(partial[0].item,null);assert.equal(gw2Total(partial),38);
});
test('Provider description is text-only and media accepts only the publisher renderer', () => {
  const parsed=parseGw2Items([{...item,description:'<script>alert(1)</script><c=@x>Reward</c><br>Five &amp; six',icon:'https://evil.test/a.png',chat_link:'javascript:alert(1)'}])[0];
  assert.equal(parsed.description,'Reward\nFive & six');assert.equal(parsed.icon,'');assert.equal(parsed.chatLink,'');
  assert.equal(gw2Image(item.icon),item.icon);
  for(const url of ['http://render.guildwars2.com/file/a.png',item.icon+'?redirect=1',item.icon.replace('render.guildwars2.com','render.guildwars2.com.evil.test')]) assert.equal(gw2Image(url),'');
  assert.ok(parseGw2Items([{...item,description:'x'.repeat(20000)}])[0].description.length<=4000);
});
test('Item identities and malformed records cannot substitute other requested rewards', () => {
  assert.deepEqual(parseGw2Items([null,{id:10,name:''},{id:'10',name:'Wrong'}]),[]);
  assert.throws(()=>parseGw2Items({error:'disabled'}));
  assert.equal(joinGw2Rewards(season,offers,parseGw2Items([{...item,id:30}]))[0].item,null);
});
test('Local plans require matching season and item identity when listing IDs are reused', () => {
  const raw=JSON.stringify({version:1,season:season.key,budget:100,selected:[{id:1,itemId:10},{id:2,itemId:999},{id:1,itemId:10}]});
  const plan=readGw2Plan(raw,season);assert.equal(plan.budget,100);assert.equal(plan.selected.length,2);
  assert.deepEqual(gw2Selected(plan,rewards).map(x=>x.id),[1]);assert.equal(gw2Total(gw2Selected(plan,rewards)),8);
  assert.deepEqual(readGw2Plan(raw,{...season,key:'new-season'}),{selected:[],budget:null});
  assert.deepEqual(readGw2Plan('{broken',season),{selected:[],budget:null});
});
test('A zero planning budget differs from an unset or invalid value', () => {
  assert.equal(gw2Budget('0'),0);assert.equal(gw2Budget('1000000'),1000000);
  for(const value of ['','-1','1.5','1e4','NaN','1000001',' 15 ']) assert.equal(gw2Budget(value),null);
  assert.equal(readGw2Plan(JSON.stringify({version:1,season:season.key,budget:0,selected:[]}),season).budget,0);
});
test('Localized items use verified provider languages with English fallback',()=>{
  assert.equal(gw2Language('de-DE'),'de');assert.equal(gw2Language('fr'),'fr');assert.equal(gw2Language('es-MX'),'es');
  assert.equal(gw2Language('ar'),'en');assert.equal(gw2Language('zh'),'en');
});
