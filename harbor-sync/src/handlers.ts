import {
  KDF_ITERATIONS,
  constantTimeEqual,
  fakeKdfSalt,
  hashToken,
  randomBase64,
  randomToken,
  serverHash,
} from "./crypto.ts";
import { error, isRecord, json, readJson } from "./http.ts";
import { D1Store, type DocChange, type Store, type SyncDoc, type User } from "./store.ts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AUTH_RATE_LIMIT = 20;
const AUTH_RATE_WINDOW_MS = 60_000;
const SESSION_IDLE_MS = 180 * 24 * 60 * 60 * 1000;
const AUTH_BUCKETS = new Map<string, { count: number; windowStart: number }>();

export type SyncEnv = {
  DB: D1Database | Store;
  AUTH_PEPPER: string;
};

type Authenticated = { user: User; tokenHash: string };
type IncomingDoc = { key: string; ciphertext: string | null; baseRev: number; updatedAt: number };

function storeFor(env: SyncEnv): Store {
  return "getUserByEmailNorm" in env.DB ? env.DB : new D1Store(env.DB);
}

function isRateAllowed(ip: string | null): boolean {
  if (ip === null || ip.length === 0) return true;
  const now = Date.now();
  for (const [key, entry] of AUTH_BUCKETS) {
    if (now - entry.windowStart > AUTH_RATE_WINDOW_MS) AUTH_BUCKETS.delete(key);
  }
  const entry = AUTH_BUCKETS.get(ip);
  if (entry === undefined || now - entry.windowStart > AUTH_RATE_WINDOW_MS) {
    AUTH_BUCKETS.set(ip, { count: 1, windowStart: now });
    return true;
  }
  entry.count += 1;
  return entry.count <= AUTH_RATE_LIMIT;
}

function emailNorm(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0 || normalized.length > 254 || !EMAIL.test(normalized)) return null;
  return normalized;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function optionalDeviceName(value: unknown): string | null | undefined {
  if (value === undefined) return null;
  if (typeof value !== "string" || value.length > 256) return undefined;
  return value;
}

function validKdf(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 100000;
}

function validDoc(value: unknown): value is IncomingDoc {
  if (
    !isRecord(value) ||
    !isString(value.key) ||
    value.key.length > 256 ||
    !value.key.startsWith("harbor.")
  )
    return false;
  if (
    value.ciphertext !== null &&
    (!isString(value.ciphertext) || value.ciphertext.length > 400000)
  )
    return false;
  return (
    typeof value.baseRev === "number" &&
    Number.isInteger(value.baseRev) &&
    value.baseRev >= 0 &&
    typeof value.updatedAt === "number" &&
    Number.isFinite(value.updatedAt)
  );
}

function exceedsDocLimit(value: unknown): boolean {
  return (
    isRecord(value) &&
    ((isString(value.key) && value.key.length > 256) ||
      (isString(value.ciphertext) && value.ciphertext.length > 400000))
  );
}

async function authenticate(request: Request, store: Store): Promise<Authenticated | null> {
  const authorization = request.headers.get("authorization");
  if (authorization === null || !authorization.startsWith("Bearer ") || authorization.length <= 7)
    return null;
  const tokenHash = await hashToken(authorization.slice(7));
  const session = await store.getSession(tokenHash);
  if (session === null) return null;
  const now = Date.now();
  if (now - session.lastUsedAt > SESSION_IDLE_MS) {
    await store.deleteSession(tokenHash);
    return null;
  }
  const user = await store.getUserById(session.userId);
  if (user === null) {
    await store.deleteSession(tokenHash);
    return null;
  }
  await store.touchSession(tokenHash, now);
  return { user, tokenHash };
}

async function createSession(
  store: Store,
  userId: string,
  deviceName: string | null,
): Promise<string> {
  const token = randomToken();
  const now = Date.now();
  await store.createSession({
    tokenHash: await hashToken(token),
    userId,
    deviceName,
    createdAt: now,
    lastUsedAt: now,
  });
  return token;
}

async function handlePrelogin(request: Request, env: SyncEnv, store: Store): Promise<Response> {
  const body = await readJson(request);
  if (!isRecord(body)) return error("invalid_request", 400);
  const normalized = emailNorm(body.email);
  if (normalized === null) return error("invalid_request", 400);
  const user = await store.getUserByEmailNorm(normalized);
  if (user !== null) return json({ kdfIterations: user.kdfIterations, kdfSalt: user.kdfSalt });
  return json({
    kdfIterations: KDF_ITERATIONS,
    kdfSalt: await fakeKdfSalt(env.AUTH_PEPPER, normalized),
  });
}

