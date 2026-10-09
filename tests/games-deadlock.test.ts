import assert from 'node:assert/strict';
import test from 'node:test';
import { CompanionRequests } from '../src/lib/games/companion-request.ts';
import { deadlockImage, deadlockLanguage, deadlockRoster, deadlockStatsUrl, parseDeadlockHeroes, parseDeadlockStats } from '../src/lib/games/deadlock-data.ts';

const hero = (id = 1, extra = {}) => ({ id, name: `Hero ${id}`, player_selectable: true, disabled: false, in_development: false, description: { role: 'Support', playstyle: 'Help your team' }, ...extra });
const stat = (hero_id = 1, extra = {}) => ({ hero_id, bucket: 0, wins: 60, losses: 40, matches: 100, ...extra });

test('roster contains unique released playable heroes and validates publisher asset URLs', () => {
  const image = 'https://assets-bucket.deadlock-api.com/assets-api-res/images/heroes/inferno_card.webp';
  const result = parseDeadlockHeroes([hero(1, {images:{icon_hero_card_webp:image}}), hero(1), hero(2,{disabled:true}), hero(3,{player_selectable:false}), hero(4,{in_development:true}), hero(5,{name:''}), hero(6)]);
  assert.deepEqual(result.map(row=>row.id),[1,6]); assert.equal(result[0].image,image);
  for (const url of ['javascript:alert(1)','https://assets-bucket.deadlock-api.com.evil.test/a.png','https://me@assets-bucket.deadlock-api.com/assets-api-res/images/heroes/a.png','http://assets-bucket.deadlock-api.com/assets-api-res/images/heroes/a.png',image.replace('.webp','.svg')]) assert.equal(deadlockImage(url),'');
  assert.throws(()=>parseDeadlockHeroes({error:'offline'})); assert.throws(()=>parseDeadlockHeroes([]));
});

test('win rates require consistent totals, sufficient samples and one unbucketed row per hero', () => {
  const result = parseDeadlockStats([stat(1),stat(2,{wins:0,losses:100}),stat(3,{wins:101}),stat(4,{matches:99,wins:59}),stat(5,{wins:'60'}),stat(6,{bucket:2}),stat(7),stat(7)]);
  assert.deepEqual(result.map(row=>[row.id,row.winRate]),[[1,.6],[2,0]]);
  assert.deepEqual(parseDeadlockStats([]),[]); assert.throws(()=>parseDeadlockStats({message:'rate limited'}));
});

test('seven-day query is bounded, stable inside a cache window and explicitly identifies match modes', () => {
  const now=1790810900000, a=deadlockStatsUrl(now), b=deadlockStatsUrl(now+1000), url=new URL(a.url);
  assert.equal(a.url,b.url);assert.equal(a.to-a.from,604800);assert.ok(a.to<=now/1000);
  assert.equal(url.searchParams.get('bucket'),'no_bucket'); assert.equal(url.searchParams.get('game_mode'),'normal');assert.equal(url.searchParams.get('match_mode'),'ranked,unranked');
  assert.notEqual(deadlockStatsUrl(now+600000).url,a.url);
});

test('ranking joins exact hero identities, retains zero win rates and searches without mutating source', () => {
  const heroes=parseDeadlockHeroes([hero(1,{name:'Ivy'}),hero(2,{name:'Abrams'}),hero(3,{name:'Infernus'})]);
  const stats=parseDeadlockStats([stat(1,{wins:0,losses:100}),stat(2),stat(99)]);
  assert.deepEqual(deadlockRoster(heroes,stats,'','winRate').map(row=>row.id),[2,1,3]);
  assert.deepEqual(deadlockRoster(heroes,stats,'IVY','name').map(row=>row.id),[1]);
  assert.deepEqual(heroes.map(row=>row.id),[1,2,3]); assert.equal(deadlockLanguage('de'),'german');assert.equal(deadlockLanguage('../bad'),'english');
});

test('shared observations retain their timestamp, expire and never cache malformed responses', async () => {
  let now=1000,calls=0,fail=false;
  const client=new CompanionRequests(async()=>{calls++;return fail?{}:[stat()];},()=>now), signal=new AbortController().signal;
  const [a,b]=await Promise.all([client.get('test',100,parseDeadlockStats,signal),client.get('test',100,parseDeadlockStats,signal)]);
  assert.equal(calls,1);assert.equal(a.at,b.at);now+=50;assert.equal((await client.get('test',100,parseDeadlockStats,signal)).at,1000);
  now+=100;fail=true;await assert.rejects(client.get('test',100,parseDeadlockStats,signal));fail=false;
  assert.equal((await client.get('test',100,parseDeadlockStats,signal)).at,1150);assert.equal(calls,3);
});

test('cancelling one reader keeps shared work; cancelling the final reader stops network and queued work', async () => {
  let calls=0,aborts=0;
  const client=new CompanionRequests((_url,signal)=>new Promise((resolve,reject)=>{
    calls++;const timer=setTimeout(()=>resolve([stat()]),15);
    signal.addEventListener('abort',()=>{aborts++;clearTimeout(timer);reject(signal.reason);},{once:true});
  }));
  const a=new AbortController(),b=new AbortController();
  const first=client.get('same',100,parseDeadlockStats,a.signal), second=client.get('same',100,parseDeadlockStats,b.signal);
  a.abort();await assert.rejects(first);assert.equal((await second).data.length,1);assert.equal(calls,1);assert.equal(aborts,0);
  const c=new AbortController();const pending=client.get('other',100,parseDeadlockStats,c.signal);await new Promise(resolve=>setTimeout(resolve,0));c.abort();await assert.rejects(pending);assert.equal(aborts,1);
  const cancelled=new AbortController();cancelled.abort();assert.throws(()=>client.get('never',100,parseDeadlockStats,cancelled.signal));assert.equal(calls,2);
});
