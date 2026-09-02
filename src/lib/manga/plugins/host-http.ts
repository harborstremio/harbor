import { safeFetch, safeFetchBytes } from "@/lib/safe-fetch";
import { isBlockedUrl } from "@/lib/privacy/blocklist";
import type { PluginGrpcOpts, PluginGrpcResult, PluginHttpOpts, PluginHttpResult } from "./types";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_TIMEOUT = 45_000;
const DEFAULT_TIMEOUT = 20_000;

const PLUGIN_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const DENY_HEADERS = new Set([
  "host",
  "cookie",
  "set-cookie",
  "authorization",
  "content-length",
  "connection",
  "origin",
  "referer",
]);

const ALLOW_RESPONSE_HEADERS = new Set([
  "content-type",
  "content-length",
  "last-modified",
  "etag",
  "date",
  "cache-control",
  "expires",
  "content-language",
  "content-encoding",
  "content-disposition",
  "content-range",
  "accept-ranges",
  "retry-after",
  "link",
  "location",
  "vary",
  "age",
  "server",
  "grpc-status",
  "grpc-message",
  "grpc-encoding",
  "grpc-accept-encoding",
]);

function isPrivateV4(h: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const a = +m[1];
  const b = +m[2];
  if (a === 0 || a === 127 || a === 10) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function embeddedV4(h: string): string | null {
  const dotted = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(h);
  if (dotted && /(::ffff:|64:ff9b:)/i.test(h)) return dotted[1];
  const hex = /::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(h);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
  }
  return null;
}

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "::1" || h === "0.0.0.0" || h === "::") return true;
  if (h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  if (h.startsWith("64:ff9b:")) return true;
  if (isPrivateV4(h)) return true;
  const v4 = embeddedV4(h);
  if (v4 && isPrivateV4(v4)) return true;
  return false;
}

export function assertSafeUrl(raw: string): string {
  const u = new URL(raw);
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("scheme not allowed: " + u.protocol);
  }
  if (isPrivateHost(u.hostname)) throw new Error("blocked private host: " + u.hostname);
  if (isBlockedUrl(u.href)) throw new Error("blocked tracker host: " + u.hostname);
  return u.href;
}

const TWO_LEVEL_TLDS = new Set([
  "co.uk",
  "org.uk",
  "gov.uk",
  "ac.uk",
  "me.uk",
  "net.uk",
  "sch.uk",
  "ltd.uk",
  "plc.uk",
  "com.au",
  "net.au",
  "org.au",
  "edu.au",
  "gov.au",
  "id.au",
  "co.jp",
  "or.jp",
  "ne.jp",
  "ac.jp",
  "go.jp",
  "com.cn",
  "net.cn",
  "org.cn",
  "gov.cn",
  "co.nz",
  "net.nz",
  "org.nz",
  "co.in",
  "net.in",
  "org.in",
  "firm.in",
  "gen.in",
  "ind.in",
  "co.kr",
  "or.kr",
  "com.br",
  "net.br",
  "org.br",
  "gov.br",
  "com.mx",
  "com.ar",
  "com.tr",
  "com.ua",
  "com.pl",
  "com.ru",
  "com.sa",
  "com.eg",
  "com.ng",
  "co.za",
  "co.il",
  "co.id",
  "co.th",
  "co.ke",
  "com.sg",
  "com.hk",
  "com.tw",
  "com.my",
  "com.ph",
  "com.vn",
  "github.io",
  "pages.dev",
  "web.app",
  "workers.dev",
  "vercel.app",
  "netlify.app",
  "onrender.com",
  "fly.dev",
  "deno.dev",
  "firebaseapp.com",
  "herokuapp.com",
  "glitch.me",
  "r2.dev",
]);

function ipLiteral(h: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":");
}