async function handleRegister(request: Request, store: Store): Promise<Response> {
  const body = await readJson(request);
  if (!isRecord(body)) return error("invalid_request", 400);
  const normalized = emailNorm(body.email);
  const deviceName = optionalDeviceName(body.deviceName);
  if (
    normalized === null ||
    !isString(body.email) ||
    !isString(body.authHash) ||
    body.authHash.length === 0 ||
    !validKdf(body.kdfIterations) ||
    !isString(body.kdfSalt) ||
    body.kdfSalt.length === 0 ||
    !isString(body.wrappedDataKey) ||
    body.wrappedDataKey.length === 0 ||
    deviceName === undefined
  ) {
    return error("invalid_request", 400);
  }
  const now = Date.now();
  const authSalt = randomBase64(16);
  const user = {
    id: crypto.randomUUID(),
    email: body.email.trim(),
    emailNorm: normalized,
    serverHash: await serverHash(body.authHash, authSalt),
    authSalt,
    kdfIterations: body.kdfIterations,
    kdfSalt: body.kdfSalt,
    wrappedDataKey: body.wrappedDataKey,
    createdAt: now,
    updatedAt: now,
  };
  if (!(await store.createUser(user))) return error("email_taken", 409);
  const token = await createSession(store, user.id, deviceName);
  return json({ token, userId: user.id, syncRev: 0 }, 201);
}

async function handleLogin(request: Request, store: Store): Promise<Response> {
  const body = await readJson(request);
  if (!isRecord(body)) return error("invalid_request", 400);
  const normalized = emailNorm(body.email);
  const deviceName = optionalDeviceName(body.deviceName);
  if (
    normalized === null ||
    !isString(body.authHash) ||
    body.authHash.length === 0 ||
    deviceName === undefined
  )
    return error("invalid_request", 400);
  const user = await store.getUserByEmailNorm(normalized);
  if (
    user === null ||
    !constantTimeEqual(await serverHash(body.authHash, user.authSalt), user.serverHash)
  )
    return error("invalid_credentials", 401);
  const token = await createSession(store, user.id, deviceName);
  return json({
    token,
    userId: user.id,
    kdfIterations: user.kdfIterations,
    kdfSalt: user.kdfSalt,
    wrappedDataKey: user.wrappedDataKey,
    syncRev: user.syncRev,
  });
}

async function handleLogout(request: Request, store: Store): Promise<Response> {
  const auth = await authenticate(request, store);
  if (auth === null) return error("unauthorized", 401);
  await store.deleteSession(auth.tokenHash);
  return json({ ok: true });
}

async function handlePassword(request: Request, store: Store): Promise<Response> {
  const auth = await authenticate(request, store);
  if (auth === null) return error("unauthorized", 401);
  const body = await readJson(request);
  if (
    !isRecord(body) ||
    !isString(body.authHash) ||
    !isString(body.newAuthHash) ||
    body.authHash.length === 0 ||
    body.newAuthHash.length === 0 ||
    !validKdf(body.newKdfIterations) ||
    !isString(body.newKdfSalt) ||
    body.newKdfSalt.length === 0 ||
    !isString(body.newWrappedDataKey) ||
    body.newWrappedDataKey.length === 0
  )
    return error("invalid_request", 400);
  if (!constantTimeEqual(await serverHash(body.authHash, auth.user.authSalt), auth.user.serverHash))
    return error("invalid_credentials", 401);
  const authSalt = randomBase64(16);
  await store.updateUserAuth(auth.user.id, {
    serverHash: await serverHash(body.newAuthHash, authSalt),
    authSalt,
    kdfIterations: body.newKdfIterations,
    kdfSalt: body.newKdfSalt,
    wrappedDataKey: body.newWrappedDataKey,
    updatedAt: Date.now(),
  });
  await store.deleteOtherSessions(auth.user.id, auth.tokenHash);
  return json({ ok: true });
}

async function handleGetDocs(request: Request, store: Store): Promise<Response> {
  const auth = await authenticate(request, store);
  if (auth === null) return error("unauthorized", 401);
  const sinceText = new URL(request.url).searchParams.get("since") ?? "0";
  if (!/^\d+$/.test(sinceText)) return error("invalid_request", 400);
  const since = Number(sinceText);
  if (!Number.isSafeInteger(since)) return error("invalid_request", 400);
  const user = await store.getUserById(auth.user.id);
  if (user === null) return error("unauthorized", 401);
  return json({ rev: user.syncRev, docs: await store.getDocsSince(user.id, since) });
}

