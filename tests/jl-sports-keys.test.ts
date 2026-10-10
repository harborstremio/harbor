// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  countSportsKeys,
  hasAnySportsKey,
  interpretKeyTest,
  keyTestRequest,
  SPORTS_KEYS,
  testSportsKey,
} from "../src/lib/jl/sports/sports-keys.ts";

const headers = (h: Record<string, string>) => ({ get: (k: string) => h[k.toLowerCase()] ?? null });

test("every sports key has a signup link and a setting field", () => {
  assert.equal(SPORTS_KEYS.length, 4);
  for (const def of SPORTS_KEYS) {
    assert.match(def.signupUrl, /^https:\/\//);
    assert.ok(def.unlocks.length > 10);
  }
});

test("hint shows only until a key is saved", () => {
  assert.equal(hasAnySportsKey({ allsportsKey: "", thesportsdbKey: "  " }), false);
  assert.equal(hasAnySportsKey({ oddsApiKey: "abc" }), true);
  assert.equal(countSportsKeys({ oddsApiKey: "a", cfbdKey: "b", allsportsKey: "" }), 2);
});

test("test requests carry the typed key in the right place", () => {
  assert.equal(keyTestRequest("odds", "  "), null);
  const odds = keyTestRequest("odds", "k y");
  assert.ok(odds?.url.includes("apiKey=k%20y"));
  assert.equal(keyTestRequest("cfbd", "zz")?.headers.Authorization, "Bearer zz");
  assert.equal(keyTestRequest("allsports", "zz")?.headers["x-api-market-key"], "zz");
  assert.ok(keyTestRequest("thesportsdb", "abc123")?.url.includes("/abc123/"));
  // A path-unsafe TheSportsDB key never reaches the URL.
  assert.equal(keyTestRequest("thesportsdb", "../x"), null);
});

test("responses become plain-language verdicts", () => {
  assert.equal(interpretKeyTest("odds", 401, null).ok, false);
  assert.match(interpretKeyTest("odds", 401, null).message, /didn't accept/);
  assert.match(interpretKeyTest("cfbd", 429, null).message, /limit/);
  assert.match(interpretKeyTest("cfbd", 0, null).message, /reach/);
  const ok = interpretKeyTest("odds", 200, [], headers({ "x-requests-remaining": "480" }));
  assert.deepEqual(ok, { ok: true, message: "Key works. 480 requests left this month." });
  assert.equal(interpretKeyTest("thesportsdb", 200, { sports: [] }).ok, true);
  assert.equal(interpretKeyTest("thesportsdb", 200, { sports: null }).ok, false);
  assert.equal(interpretKeyTest("allsports", 204, null).ok, true);
  assert.equal(interpretKeyTest("cfbd", 200, [{}]).ok, true);
});

test("testSportsKey runs one request and survives network errors", async () => {
  let calls = 0;
  const r = await testSportsKey("cfbd", "key", async () => {
    calls++;
    return { status: 200, headers: headers({}), text: async () => "[]" };
  });
  assert.equal(calls, 1);
  assert.equal(r.ok, true);
  const down = await testSportsKey("cfbd", "key", async () => {
    throw new Error("offline");
  });
  assert.equal(down.ok, false);
  assert.equal((await testSportsKey("cfbd", "", async () => assert.fail("no request"))).ok, false);
});