function registrableDomain(host: string): string {
  const h = host.replace(/\.$/, "");
  const labels = h.split(".");
  if (labels.length <= 2) return h;
  const lastTwo = labels.slice(-2).join(".");
  if (TWO_LEVEL_TLDS.has(lastTwo)) return labels.slice(-3).join(".");
  return lastTwo;
}

function hostOf(raw?: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : "https://" + s);
    const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    return h || null;
  } catch {
    return null;
  }
}

function sameSite(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (ipLiteral(a) || ipLiteral(b)) return false;
  return registrableDomain(a) === registrableDomain(b);
}

type HeaderGate = {
  host: string;
  allowRefererHost: string | null;
  allowCookieHost: string | null;
};

function keepReferer(value: string, gate: HeaderGate): boolean {
  if (!gate.allowRefererHost) return false;
  const vh = hostOf(value);
  if (!vh) return false;
  return (
    sameSite(vh, gate.host) &&
    sameSite(vh, gate.allowRefererHost) &&
    sameSite(gate.host, gate.allowRefererHost)
  );
}

function keepCookie(gate: HeaderGate): boolean {
  return !!gate.allowCookieHost && sameSite(gate.host, gate.allowCookieHost);
}

function filterHeaders(
  headers: Record<string, string> | undefined,
  gate: HeaderGate,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  for (const k of Object.keys(headers)) {
    const raw = headers[k];
    if (raw == null) continue;
    const low = k.toLowerCase();
    const val = String(raw);
    if (low === "referer" || low === "origin") {
      if (keepReferer(val, gate)) out[k] = val;
      continue;
    }
    if (low === "cookie") {
      if (keepCookie(gate)) out[k] = val;
      continue;
    }
    if (DENY_HEADERS.has(low)) continue;
    if (low.startsWith("x-harbor")) continue;
    if (low.startsWith("sec-")) continue;
    out[k] = val;
  }
  return out;
}

function pickHeaders(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((v, k) => {
    if (ALLOW_RESPONSE_HEADERS.has(k.toLowerCase())) out[k] = v;
  });
  return out;
}

async function readCapped(res: Response): Promise<Uint8Array> {
  const buf = await res.arrayBuffer();
  const arr = new Uint8Array(buf);
  return arr.byteLength > MAX_BYTES ? arr.subarray(0, MAX_BYTES) : arr;
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    for (let j = 0; j < slice.length; j++) bin += String.fromCharCode(slice[j]);
  }
  return btoa(bin);
}

function fromBase64(value: string): Uint8Array {
  let binary: string;
  try {
    binary = atob(value.replace(/\s/g, ""));
  } catch {
    throw new Error("invalid base64 protobuf request");
  }
  if (binary.length > MAX_BYTES) throw new Error("protobuf request exceeds 8 MB");
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function parseGrpcFrames(bytes: Uint8Array): {
  messages: string[];
  trailers: Record<string, string>;
} {
  const messages: string[] = [];
  const trailers: Record<string, string> = {};
  for (let offset = 0; offset < bytes.length;) {
    if (offset + 5 > bytes.length) throw new Error("incomplete gRPC frame header");
    const flags = bytes[offset];
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset + 1, 4).getUint32(0);
    offset += 5;
    if (offset + length > bytes.length) throw new Error("incomplete gRPC frame payload");
    const payload = bytes.subarray(offset, offset + length);
    offset += length;
    if (flags & 0x80) {
      if (flags !== 0x80) throw new Error("invalid gRPC trailer frame flags");
      for (const line of new TextDecoder().decode(payload).split(/\r?\n/)) {
        const split = line.indexOf(":");
        if (split > 0)
          trailers[line.slice(0, split).trim().toLowerCase()] = line.slice(split + 1).trim();
      }
    } else {
      if (flags > 1) throw new Error("invalid gRPC message frame flags");
      if (flags & 1) throw new Error("compressed gRPC responses are not supported");
      messages.push(toBase64(payload));
    }
  }
  return { messages, trailers };
}