async function handlePutDocs(request: Request, store: Store): Promise<Response> {
  const auth = await authenticate(request, store);
  if (auth === null) return error("unauthorized", 401);
  const body = await readJson(request);
  if (!isRecord(body) || !Array.isArray(body.docs)) return error("invalid_request", 400);
  if (body.docs.length > 200 || body.docs.some(exceedsDocLimit)) return error("too_large", 413);
  if (!body.docs.every(validDoc)) return error("invalid_request", 400);
  const docs = body.docs;
  const keys = new Set<string>();
  for (const doc of docs) {
    if (keys.has(doc.key)) return error("invalid_request", 400);
    keys.add(doc.key);
  }
  const existing = new Map<string, SyncDoc | null>();
  for (const doc of docs) existing.set(doc.key, await store.getDoc(auth.user.id, doc.key));
  const newKeys = [...existing.values()].filter((doc) => doc === null).length;
  if ((await store.countDocs(auth.user.id)) + newKeys > 2000) return error("too_large", 413);
  const accepted: IncomingDoc[] = [];
  const conflicts = new Map<string, SyncDoc>();
  for (const doc of docs) {
    const server = existing.get(doc.key) ?? null;
    if (server !== null && server.rev !== doc.baseRev) conflicts.set(doc.key, server);
    else accepted.push(doc);
  }
  const changes: DocChange[] = accepted.map((doc) => ({
    key: doc.key,
    ciphertext: doc.ciphertext,
    updatedAt: doc.updatedAt,
  }));
  const baseSyncRev = auth.user.syncRev;
  const rev =
    changes.length === 0
      ? baseSyncRev
      : await store.applyDocChanges(auth.user.id, baseSyncRev, changes);
  if (rev === null) return error("conflict", 409);
  const acceptedRevs = new Map(accepted.map((doc, index) => [doc.key, baseSyncRev + index + 1]));
  const results = docs.map((doc) => {
    const conflict = conflicts.get(doc.key);
    return conflict === undefined
      ? { key: doc.key, status: "ok" as const, rev: acceptedRevs.get(doc.key) ?? auth.user.syncRev }
      : { key: doc.key, status: "conflict" as const, doc: conflict };
  });
  return json({ rev, results });
}

async function handleDeleteAccount(request: Request, store: Store): Promise<Response> {
  const auth = await authenticate(request, store);
  if (auth === null) return error("unauthorized", 401);
  const body = await readJson(request);
  if (!isRecord(body) || !isString(body.authHash) || body.authHash.length === 0)
    return error("invalid_request", 400);
  if (!constantTimeEqual(await serverHash(body.authHash, auth.user.authSalt), auth.user.serverHash))
    return error("invalid_credentials", 401);
  await store.deleteUser(auth.user.id);
  return json({ ok: true });
}

export async function handleRequest(request: Request, env: SyncEnv): Promise<Response> {
  const store = storeFor(env);
  const url = new URL(request.url);
  if (url.pathname === "/health" && request.method === "GET") return json({ ok: true, version: 1 });
  if (
    url.pathname.startsWith("/v1/auth/") &&
    !isRateAllowed(request.headers.get("cf-connecting-ip"))
  )
    return error("rate_limited", 429);
  if (url.pathname === "/v1/auth/prelogin" && request.method === "POST")
    return handlePrelogin(request, env, store);
  if (url.pathname === "/v1/auth/register" && request.method === "POST")
    return handleRegister(request, store);
  if (url.pathname === "/v1/auth/login" && request.method === "POST")
    return handleLogin(request, store);
  if (url.pathname === "/v1/auth/logout" && request.method === "POST")
    return handleLogout(request, store);
  if (url.pathname === "/v1/auth/password" && request.method === "PUT")
    return handlePassword(request, store);
  if (url.pathname === "/v1/sync/docs" && request.method === "GET")
    return handleGetDocs(request, store);
  if (url.pathname === "/v1/sync/docs" && request.method === "PUT")
    return handlePutDocs(request, store);
  if (url.pathname === "/v1/account" && request.method === "DELETE")
    return handleDeleteAccount(request, store);
  return error("not_found", 404);
}
