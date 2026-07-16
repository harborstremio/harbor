import { safeFetch } from "@/lib/safe-fetch";
import type { SkipSegment } from "./types";

const CORPUS_URL = (import.meta.env.VITE_AD_CORPUS_URL as string | undefined) || "";
const CORPUS_PUBKEY = "yszDA2+G0Rtep39h67iuhl8+5pCQkM+O4D4pMnpg4Ks=";

type CorpusEntry = {
  content: string;
  source: string;
  ranges: Array<{ start: number; end: number }>;
};

let entriesCache: CorpusEntry[] | null = null;
let inflight: Promise<CorpusEntry[]> | null = null;

export async function fetchAdSegments(
  content: string,
  source: string,
  fresh = false,
): Promise<SkipSegment[]> {
  if (!content) return [];
  if (!source.startsWith("ih_") && !source.startsWith("rg_")) return [];
  const entries = await loadCorpus(fresh);
  return entries
    .filter((e) => e.content === content && e.source === source)
    .flatMap((e) => e.ranges)
    .map((r) => ({
      kind: "ad" as const,
      startSec: r.start,
      endSec: r.end,
      source: "adcorpus" as const,
    }))
    .filter((s) => Number.isFinite(s.startSec) && s.endSec > s.startSec);
}

async function loadCorpus(fresh = false): Promise<CorpusEntry[]> {
  if (!CORPUS_URL) return [];
  if (!fresh && entriesCache) return entriesCache;
  if (inflight) return inflight;
  inflight = (async () => {
    const loaded = await load().catch(() => [] as CorpusEntry[]);
    entriesCache = loaded;
    inflight = null;
    return loaded;
  })();
  return inflight;
}

async function load(): Promise<CorpusEntry[]> {
  if (!CORPUS_URL || !CORPUS_PUBKEY) return [];
  const res = await safeFetch(CORPUS_URL);
  const signed = (await res.json()) as { payload?: string; sig?: string };
  if (!signed.payload || !signed.sig) return [];
  if (!(await verify(signed.payload, signed.sig))) return [];
  const parsed = JSON.parse(signed.payload) as unknown;
  return Array.isArray(parsed) ? (parsed as CorpusEntry[]) : [];
}

async function verify(payload: string, sigB64: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      b64(CORPUS_PUBKEY),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      "Ed25519",
      key,
      b64(sigB64),
      new TextEncoder().encode(payload),
    );
  } catch {
    return false;
  }
}

function b64(value: string): Uint8Array<ArrayBuffer> {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