export async function runPluginHttp(url: string, opts: PluginHttpOpts): Promise<PluginHttpResult> {
  const target = assertSafeUrl(url);
  const method = (opts.method || "GET").toUpperCase();
  const timeout = Math.min(Math.max(opts.timeoutMs || DEFAULT_TIMEOUT, 1_000), MAX_TIMEOUT);
  const headers = filterHeaders(opts.headers, {
    host: hostOf(target) ?? "",
    allowRefererHost: hostOf(opts.allowReferer),
    allowCookieHost: hostOf(opts.allowCookie),
  });
  if (!Object.keys(headers).some((k) => k.toLowerCase() === "user-agent")) {
    headers["User-Agent"] = PLUGIN_UA;
  }
  const init: RequestInit = {
    method,
    headers,
    redirect: "follow",
    credentials: "omit",
    signal: AbortSignal.timeout(timeout),
  };
  if (typeof opts.body === "string" && method !== "GET" && method !== "HEAD") init.body = opts.body;
  const res = await safeFetch(target, init);
  const bytes = await readCapped(res);
  const body = opts.responseType === "base64" ? toBase64(bytes) : new TextDecoder().decode(bytes);
  return { status: res.status, ok: res.ok, headers: pickHeaders(res.headers), body };
}

export async function runPluginGrpc(
  url: string,
  requestBase64: string,
  opts: PluginGrpcOpts,
): Promise<PluginGrpcResult> {
  const target = assertSafeUrl(url);
  const message = fromBase64(requestBase64);
  const frame = new Uint8Array(message.length + 5);
  new DataView(frame.buffer).setUint32(1, message.length);
  frame.set(message, 5);
  const mode = opts.mode === "grpc-web" ? "grpc-web" : "grpc";
  const contentType = mode === "grpc-web" ? "application/grpc-web+proto" : "application/grpc";
  const timeout = Math.min(Math.max(opts.timeoutMs || DEFAULT_TIMEOUT, 1_000), MAX_TIMEOUT);
  const headers = filterHeaders(opts.headers, {
    host: hostOf(target) ?? "",
    allowRefererHost: hostOf(opts.allowReferer),
    allowCookieHost: hostOf(opts.allowCookie),
  });
  if (!Object.keys(headers).some((key) => key.toLowerCase() === "content-type"))
    headers["Content-Type"] = contentType;
  if (!Object.keys(headers).some((key) => key.toLowerCase() === "accept"))
    headers.Accept = contentType;
  headers["grpc-accept-encoding"] = "identity";
  if (!Object.keys(headers).some((key) => key.toLowerCase() === "grpc-timeout"))
    headers["grpc-timeout"] = `${timeout}m`;
  if (mode === "grpc") headers.te = "trailers";
  else headers["x-grpc-web"] = "1";
  const response = await safeFetchBytes(
    target,
    {
      method: "POST",
      headers,
      body: frame,
      redirect: "follow",
      credentials: "omit",
      signal: AbortSignal.timeout(timeout),
    },
    timeout,
  );
  const parsed = parseGrpcFrames(await readCapped(response));
  const responseHeaders = pickHeaders(response.headers);
  const grpcStatusValue = parsed.trailers["grpc-status"] ?? responseHeaders["grpc-status"];
  const grpcStatus = grpcStatusValue === undefined ? undefined : Number(grpcStatusValue);
  const encodedMessage = parsed.trailers["grpc-message"] ?? responseHeaders["grpc-message"];
  let grpcMessage = encodedMessage;
  try {
    if (encodedMessage) grpcMessage = decodeURIComponent(encodedMessage);
  } catch {}
  return {
    status: response.status,
    ok: response.ok && (grpcStatus === undefined ? !!parsed.messages.length : grpcStatus === 0),
    headers: responseHeaders,
    body: parsed.messages[0] ?? "",
    messages: parsed.messages,
    trailers: parsed.trailers,
    grpcStatus: Number.isFinite(grpcStatus) ? grpcStatus : undefined,
    grpcMessage,
  };
}
