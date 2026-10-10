import test from "node:test";
import assert from "node:assert/strict";
import {
  createSportsConsentStore,
  SPORTS_CONSENT_KEY,
  SPORTS_CONSENT_VERSION,
} from "../src/lib/sports/consent.ts";

const instant = "2026-09-14T12:00:00.000Z";
function memory(initial?: string) {
  const data = new Map(initial ? [[SPORTS_CONSENT_KEY, initial]] : []);
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

test("sports consent starts unknown, publishes decline immediately and re-enables without acceptance", () => {
  const storage = memory();
  const store = createSportsConsentStore({
    storage: () => storage,
    now: () => new Date(instant),
  });
  const seen: string[] = [];
  const initial = store.getSnapshot();
  assert.equal(initial.status, "unknown");
  assert.equal(store.getSnapshot(), initial);
  const unsubscribe = store.subscribe(() => seen.push(store.getSnapshot().status));
  store.accept();
  assert.equal(store.getSnapshot().acceptedAt, instant);
  store.decline();
  assert.deepEqual(seen, ["accepted", "declined"]);
  assert.equal(store.getSnapshot().acceptedAt, undefined);
  assert.equal(store.getSnapshot().declinedAt, instant);
  store.reset();
  assert.equal(store.getSnapshot().status, "unknown");
  assert.equal(store.getSnapshot().declinedAt, undefined);
  assert.equal(
    createSportsConsentStore({ storage: () => storage }).getSnapshot().status,
    "unknown",
  );
  unsubscribe();
  store.accept();
  assert.deepEqual(seen, ["accepted", "declined", "unknown"]);
});

test("receipts only persist version, status and corresponding date, with stable restored snapshots", () => {
  const storage = memory();
  const store = createSportsConsentStore({
    storage: () => storage,
    now: () => new Date(instant),
  });
  store.accept();
  assert.deepEqual(JSON.parse(storage.getItem(SPORTS_CONSENT_KEY)!), {
    version: SPORTS_CONSENT_VERSION,
    status: "accepted",
    acceptedAt: instant,
  });
  const restored = createSportsConsentStore({ storage: () => storage });
  const first = restored.getSnapshot();
  assert.equal(first.status, "accepted");
  assert.equal(first.persisted, true);
  restored.receiveStorage(storage.getItem(SPORTS_CONSENT_KEY));
  assert.equal(first, restored.getSnapshot());
  assert.ok(Object.isFrozen(first));
});

test("invalid and older receipts ask again, and clearing storage reactively revokes acceptance", () => {
  for (const raw of [
    "broken",
    "null",
    "[]",
    JSON.stringify({ version: 0, status: "accepted", acceptedAt: instant }),
    JSON.stringify({ version: 1, status: "accepted" }),
    JSON.stringify({ version: 1, status: "accepted", acceptedAt: "no" }),
  ]) {
    assert.equal(
      createSportsConsentStore({ storage: () => memory(raw) }).getSnapshot().status,
      "unknown",
    );
  }
  const store = createSportsConsentStore({ storage: () => memory() });
  store.accept();
  let changes = 0;
  store.subscribe(() => {
    changes++;
  });
  store.receiveStorage(null);
  assert.equal(store.getSnapshot().status, "unknown");
  assert.equal(changes, 1);
});

test("quota failures keep session usable and remove a stale saved acceptance where possible", () => {
  const storage = memory(JSON.stringify({ version: 1, status: "accepted", acceptedAt: instant }));
  storage.setItem = () => {
    throw new Error("quota");
  };
  const store = createSportsConsentStore({ storage: () => storage });
  store.decline();
  assert.equal(store.getSnapshot().status, "declined");
  assert.equal(store.getSnapshot().persisted, false);
  assert.equal(storage.getItem(SPORTS_CONSENT_KEY), null);
  store.reset();
  store.accept();
  assert.equal(store.getSnapshot().status, "accepted");
  assert.equal(store.getSnapshot().persisted, false);
  const blocked = createSportsConsentStore({
    storage: () => {
      throw new Error("disabled");
    },
  });
  assert.doesNotThrow(() => {
    blocked.decline();
    blocked.reset();
    blocked.accept();
  });
});
