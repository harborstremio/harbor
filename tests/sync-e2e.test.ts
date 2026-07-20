// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { fetch as workerFetch } from "../harbor-sync/src/worker.ts";
import { MemStore } from "../harbor-sync/src/store.ts";
import {
  KDF_ITERATIONS,
  decryptDoc,
  deriveKeys,
  encryptDoc,
  generateDataKey,
  generateKdfSalt,
  unwrapDataKey,
  wrapDataKey,
} from "../src/lib/sync/crypto.ts";
import { SyncApi, SyncApiError } from "../src/lib/sync/api.ts";
import { mergeDoc } from "../src/lib/sync/merge.ts";

const BASE = "https://sync.e2e.test";
const EMAIL = "user@example.com";
const PASSWORD = "correct horse battery staple";
const SETTINGS_KEY = "harbor.settings";
const CW_KEY = "harbor.localcw.v1.profile-b";

function installWorkerFetch(): void {
  const env = { DB: new MemStore(), AUTH_PEPPER: "e2e-pepper" };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
    workerFetch(new Request(input, init), env)) as typeof fetch;
}

type CwMap = Record<string, { id: string; t: number; positionMs: number }>;

test("two devices register, sync, and merge continue watching end to end", async () => {
  installWorkerFetch();

  // Device A: create the account with real client-side key derivation.
  const kdfSalt = generateKdfSalt();
  const keysA = await deriveKeys(PASSWORD, kdfSalt, KDF_ITERATIONS);
  const { dataKeyB64 } = await generateDataKey();
  const wrappedDataKey = await wrapDataKey(keysA.wrapKey, dataKeyB64);
  const registered = await new SyncApi(BASE).register({
    email: EMAIL,
    authHash: keysA.authHash,
    kdfIterations: KDF_ITERATIONS,
    kdfSalt,
    wrappedDataKey,
    deviceName: "device-a",
  });
  const apiA = new SyncApi(BASE, registered.token);

  const settingsPlain = JSON.stringify({ uiLanguage: "en", tmdbApiKey: "secret-key-漢字" });
  const cwA: CwMap = {
    tt0001: { id: "tt0001", t: 100, positionMs: 1000 },
    tt0002: { id: "tt0002", t: 200, positionMs: 2000 },
  };
  const firstPush = await apiA.putDocs([
    {
      key: SETTINGS_KEY,
      ciphertext: await encryptDoc(dataKeyB64, SETTINGS_KEY, settingsPlain),
      baseRev: 0,
      updatedAt: Date.now(),
    },
    {
      key: CW_KEY,
      ciphertext: await encryptDoc(dataKeyB64, CW_KEY, JSON.stringify(cwA)),
      baseRev: 0,
      updatedAt: Date.now(),
    },
  ]);
  assert.deepEqual(
    firstPush.results.map((r) => r.status),
    ["ok", "ok"],
  );
  const cwRev = firstPush.results.find((r) => r.key === CW_KEY);
  assert.equal(cwRev?.status, "ok");

  // Device B: prelogin -> derive -> login -> unwrap the same data key -> pull.
  const pre = await new SyncApi(BASE).prelogin(EMAIL);
  assert.equal(pre.kdfSalt, kdfSalt);
  const keysB = await deriveKeys(PASSWORD, pre.kdfSalt, pre.kdfIterations);
  const login = await new SyncApi(BASE).login({
    email: EMAIL,
    authHash: keysB.authHash,
    deviceName: "device-b",
  });
  const dataKeyB = await unwrapDataKey(keysB.wrapKey, login.wrappedDataKey);
  assert.equal(dataKeyB, dataKeyB64);
  const apiB = new SyncApi(BASE, login.token);

  const pulled = await apiB.getDocs(0);
  assert.equal(pulled.docs.length, 2);
  const settingsDoc = pulled.docs.find((d) => d.key === SETTINGS_KEY);
  assert.equal(await decryptDoc(dataKeyB, SETTINGS_KEY, settingsDoc!.ciphertext!), settingsPlain);

  // Device B advances CW; device A pushes from a stale revision and must merge.
  const cwB: CwMap = {
    tt0001: { id: "tt0001", t: 300, positionMs: 3000 },
    tt0003: { id: "tt0003", t: 250, positionMs: 2500 },
  };
  const pushB = await apiB.putDocs([
    {
      key: CW_KEY,
      ciphertext: await encryptDoc(dataKeyB, CW_KEY, JSON.stringify(cwB)),
      baseRev: cwRev!.status === "ok" ? cwRev!.rev : 0,
      updatedAt: Date.now(),
    },
  ]);
  assert.equal(pushB.results[0].status, "ok");

  const staleCwA: CwMap = { ...cwA, tt0002: { id: "tt0002", t: 400, positionMs: 4000 } };
  const conflictPush = await apiA.putDocs([
    {
      key: CW_KEY,
      ciphertext: await encryptDoc(dataKeyB64, CW_KEY, JSON.stringify(staleCwA)),
      baseRev: cwRev!.status === "ok" ? cwRev!.rev : 0,
      updatedAt: Date.now(),
    },
  ]);
  const conflict = conflictPush.results[0];
  assert.equal(conflict.status, "conflict");
  assert.equal(conflict.status === "conflict" && conflict.doc.deleted, 0);

  const remotePlain =
    conflict.status === "conflict"
      ? await decryptDoc(dataKeyB64, CW_KEY, conflict.doc.ciphertext!)
      : "";
  const merged = mergeDoc(CW_KEY, JSON.stringify(staleCwA), remotePlain, true);
  assert.ok(merged);
  const mergedMap = JSON.parse(merged!) as CwMap;
  assert.deepEqual(
    Object.entries(mergedMap)
      .map(([id, e]) => [id, e.t])
      .sort(),
    [
      ["tt0001", 300],
      ["tt0002", 400],
      ["tt0003", 250],
    ],
  );

  const retry = await apiA.putDocs([
    {
      key: CW_KEY,
      ciphertext: await encryptDoc(dataKeyB64, CW_KEY, merged!),
      baseRev: conflict.status === "conflict" ? conflict.doc.rev : 0,
      updatedAt: Date.now(),
    },
  ]);
  assert.equal(retry.results[0].status, "ok");

  // Device B pulls the merged result.
  const finalPull = await apiB.getDocs(pushB.rev);
  const finalCw = finalPull.docs.find((d) => d.key === CW_KEY);
  assert.ok(finalCw);
  const finalMap = JSON.parse(await decryptDoc(dataKeyB, CW_KEY, finalCw!.ciphertext!)) as CwMap;
  assert.equal(Object.keys(finalMap).length, 3);
  assert.equal(finalMap["tt0002"].t, 400);

  // Wrong password fails without leaking whether the email exists.
  const wrongKeys = await deriveKeys("wrong password", pre.kdfSalt, pre.kdfIterations);
  await assert.rejects(
    new SyncApi(BASE).login({ email: EMAIL, authHash: wrongKeys.authHash }),
    (e: unknown) =>
      e instanceof SyncApiError && e.code === "invalid_credentials" && e.status === 401,
  );
});

