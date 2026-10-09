import assert from 'node:assert/strict';
import test from 'node:test';
import { GameRequestPool } from '../src/lib/games/request-pool.ts';
import { catalogParameters, DEFAULT_CATALOG_FILTERS, GAME_TAGS, genreCatalogTag } from '../src/lib/games/catalog-filters.ts';
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>resolve=done);return {promise,resolve};};

test('MMO play style and MMORPG genre combine with the collection genre and platform',()=>{
 const mmorpg=GAME_TAGS.find(tag=>tag.key==='mmorpg'); assert.equal(mmorpg?.id,1754);
 const params=catalogParameters('',{...DEFAULT_CATALOG_FILTERS,tags:[19,mmorpg!.id],mode:'20',platform:'win'},30);
 assert.equal(params.get('category3'),'20');assert.equal(params.get('tags'),'19,1754');assert.equal(params.get('os'),'win');assert.equal(params.get('start'),'30');
});

test('superseded queued catalog work never starts, and a failed request frees the next slot', async()=>{
 const pool=new GameRequestPool(1);const hold=deferred();const abort=new AbortController();const order:string[]=[];
 const first=pool.run(async()=>{order.push('first');await hold.promise;throw new Error('offline');}).catch(error=>error.message);
 const cancelled=pool.run(async()=>{order.push('cancelled');return 1;},abort.signal).catch(error=>error.name);
 const third=pool.run(async()=>{order.push('third');return 3;});
 abort.abort();hold.resolve();
 assert.equal(await first,'offline');assert.equal(await cancelled,'AbortError');assert.equal(await third,3);
 assert.deepEqual(order,['first','third']);
});

test('the shared catalog pool never exceeds its network concurrency limit',async()=>{
 const pool=new GameRequestPool(3);let active=0;let peak=0;
 await Promise.all(Array.from({length:12},()=>pool.run(async()=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,2));active--;})));
 assert.equal(peak,3);assert.equal(active,0);
});

test('typing jumps ahead of queued artwork while retaining FIFO and removing abandoned queries',async()=>{
 const pool=new GameRequestPool(1),hold=deferred(),cancel=new AbortController(),order:string[]=[];
 const first=pool.run(async()=>{order.push('active');await hold.promise});
 const background=pool.run(async()=>{order.push('artwork')});
 const stale=pool.run(async()=>{order.push('stale query')},cancel.signal,true).catch(error=>error.name);
 const search=pool.run(async()=>{order.push('autocomplete')},undefined,true);
 const metadata=pool.run(async()=>{order.push('matched metadata')},undefined,true);
 cancel.abort();hold.resolve();await Promise.all([first,background,search,metadata]);assert.equal(await stale,'AbortError');
 assert.deepEqual(order,['active','autocomplete','matched metadata','artwork']);
});

test('catalog filters combine verified source IDs and encode studio names without query injection',()=>{
 const query=catalogParameters('  x&start=900  ',{...DEFAULT_CATALOG_FILTERS,tags:[1695,19,1695,-1],platform:'linux',mode:'39',price:'free',controller:true,developer:'A&B; Games'},30);
 assert.equal(query.get('term'),'x&start=900');assert.equal(query.get('start'),'30');assert.equal(query.get('tags'),'19,1695');
 assert.equal(query.get('developer'),'A&B; Games');assert.equal(query.get('category1'),'998');assert.equal(query.get('controllersupport'),'28');assert.equal(query.get('category3'),'39');assert.equal(query.get('os'),'linux');assert.equal(query.get('maxprice'),'free');
 assert.equal(catalogParameters('',DEFAULT_CATALOG_FILTERS,-30).get('start'),'0');
});

test('feature catalogs preserve exact Steam category IDs alongside genre and play-mode filters',()=>{
 const query=catalogParameters('',{...DEFAULT_CATALOG_FILTERS,mode:'1',features:[{id:36,name:'Online PvP'},{id:22,name:'Steam Achievements'},{id:36,name:'Duplicate'},{id:-1,name:'Invalid'}]},0);
 assert.equal(query.get('category2'),'22,36'); assert.equal(query.get('category3'),'1');
 assert.equal(query.get('term'),'');
});


test('hero Steam genres resolve to their actual tags, including MMO and case variants',()=>{
 for(const [label,id] of [['Action',19],['Adventure',21],['Casual',597],['Massively Multiplayer',128],['MMORPG',1754],['Early Access',493],['Free To Play',113],['free to play',113],['  INDIE  ',492],['Racing',699],['Sports',701]] as const) assert.equal(genreCatalogTag(label),id);
 assert.equal(genreCatalogTag('Unknown genre'),undefined);
 const params=catalogParameters('',{...DEFAULT_CATALOG_FILTERS,tags:[genreCatalogTag('Massively Multiplayer')!]});
 assert.equal(params.get('tags'),'128');assert.equal(params.has('category3'),false);
});
