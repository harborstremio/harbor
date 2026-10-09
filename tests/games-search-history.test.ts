import assert from "node:assert/strict";
import test from "node:test";
import { readGameSearchHistory, rememberGameSearch, saveGameSearchHistory } from "../src/lib/games/search-history.ts";

test("recent game searches deduplicate, remember search mode and cap stored input", () => {
  let items = rememberGameSearch([], { query: " Hades ", ai: false });
  items = rememberGameSearch(items, { query: "HADES", ai: true });
  assert.deepEqual(items, [{ query: "HADES", ai: true }]);
  assert.equal(rememberGameSearch(items, { query: "a", ai: false }), items);
  for (let n=0;n<20;n++) items = rememberGameSearch(items, { query: `Game ${n}`, ai: false });
  assert.equal(items.length, 8); assert.equal(items[0].query, "Game 19");
  assert.equal(rememberGameSearch(items, { query: "x".repeat(1000), ai: true })[0].query.length, 500);
});

test("recent search persistence is profile scoped and tolerates unavailable or malformed storage", () => {
  const values = new Map<string,string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key:string) => values.get(key) ?? null, setItem: (key:string,value:string) => values.set(key,value) } });
  saveGameSearchHistory("one", [{ query: "Hades", ai: false }]);
  assert.equal(readGameSearchHistory("one").length, 1); assert.deepEqual(readGameSearchHistory("two"), []);
  values.set("harbor.games.search-history.v1:two", "not json"); assert.deepEqual(readGameSearchHistory("two"), []);
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get: () => { throw Error("denied"); } });
  assert.deepEqual(readGameSearchHistory("one"), []); assert.doesNotThrow(() => saveGameSearchHistory("one", []));
  Reflect.deleteProperty(globalThis, "localStorage");
});
