import test from "node:test";
import assert from "node:assert/strict";
import {
  readSportsApiKey,
  saveSportsApiKey,
  subscribeSportsApiCredentials,
} from "../src/lib/sports/api-credentials";
import { readHubSourceSlice, saveHubSourceSlice } from "../src/lib/sports/api-hub-cache";

test("credential changes clear memory results and account slices never enter persistent cache", () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
  let changes = 0;
  const unsubscribe = subscribeSportsApiCredentials(() => changes++);
  try {
    saveSportsApiKey(" fixture-account-a ");
    assert.equal(readSportsApiKey(), "fixture-account-a");
    const key = "UAE@20260914@day";
    saveHubSourceSlice(key, { at: Date.now(), games: [] });
    assert.ok(readHubSourceSlice(key));
    assert.equal([...storage.keys()].filter((key) => key.includes("board")).length, 0);
    saveSportsApiKey("fixture-account-b");
    assert.equal(readHubSourceSlice(key), undefined);
    saveHubSourceSlice(key, { at: Date.now(), games: [] });
    saveSportsApiKey("");
    assert.equal(readHubSourceSlice(key), undefined);
    assert.equal(readSportsApiKey(), "");
    assert.equal(changes, 3);
  } finally {
    unsubscribe();
    Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("a failed browser storage write reports failure instead of confirming a saved key", () => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => "previous-fixture",
      setItem: () => {
        throw Error("storage full");
      },
      removeItem: () => {
        throw Error("storage full");
      },
    },
  });
  try {
    assert.throws(() => saveSportsApiKey("replacement-fixture"));
    assert.equal(readSportsApiKey(), "previous-fixture");
  } finally {
    Reflect.deleteProperty(globalThis, "localStorage");
  }
});
