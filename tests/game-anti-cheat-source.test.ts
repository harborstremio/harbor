import assert from "node:assert/strict";
import test from "node:test";
import { createGameAntiCheatLoader } from "../src/lib/games/anti-cheat-source";
import { COMMUNITY_ANTI_CHEAT_URL } from "../src/lib/games/anti-cheat-data";

const signal = () => new AbortController().signal;
const page = (id: number, body = "") => `<link rel="canonical" href="https://store.steampowered.com/app/${id}/">${body}`;
const records = [{ storeIds: { steam: "578080" }, anticheats: ["BattlEye","Zakynthos"] }, { storeIds: { steam: "123" }, anticheats: ["Easy Anti-Cheat"] }];
const json = () => Response.json(records);
const tick = () => new Promise(resolve => setTimeout(resolve,0));

test("Steam declarations take precedence without downloading the fallback directory", async () => {
  const calls: string[] = [];
  const load = createGameAntiCheatLoader(async url => {
    calls.push(url); return new Response(page(578080,'<div class="anticheat_section DRM_notice"><div class="anticheat_name">BattlEye</div></div>'));
  });
  const result = await load(578080,signal());
  assert.equal(result.sourceName,"Steam"); assert.deepEqual(result.systems,["BattlEye"]);
  await load(578080,signal()); assert.equal(calls.length,1);
});

test("missing Steam declaration, age gate and request failure all fall back", async () => {
  for (const primary of [() => new Response(page(578080)), () => new Response("Enter your age"), () => new Response("Down",{status:503}), () => { throw Error("Offline"); }]) {
    const load = createGameAntiCheatLoader(async url => url === COMMUNITY_ANTI_CHEAT_URL ? json() : primary());
    const result = await load(578080,signal());
    assert.deepEqual(result.systems,["BattlEye","Zakynthos"]); assert.equal(result.sourceName,"AreWeAntiCheatYet");
  }
});

test("one bounded directory fetch serves multiple games and refreshes after six hours", async () => {
  let now = 1000, directoryCalls = 0;
  const load = createGameAntiCheatLoader(async (url,init,timeout,maxBytes) => {
    assert.equal(init.credentials,"omit"); assert.equal(timeout,12000); assert.equal(maxBytes,2*1024*1024);
    if (url === COMMUNITY_ANTI_CHEAT_URL) { directoryCalls++; await tick(); return json(); }
    return new Response(page(Number(url.match(/\/app\/(\d+)/)?.[1])));
  }, () => now);
  const results = await Promise.all([load(578080,signal()),load(123,signal())]);
  assert.equal(directoryCalls,1); assert.deepEqual(results[1].systems,["Easy Anti-Cheat"]);
  now += 6*3600_000-1; await load(123,signal()); assert.equal(directoryCalls,1);
  now++; await load(123,signal()); assert.equal(directoryCalls,2);
});

test("fallback failures and absent records remain unknown, failures can retry", async () => {
  for (const fallback of [() => new Response("Down",{status:503}), () => new Response("not json"), () => Response.json({error:"bad"}), () => new Response("x".repeat(2*1024*1024+1)), () => new Response("[]",{headers:{"content-length":String(3*1024*1024)}})]) {
    let fail = true;
    const load = createGameAntiCheatLoader(async url => url === COMMUNITY_ANTI_CHEAT_URL ? (fail ? fallback() : json()) : new Response(page(578080)));
    assert.equal((await load(578080,signal())).status,"unknown");
    fail = false; assert.equal((await load(578080,signal())).status,"reported");
  }
  const load = createGameAntiCheatLoader(async url => url === COMMUNITY_ANTI_CHEAT_URL ? json() : new Response(page(999)));
  const missing = await load(999,signal()); assert.equal(missing.status,"unknown"); assert.equal(missing.kernel,null);
});

test("cancelling one page preserves another reader and never starts fallback for cancelled Steam work", async () => {
  let finish!: () => void, directorySignal: AbortSignal | undefined, calls = 0;
  const load = createGameAntiCheatLoader(async (url,init) => {
    if (url !== COMMUNITY_ANTI_CHEAT_URL) return new Response(page(Number(url.match(/\/app\/(\d+)/)?.[1])));
    calls++; directorySignal = init.signal!;
    await new Promise<void>(resolve => { finish = resolve; }); return json();
  });
  const a = new AbortController(), b = new AbortController();
  const first = load(578080,a.signal), cancelled = assert.rejects(first,{name:"AbortError"});
  const second = load(123,b.signal);
  while (!finish) await tick();
  a.abort(); await cancelled; assert.equal(directorySignal?.aborted,false);
  finish(); assert.deepEqual((await second).systems,["Easy Anti-Cheat"]); assert.equal(calls,1);
  const aborted = new AbortController(); aborted.abort();
  await assert.rejects(load(578080,aborted.signal),{name:"AbortError"});
  assert.equal(calls,1);
});

test("invalid IDs make no requests", async () => {
  const load = createGameAntiCheatLoader(async () => { assert.fail("Unexpected request"); });
  for (const id of [0,-1,NaN,1.5,Number.MAX_SAFE_INTEGER+1]) await assert.rejects(load(id,signal()));
});
