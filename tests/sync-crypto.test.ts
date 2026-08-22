// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  decryptDoc,
  deriveKeys,
  encryptDoc,
  generateDataKey,
  KDF_ITERATIONS,
  unwrapDataKey,
  wrapDataKey,
} from "../src/lib/sync/crypto.ts";

const salt = "AAECAwQFBgcICQoLDA0ODw==";
const otherSalt = "EBESExQVFhcYGRobHB0eHw==";
const testIterations = 1000;

test("derives deterministic, salt-bound auth and wrap keys", async () => {
  const first = await deriveKeys("correct horse battery staple", salt, testIterations);
  const second = await deriveKeys("correct horse battery staple", salt, testIterations);
  const differentSalt = await deriveKeys("correct horse battery staple", otherSalt, testIterations);
  const { dataKeyB64 } = await generateDataKey();
  const wrapped = await wrapDataKey(first.wrapKey, dataKeyB64);
  const authKeyBytes = Uint8Array.from(atob(first.authHash), (character) =>
    character.charCodeAt(0),
  );
  const authKey = await globalThis.crypto.subtle.importKey("raw", authKeyBytes, "AES-GCM", false, [
    "decrypt",
  ]);

  assert.equal(KDF_ITERATIONS, 600000);
  assert.equal(first.authHash, second.authHash);
  assert.notEqual(first.authHash, differentSalt.authHash);
  await assert.rejects(unwrapDataKey(authKey, wrapped));
});

test("wraps and unwraps a data key only with the matching password", async () => {
  const correctKeys = await deriveKeys("correct password", salt, testIterations);
  const wrongKeys = await deriveKeys("wrong password", salt, testIterations);
  const { dataKeyB64 } = await generateDataKey();
  const wrapped = await wrapDataKey(correctKeys.wrapKey, dataKeyB64);

  assert.equal(await unwrapDataKey(correctKeys.wrapKey, wrapped), dataKeyB64);
  await assert.rejects(unwrapDataKey(wrongKeys.wrapKey, wrapped));
});

test("encrypts documents with key-bound authenticated encryption", async () => {
  const { dataKeyB64 } = await generateDataKey();
  const docKey = "harbor.settings.v1";
  const plaintext = "settings with unicode: 漢字";
  const ciphertext = await encryptDoc(dataKeyB64, docKey, plaintext);

  assert.match(ciphertext, /^v1\.[A-Za-z0-9+/]+={0,2}\.[A-Za-z0-9+/]+={0,2}$/);
  assert.equal(await decryptDoc(dataKeyB64, docKey, ciphertext), plaintext);
  await assert.rejects(decryptDoc(dataKeyB64, "harbor.other-settings.v1", ciphertext));
});
