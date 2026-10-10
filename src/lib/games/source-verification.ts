import { invoke } from "@tauri-apps/api/core";

export type NativeSourceDocument = { status: number; body: string; headers: Record<string, string>; url?: string };
const unavailable = (reason: unknown, command: string) => String(reason).includes(command) && /not found|unknown command/i.test(String(reason));
export const sourceVerificationAvailable = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
export const sourceNeedsVerification = (error?: string) => error === "games.sources.source_blocked" || !!error?.startsWith("games.sources.source_verify_");

async function abortable<T>(operation: Promise<T>, signal: AbortSignal, cancel?: () => void): Promise<T> {
  let onAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => { cancel?.(); reject(signal.reason ?? new DOMException("Canceled", "AbortError")); };
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
  try { const result = await Promise.race([operation, aborted]); signal.throwIfAborted(); return result; }
  finally { signal.removeEventListener("abort", onAbort); }
}

/** Only a user's Verify action opens a browser. No challenge is clicked automatically. */
export async function verifySource(profile: string, url: string, signal: AbortSignal) {
  signal.throwIfAborted();
  if (!sourceVerificationAvailable()) throw Error("source_verify_unavailable");
  const session = crypto.randomUUID();
  const cancel = () => { void invoke("games_source_verify_cancel", { profile, session }).catch(() => {}); };
  try {
    await abortable(invoke<void>("games_source_verify", { profile, session, url, userAgent: navigator.userAgent }), signal, cancel);
  } catch (reason) {
    if (String(reason) === "source_verify_canceled") throw new DOMException("Verification canceled", "AbortError");
    if (unavailable(reason, "games_source_verify")) throw Error("source_verify_unavailable");
    throw reason;
  }
}

let supported = true;
async function decodeDocument(encoded: string, signal: AbortSignal, maxBytes: number) {
  if (encoded.length > Math.ceil(maxBytes / 3) * 4) throw Error("source_limit");
  if (encoded.length % 4) throw Error("source_format");
  const bytes = encoded.length / 4 * 3 - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
  if (bytes > maxBytes) throw Error("source_limit");
  const body = new Uint8Array(bytes);
  let written = 0;
  // Decode aligned base64 slices, avoiding both a full binary string and millions
  // of callback invocations. Larger catalogs yield between 768 KiB output blocks.
  for (let offset = 0; offset < encoded.length; offset += 1024 * 1024) {
    signal.throwIfAborted();
    const chunk = atob(encoded.slice(offset, offset + 1024 * 1024));
    for (let index = 0; index < chunk.length; index++) body[written++] = chunk.charCodeAt(index);
    if (written < bytes) await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  signal.throwIfAborted();
  return body;
}
/** Credentials remain native. A missing grant returns null without making an HTTP request. */
export async function fetchVerifiedSource(profile: string | undefined, url: string, signal: AbortSignal, maxBytes: number): Promise<Response | null> {
  signal.throwIfAborted();
  if (!profile || !supported || !sourceVerificationAvailable()) return null;
  let document: NativeSourceDocument | null;
  try {
    document = await abortable(invoke<NativeSourceDocument | null>("games_source_verified_fetch", { profile, url, maxBytes }), signal);
  } catch (reason) {
    // A running older native binary must retain ordinary source loading until restarted.
    if (unavailable(reason, "games_source_verified_fetch")) { supported = false; return null; }
    throw reason;
  }
  if (!document) return null;
  return sourceDocumentResponse(document, url, signal, maxBytes);
}

export async function sourceDocumentResponse(document: NativeSourceDocument, url: string, signal: AbortSignal, maxBytes: number) {
  const body = await decodeDocument(document.body, signal, maxBytes);
  const headers = new Headers(document.headers);
  headers.set("x-harbor-final-url", document.url || url);
  return new Response([204, 205, 304].includes(document.status) ? null : body, { status: document.status, headers });
}
