import type { EpgChannelMeta, EpgProgram, XmltvParseResult } from "./types";

const MAX_BYTES = 200 * 1024 * 1024;
const CONNECT_TIMEOUT_MS = 30_000;
const STALL_TIMEOUT_MS = 25_000;

async function iptvFetch(url: string, signal: AbortSignal): Promise<Response> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    try {
      return await tauriFetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "VLC/3.0.20 LibVLC/3.0.20",
          Accept: "application/xml, text/xml, application/octet-stream, */*",
        },
        connectTimeout: CONNECT_TIMEOUT_MS,
        maxRedirections: 5,
        signal,
      } as unknown as RequestInit);
    } catch (e) {
      if (!/scope|not allowed/i.test(String(e))) throw e;
      const { safeFetch } = await import("@/lib/safe-fetch");
      return safeFetch(url, {
        signal,
        headers: {
          "User-Agent": "VLC/3.0.20 LibVLC/3.0.20",
          Accept: "application/xml, text/xml, application/octet-stream, */*",
        },
      });
    }
  }
  return fetch(url, { cache: "no-store", signal });
}

export async function fetchAndParseXmltv(
  url: string,
  onProgress?: (programs: EpgProgram[], channelMeta: Map<string, EpgChannelMeta>) => void,
): Promise<XmltvParseResult> {
  const ac = new AbortController();
  let stallTimer: ReturnType<typeof setTimeout> | null = null;
  const armStall = () => {
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      console.warn(`[epg] stalled for ${STALL_TIMEOUT_MS}ms, aborting ${url}`);
      ac.abort();
    }, STALL_TIMEOUT_MS);
  };
  armStall();
  console.info(`[epg] GET ${url}`);
  try {
    const res = await iptvFetch(url, ac.signal);
    armStall();
    if (!res.ok) throw new Error(`EPG fetch failed: ${res.status} ${res.statusText}`);
    console.info(
      `[epg] response status=${res.status} type=${res.headers.get("content-type") ?? "?"} len=${res.headers.get("content-length") ?? "?"} enc=${res.headers.get("content-encoding") ?? "none"}`,
    );
    const rawReader = res.body?.getReader();
    if (!rawReader) {
      const text = await res.text();
      console.info(`[epg] non-stream body head: ${text.slice(0, 200).replace(/\s+/g, " ")}`);
      const out = parseXmltv(text);
      console.info(`[epg] parsed ${out.programs.length} programs (non-stream) from ${url}`);
      return out;
    }
    let received = 0;
    const first = await rawReader.read();
    armStall();
    let reader = rawReader;
    if (!first.done && first.value) {
      received += first.value.byteLength;
      if (first.value[0] === 0x1f && first.value[1] === 0x8b) {
        console.info("[epg] gzip payload detected, inflating");
        const firstChunk = first.value;
        reader = new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(firstChunk);
          },
          async pull(c) {
            const { value, done } = await rawReader.read();
            armStall();
            if (done) {
              c.close();
              return;
            }
            if (value) {
              received += value.byteLength;
              if (received > MAX_BYTES) {
                c.error(new Error("EPG exceeds 200MB limit"));
                return;
              }
              c.enqueue(value);
            }
          },
        })
          .pipeThrough(new DecompressionStream("gzip"))
          .getReader();
      }
    }
    const passthrough = reader === rawReader;
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let lastLog = Date.now();
    let headLogged = false;
    const startedAt = Date.now();
    const out: EpgProgram[] = [];
    const channelMeta = new Map<string, EpgChannelMeta>();
    if (passthrough && !first.done && first.value) {
      buffer += decoder.decode(first.value, { stream: true });
    }
    while (true) {
      const { value, done } = await reader.read();
      armStall();
      if (done) break;
      if (!value) continue;
      if (passthrough) {
        received += value.byteLength;
        if (received > MAX_BYTES) throw new Error("EPG exceeds 200MB limit");
      }
      buffer += decoder.decode(value, { stream: true });
      if (!headLogged && buffer.length >= 200) {
        headLogged = true;
        console.info(`[epg] body head: ${buffer.slice(0, 200).replace(/\s+/g, " ")}`);
      }
      const prevLen = out.length;
      buffer = drainBlocks(buffer, out, channelMeta);
      const now = Date.now();
      if (now - lastLog > 3000) {
        const mb = (received / 1024 / 1024).toFixed(1);
        const sec = ((now - startedAt) / 1000).toFixed(1);
        console.info(`[epg] downloading… ${mb}MB · ${out.length} programs · ${sec}s`);
        lastLog = now;
        if (onProgress && out.length > prevLen) onProgress(out.slice(prevLen), channelMeta);
      }
    }
    buffer += decoder.decode();
    drainBlocks(buffer, out, channelMeta);
    const totalSec = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.info(`[epg] parsed ${out.length} programs, ${channelMeta.size} channel defs, ${(received / 1024 / 1024).toFixed(1)}MB in ${totalSec}s from ${url}`);
    return { programs: out, channelMeta };
  } finally {
    if (stallTimer) clearTimeout(stallTimer);
  }
}

