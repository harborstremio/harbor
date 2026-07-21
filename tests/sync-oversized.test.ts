// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { fetch as workerFetch } from "../harbor-sync/src/worker.ts";
import { MemStore } from "../harbor-sync/src/store.ts";
import { MAX_DOC_CIPHERTEXT_CHARS, SyncApi } from "../src/lib/sync/api.ts";

const EMAIL = "oversized@example.com";
const PASSWORD = "correct horse battery staple";
const SMALL_KEY = "harbor.settings";
const HUGE_KEY = "harbor.huge-blob.v1";

// The engine captures localStorage at import time, so the shim must be
// installed before the dynamic import below.
function installLocalStorage(): void {
  const map = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    get length() {
      return map.size;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
    removeItem(key: string) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
}

function installWorkerFetch(): void {
  const env = { DB: new MemStore(), AUTH_PEPPER: "oversized-pepper" };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
    workerFetch(new Request(input, init), env)) as typeof fetch;
}

test("an oversized doc is kept local and does not wedge the rest of the push", async () => {
  installLocalStorage();
  installWorkerFetch();
  // Dynamic import is intentional: engine.ts and session.ts read localStorage
  // during module evaluation, so a static import would run before the shim
  // above exists and the engine would snapshot an empty environment.
  const { getSyncStatus, signUpSync, syncNow } = await import("../src/lib/sync/engine.ts");
  const { loadSyncSession } = await import("../src/lib/sync/session.ts");
  localStorage.setItem(SMALL_KEY, JSON.stringify({ uiLanguage: "en" }));
  // Plaintext at the ciphertext cap; base64 encryption overhead pushes the
  // resulting ciphertext past the server's per-doc 413 limit.
  localStorage.setItem(HUGE_KEY, "x".repeat(MAX_DOC_CIPHERTEXT_CHARS));

  await signUpSync(EMAIL, PASSWORD);
  await syncNow();

  // The oversized doc is reported without failing the sync cycle.
  const status = getSyncStatus();
  assert.equal(status.signedIn, true);
  assert.equal(status.error, "doc_too_large");
  assert.ok(status.lastSyncAt !== null);

  // The server accepted the small doc and never saw the oversized one.
  const session = loadSyncSession();
  if (!session) throw new Error("expected a stored sync session after sign-up");
  const pulled = await new SyncApi(session.endpoint, session.token).getDocs(0);
  const keys = pulled.docs.map((doc) => doc.key);
  assert.ok(keys.includes(SMALL_KEY));
  assert.ok(!keys.includes(HUGE_KEY));

  // The oversized value stays intact locally.
  assert.equal(localStorage.getItem(HUGE_KEY)?.length, MAX_DOC_CIPHERTEXT_CHARS);
});
