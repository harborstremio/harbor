import { WEB_PORT } from "@/lib/remote/protocol";
import { HANDOFF_PARAM } from "./handoff-protocol";

/**
 * Crockford base32: no I, L, O or U. The same value is scanned from a QR and
 * read aloud off a TV across a room, so the alphabet has to survive both.
 * 32 symbols divide 256 evenly, so a raw byte modulo is unbiased.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** 12 symbols of 32 is 60 bits. Bounded by what a person will retype, not by paranoia. */
export const HANDOFF_TOKEN_LEN = 12;
export const HANDOFF_ID_LEN = 8;
const GROUP = 4;

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < n; i += 1) out[i] = Math.floor(Math.random() * 256);
  return out;
}

function mint(len: number): string {
  const bytes = randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i += 1) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}

export function mintHandoffToken(): string {
  return mint(HANDOFF_TOKEN_LEN);
}

/** Public correlation id. Broadcast downstream, so deliberately not the token. */
export function mintHandoffId(): string {
  return mint(HANDOFF_ID_LEN);
}

export function mintHandoffNonce(): string {
  return mint(HANDOFF_ID_LEN);
}

/**
 * Accepts what a person actually types: lower case, spaces, dashes, and the
 * three glyph confusions the alphabet was chosen to absorb.
 */
export function normalizeHandoffCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

/** Grouped for reading at ten feet. Strip before comparing. */
export function formatHandoffCode(code: string): string {
  const clean = normalizeHandoffCode(code);
  const parts: string[] = [];
  for (let i = 0; i < clean.length; i += GROUP) parts.push(clean.slice(i, i + GROUP));
  return parts.join(" ");
}

export function isHandoffCode(input: string): boolean {
  return normalizeHandoffCode(input).length === HANDOFF_TOKEN_LEN;
}

/**
 * `/setup` is its own SPA path in the Rust router. Onboarding used to ride on
 * `/remote` with a query parameter, which meant a scan hijacked the remote and
 * the two surfaces could never be reached independently. The token still rides
 * along so the phone can claim the pairing, but the path is what selects the
 * surface.
 */
export function handoffUrl(host: string, token: string, port = WEB_PORT): string {
  return `http://${host}:${port}/setup?${HANDOFF_PARAM}=${encodeURIComponent(token)}`;
}

export function readHandoffCodeFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = new URLSearchParams(window.location.search).get(HANDOFF_PARAM);
    if (!raw) return null;
    const code = normalizeHandoffCode(raw);
    return code.length === HANDOFF_TOKEN_LEN ? code : null;
  } catch {
    return null;
  }
}
