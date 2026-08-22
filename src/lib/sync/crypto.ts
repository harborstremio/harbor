export type DerivedKeys = { authHash: string; wrapKey: CryptoKey };

export const KDF_ITERATIONS: number = 600000;

const AUTH_INFO = new TextEncoder().encode("harbor-sync/auth");
const WRAP_INFO = new TextEncoder().encode("harbor-sync/wrap");
const EMPTY_SALT = new Uint8Array();
const IV_BYTES = 12;
const DATA_KEY_BYTES = 32;
const FORMAT_VERSION = "v1";
const encoder = new TextEncoder();
const decoder = new TextDecoder();
type ByteArray = Uint8Array<ArrayBuffer>;

function toBase64(bytes: Uint8Array<ArrayBufferLike>): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    for (const byte of chunk) {
      binary += String.fromCharCode(byte);
    }
  }

  return btoa(binary);
}

function fromBase64(value: string): ByteArray {
  const binary = atob(value);
  const bytes: ByteArray = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function randomBytes(length: number): ByteArray {
  const bytes: ByteArray = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

function parseCiphertext(value: string): { iv: ByteArray; ciphertext: ByteArray } {
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== FORMAT_VERSION) {
    throw new Error("Invalid ciphertext format");
  }

  const iv = fromBase64(parts[1]);
  if (iv.length !== IV_BYTES) {
    throw new Error("Invalid ciphertext IV");
  }

  return { iv, ciphertext: fromBase64(parts[2]) };
}

async function importDataKey(dataKeyB64: string): Promise<CryptoKey> {
  const dataKey = fromBase64(dataKeyB64);
  if (dataKey.length !== DATA_KEY_BYTES) {
    throw new Error("Invalid data key");
  }

  return globalThis.crypto.subtle.importKey("raw", dataKey, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export function generateKdfSalt(): string {
  return toBase64(randomBytes(16));
}

export async function deriveKeys(
  password: string,
  kdfSaltB64: string,
  iterations: number,
): Promise<DerivedKeys> {
  const passwordKey = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const masterKey = await globalThis.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: fromBase64(kdfSaltB64),
      iterations,
    },
    passwordKey,
    256,
  );
  const hkdfKey = await globalThis.crypto.subtle.importKey("raw", masterKey, "HKDF", false, [
    "deriveBits",
    "deriveKey",
  ]);
  const authKey = await globalThis.crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: EMPTY_SALT,
      info: AUTH_INFO,
    },
    hkdfKey,
    256,
  );
  const wrapKey = await globalThis.crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: EMPTY_SALT,
      info: WRAP_INFO,
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  return { authHash: toBase64(new Uint8Array(authKey)), wrapKey };
}

export async function generateDataKey(): Promise<{ dataKeyB64: string }> {
  return { dataKeyB64: toBase64(randomBytes(DATA_KEY_BYTES)) };
}

export async function wrapDataKey(wrapKey: CryptoKey, dataKeyB64: string): Promise<string> {
  const dataKey = fromBase64(dataKeyB64);
  if (dataKey.length !== DATA_KEY_BYTES) {
    throw new Error("Invalid data key");
  }

  const iv = randomBytes(IV_BYTES);
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    wrapKey,
    dataKey,
  );
  return `${FORMAT_VERSION}.${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`;
}

export async function unwrapDataKey(wrapKey: CryptoKey, wrapped: string): Promise<string> {
  const { iv, ciphertext } = parseCiphertext(wrapped);
  const dataKey = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    wrapKey,
    ciphertext,
  );
  const bytes = new Uint8Array(dataKey);
  if (bytes.length !== DATA_KEY_BYTES) {
    throw new Error("Invalid wrapped data key");
  }

  return toBase64(bytes);
}

export async function encryptDoc(
  dataKeyB64: string,
  docKey: string,
  plaintext: string,
): Promise<string> {
  const dataKey = await importDataKey(dataKeyB64);
  const iv = randomBytes(IV_BYTES);
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(docKey) },
    dataKey,
    encoder.encode(plaintext),
  );

  return `${FORMAT_VERSION}.${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptDoc(
  dataKeyB64: string,
  docKey: string,
  ciphertext: string,
): Promise<string> {
  const dataKey = await importDataKey(dataKeyB64);
  const { iv, ciphertext: encrypted } = parseCiphertext(ciphertext);
  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(docKey) },
    dataKey,
    encrypted,
  );

  return decoder.decode(plaintext);
}