export function parseXmltv(text: string): XmltvParseResult {
  const programs: EpgProgram[] = [];
  const channelMeta = new Map<string, EpgChannelMeta>();
  drainBlocks(text, programs, channelMeta);
  return { programs, channelMeta };
}

function drainBlocks(
  buffer: string,
  out: EpgProgram[],
  channelMeta: Map<string, EpgChannelMeta>,
): string {
  while (true) {
    const chIdx = buffer.indexOf("<channel ");
    const prIdx = buffer.indexOf("<programme");
    if (chIdx < 0 && prIdx < 0) return trimLeftover(buffer);
    const channelFirst = chIdx >= 0 && (prIdx < 0 || chIdx < prIdx);
    if (channelFirst) {
      const close = buffer.indexOf("</channel>", chIdx);
      if (close < 0) return buffer.slice(chIdx);
      const block = buffer.slice(chIdx, close + "</channel>".length);
      parseChannel(block, channelMeta);
      buffer = buffer.slice(close + "</channel>".length);
      continue;
    }
    const closeOpen = buffer.indexOf(">", prIdx);
    if (closeOpen < 0) return buffer.slice(prIdx);
    const endIdx = buffer.indexOf("</programme>", closeOpen);
    if (endIdx < 0) return buffer.slice(prIdx);
    const block = buffer.slice(prIdx, endIdx + "</programme>".length);
    const prog = parseProgramme(block);
    if (prog) out.push(prog);
    buffer = buffer.slice(endIdx + "</programme>".length);
  }
}

function trimLeftover(buffer: string): string {
  return buffer.length > 64 ? buffer.slice(-64) : buffer;
}

function parseChannel(block: string, channelMeta: Map<string, EpgChannelMeta>): void {
  const id = attr(block, "id");
  if (!id) return;
  const displayName = childText(block, "display-name");
  const icon = childAttr(block, "icon", "src");
  if (channelMeta.has(id) && !displayName && !icon) return;
  channelMeta.set(id, { displayName, icon });
}

function parseProgramme(block: string): EpgProgram | null {
  const start = attr(block, "start");
  const stop = attr(block, "stop");
  const channel = attr(block, "channel");
  if (!start || !stop || !channel) return null;
  const startMs = parseXmltvTime(start);
  const endMs = parseXmltvTime(stop);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  return {
    channelTvgId: channel,
    title: childText(block, "title") || "Untitled",
    description: childText(block, "desc"),
    category: childText(block, "category"),
    iconUrl: childAttr(block, "icon", "src"),
    startMs,
    endMs,
  };
}

function attr(block: string, name: string): string | null {
  const re = new RegExp(`\\b${name}="([^"]*)"`);
  const m = block.match(re);
  return m ? m[1] : null;
}

function childText(block: string, tag: string): string | null {
  const open = block.indexOf(`<${tag}`);
  if (open < 0) return null;
  const openClose = block.indexOf(">", open);
  if (openClose < 0) return null;
  const closeTag = `</${tag}>`;
  const close = block.indexOf(closeTag, openClose);
  if (close < 0) return null;
  const raw = block.slice(openClose + 1, close);
  return decode(stripCdata(raw)).trim() || null;
}

function childAttr(block: string, tag: string, attrName: string): string | null {
  const open = block.indexOf(`<${tag}`);
  if (open < 0) return null;
  const openClose = block.indexOf(">", open);
  if (openClose < 0) return null;
  const head = block.slice(open, openClose);
  const re = new RegExp(`\\b${attrName}="([^"]*)"`);
  const m = head.match(re);
  return m ? m[1] : null;
}

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, inner: string) => inner);
}

function decode(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

export function parseXmltvTime(s: string): number {
  const m = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/);
  if (!m) return Number.NaN;
  const [, y, mo, d, h, mi, sec, tz] = m;
  let offsetMin = 0;
  if (tz) {
    const sign = tz[0] === "-" ? -1 : 1;
    const hh = Number(tz.slice(1, 3));
    const mm = Number(tz.slice(3, 5));
    offsetMin = sign * (hh * 60 + mm);
  }
  const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(sec));
  return utc - offsetMin * 60 * 1000;
}

export function indexProgramsByChannel(programs: EpgProgram[]): Map<string, EpgProgram[]> {
  const map = new Map<string, EpgProgram[]>();
  for (const p of programs) {
    const arr = map.get(p.channelTvgId);
    if (arr) arr.push(p);
    else map.set(p.channelTvgId, [p]);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => a.startMs - b.startMs);
  }
  return map;
}

export function findCurrent(arr: EpgProgram[] | undefined, nowMs: number): {
  current: EpgProgram | null;
  next: EpgProgram | null;
} {
  if (!arr || arr.length === 0) return { current: null, next: null };
  let lo = 0;
  let hi = arr.length - 1;
  let foundIdx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const p = arr[mid];
    if (nowMs < p.startMs) hi = mid - 1;
    else if (nowMs >= p.endMs) lo = mid + 1;
    else {
      foundIdx = mid;
      break;
    }
  }
  if (foundIdx < 0) {
    return { current: null, next: arr[lo] ?? null };
  }
  return { current: arr[foundIdx], next: arr[foundIdx + 1] ?? null };
}
