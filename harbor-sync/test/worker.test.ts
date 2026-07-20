// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { fetch as workerFetch } from "../src/worker.ts";
import { MemStore } from "../src/store.ts";

const encoder = new TextEncoder();
const KDF_SALT = "AAECAwQFBgcICQoLDA0ODw==";

type TestRequest = (
  path: string,
  method?: string,
  body?: unknown,
  token?: string,
) => Promise<Response>;
function bytesFromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function clientAuthHash(password: string, kdfSalt = KDF_SALT): Promise<string> {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const masterKey = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: bytesFromBase64(kdfSalt), iterations: 600000 },
    passwordKey,
    256,
  );
  const hkdfKey = await crypto.subtle.importKey("raw", masterKey, "HKDF", false, ["deriveBits"]);
  const authKey = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(),
      info: encoder.encode("harbor-sync/auth"),
    },
    hkdfKey,
    256,
  );
  return toBase64(new Uint8Array(authKey));
}

function app(store = new MemStore()) {
  const env = { DB: store, AUTH_PEPPER: "test-pepper" };
  const request = async (path: string, method = "GET", body?: unknown, token?: string) => {
    const headers = new Headers();
    if (body !== undefined) headers.set("content-type", "application/json");
    if (token !== undefined) headers.set("authorization", `Bearer ${token}`);
    return workerFetch(
      new Request(`https://sync.test${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      env,
    );
  };
  return { store, request };
}

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

async function register(
  request: TestRequest,
  email = "person@example.com",
  password = "correct horse battery staple",
) {
  const authHash = await clientAuthHash(password);
  const response = await request("/v1/auth/register", "POST", {
    email,
    authHash,
    kdfIterations: 600000,
    kdfSalt: KDF_SALT,
    wrappedDataKey: "v1.AAECAwQFBgcICQoL.AAECAwQFBgcICQoLDA0ODw==",
    deviceName: "test device",
  });
  assert.equal(response.status, 201);
  return { authHash, body: await responseBody(response) };
}

test("register and login accept a client-style authHash", async () => {
  const { request } = app();
  const created = await register(request);
  const login = await request("/v1/auth/login", "POST", {
    email: "PERSON@example.com",
    authHash: created.authHash,
  });
  assert.equal(login.status, 200);
  const body = await responseBody(login);
  assert.equal(typeof body.token, "string");
  assert.equal(body.userId, created.body.userId);
  assert.equal(body.kdfIterations, 600000);
  assert.equal(body.kdfSalt, KDF_SALT);
});

test("prelogin hides unknown accounts and rejects wrong credentials", async () => {
  const { request } = app();
  const unknownFirst = await request("/v1/auth/prelogin", "POST", { email: "unknown@example.com" });
  const unknownSecond = await request("/v1/auth/prelogin", "POST", {
    email: "unknown@example.com",
  });
  const firstBody = await responseBody(unknownFirst);
  assert.deepEqual(firstBody, await responseBody(unknownSecond));
  await register(request);
  const known = await request("/v1/auth/prelogin", "POST", { email: "person@example.com" });
  assert.deepEqual(await responseBody(known), { kdfIterations: 600000, kdfSalt: KDF_SALT });
  const rejected = await request("/v1/auth/login", "POST", {
    email: "person@example.com",
    authHash: await clientAuthHash("wrong password"),
  });
  assert.equal(rejected.status, 401);
  assert.equal((await responseBody(rejected)).error, "invalid_credentials");
});

test("bearer sessions authorize requests and reject bad tokens", async () => {
  const { request } = app();
  const created = await register(request);
  const token = created.body.token as string;
  assert.equal((await request("/v1/sync/docs?since=0", "GET", undefined, token)).status, 200);
  const rejected = await request("/v1/sync/docs?since=0", "GET", undefined, "not-a-session");
  assert.equal(rejected.status, 401);
  assert.equal((await responseBody(rejected)).error, "unauthorized");
});

test("documents use increasing revisions, incremental pull, conflicts, and tombstones", async () => {
  const { request } = app();
  const created = await register(request);
  const token = created.body.token as string;
  const pushed = await request(
    "/v1/sync/docs",
    "PUT",
    {
      docs: [
        { key: "harbor.one", ciphertext: "cipher-one", baseRev: 0, updatedAt: 10 },
        { key: "harbor.two", ciphertext: "cipher-two", baseRev: 0, updatedAt: 20 },
      ],
    },
    token,
  );
  assert.equal(pushed.status, 200);
  const pushBody = await responseBody(pushed);
  assert.equal(pushBody.rev, 2);
  assert.deepEqual(
    (pushBody.results as Array<Record<string, unknown>>).map((result) => result.rev),
    [1, 2],
  );
  const pulled = await request("/v1/sync/docs?since=1", "GET", undefined, token);
  const pullBody = await responseBody(pulled);
  assert.equal((pullBody.docs as Array<Record<string, unknown>>).length, 1);
  assert.equal((pullBody.docs as Array<Record<string, unknown>>)[0].key, "harbor.two");
  const conflict = await request(
    "/v1/sync/docs",
    "PUT",
    { docs: [{ key: "harbor.one", ciphertext: "stale", baseRev: 0, updatedAt: 30 }] },
    token,
  );
  const conflictBody = await responseBody(conflict);
  const result = (conflictBody.results as Array<Record<string, unknown>>)[0];
  assert.equal(result.status, "conflict");
  assert.equal((result.doc as Record<string, unknown>).ciphertext, "cipher-one");
  const tombstone = await request(
    "/v1/sync/docs",
    "PUT",
    { docs: [{ key: "harbor.one", ciphertext: null, baseRev: 1, updatedAt: 40 }] },
    token,
  );
  assert.equal(tombstone.status, 200);
  const latest = await request("/v1/sync/docs?since=2", "GET", undefined, token);
  const latestDoc = ((await responseBody(latest)).docs as Array<Record<string, unknown>>)[0];
  assert.equal(latestDoc.ciphertext, null);
  assert.equal(latestDoc.deleted, 1);
});

test("password change revokes other sessions and account deletion removes all state", async () => {
  const { request } = app();
  const created = await register(request);
  const current = created.body.token as string;
  const secondLogin = await request("/v1/auth/login", "POST", {
    email: "person@example.com",
    authHash: created.authHash,
    deviceName: "other device",
  });
  const secondToken = (await responseBody(secondLogin)).token as string;
  const newHash = await clientAuthHash("new password", "EBESExQVFhcYGRobHB0eHw==");
  const changed = await request(
    "/v1/auth/password",
    "PUT",
    {
      authHash: created.authHash,
      newAuthHash: newHash,
      newKdfIterations: 600000,
      newKdfSalt: "EBESExQVFhcYGRobHB0eHw==",
      newWrappedDataKey: "v1.AAECAwQFBgcICQoL.AAECAwQFBgcICQoLDA0ODw==",
    },
    current,
  );
  assert.equal(changed.status, 200);
  assert.equal((await request("/v1/sync/docs?since=0", "GET", undefined, secondToken)).status, 401);
  await request(
    "/v1/sync/docs",
    "PUT",
    { docs: [{ key: "harbor.removed", ciphertext: "value", baseRev: 0, updatedAt: 1 }] },
    current,
  );
  const deleted = await request("/v1/account", "DELETE", { authHash: newHash }, current);
  assert.equal(deleted.status, 200);
  assert.equal((await request("/v1/sync/docs?since=0", "GET", undefined, current)).status, 401);
  const login = await request("/v1/auth/login", "POST", {
    email: "person@example.com",
    authHash: newHash,
  });
  assert.equal(login.status, 401);
});

test("rejects invalid document keys, oversized ciphertexts, and batches above 200 documents", async () => {
  const { request } = app();
  const created = await register(request);
  const token = created.body.token as string;
  const invalidKey = await request(
    "/v1/sync/docs",
    "PUT",
    { docs: [{ key: "other.key", ciphertext: "x", baseRev: 0, updatedAt: 1 }] },
    token,
  );
  assert.equal(invalidKey.status, 400);
  const oversized = await request(
    "/v1/sync/docs",
    "PUT",
    { docs: [{ key: "harbor.big", ciphertext: "x".repeat(400001), baseRev: 0, updatedAt: 1 }] },
    token,
  );
  assert.equal(oversized.status, 413);
  const tooMany = Array.from({ length: 201 }, (_, index) => ({
    key: `harbor.${index}`,
    ciphertext: "x",
    baseRev: 0,
    updatedAt: index,
  }));
  const oversizedBatch = await request("/v1/sync/docs", "PUT", { docs: tooMany }, token);
  assert.equal(oversizedBatch.status, 413);
});