test("wrong password re-confirmation must not invalidate the session", async () => {
  installWorkerFetch();

  // The engine drops the local session only for token-revocation 401s; a wrong
  // password re-confirmation (delete account / change password) must survive.
  assert.equal(new SyncApiError("invalid_credentials", 401).invalidatesSession, false);
  assert.equal(new SyncApiError("unauthorized", 401).invalidatesSession, true);
  assert.equal(new SyncApiError("http_500", 500).invalidatesSession, false);

  // Server contract behind that decision: register, then delete the account.
  const email = "delete-flow@example.com";
  const kdfSalt = generateKdfSalt();
  const keys = await deriveKeys(PASSWORD, kdfSalt, KDF_ITERATIONS);
  const { dataKeyB64 } = await generateDataKey();
  const registered = await new SyncApi(BASE).register({
    email,
    authHash: keys.authHash,
    kdfIterations: KDF_ITERATIONS,
    kdfSalt,
    wrappedDataKey: await wrapDataKey(keys.wrapKey, dataKeyB64),
  });
  const api = new SyncApi(BASE, registered.token);

  // Wrong confirmation password: 401 invalid_credentials, token STAYS valid.
  const wrongKeys = await deriveKeys("wrong password", kdfSalt, KDF_ITERATIONS);
  await assert.rejects(
    api.deleteAccount(wrongKeys.authHash),
    (e: unknown) =>
      e instanceof SyncApiError &&
      e.code === "invalid_credentials" &&
      e.status === 401 &&
      !e.invalidatesSession,
  );
  const stillAuthed = await api.getDocs(0);
  assert.equal(stillAuthed.rev, 0);

  // Correct password removes the account; the old token is now unauthorized.
  await api.deleteAccount(keys.authHash);
  await assert.rejects(
    api.getDocs(0),
    (e: unknown) => e instanceof SyncApiError && e.code === "unauthorized" && e.invalidatesSession,
  );

  // The account is gone: signing in again fails without leaking existence.
  const pre = await new SyncApi(BASE).prelogin(email);
  const reKeys = await deriveKeys(PASSWORD, pre.kdfSalt, pre.kdfIterations);
  await assert.rejects(
    new SyncApi(BASE).login({ email, authHash: reKeys.authHash }),
    (e: unknown) =>
      e instanceof SyncApiError && e.code === "invalid_credentials" && e.status === 401,
  );
});
