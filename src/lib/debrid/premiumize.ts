import { safeFetch as fetch } from "@/lib/safe-fetch";
import { dlog, dwarn } from "@/lib/debug";
import { matchEpisodeFileIndex, type EpisodeHint } from "@/lib/streams/episode-file";
import {
  hashFromMagnet,
  magnetFromHash,
  type Account,
  type CacheMap,
  type DebridFile,
  type DebridResult,
  type DebridStore,
  type DirectLink,
  type LibraryEntry,
} from "./types";

const BASE = "https://www.premiumize.me/api";
const VIDEO_EXTS = [".mkv", ".mp4", ".avi", ".m4v", ".webm", ".ts", ".mov", ".wmv"];
const LIBRARY_TTL_MS = 5 * 60_000;
const LIBRARY_CACHE = new Map<string, { at: number; data: LibraryEntry[] }>();

export function createPremiumize(apiKey: string): DebridStore {
  const withKey = (path: string): string => {
    const sep = path.includes("?") ? "&" : "?";
    return `${BASE}${path}${sep}apikey=${encodeURIComponent(apiKey)}`;
  };

  async function get<T>(path: string, signal: AbortSignal): Promise<DebridResult<T>> {
    return wrap<T>(() => fetch(withKey(path), { headers: { Accept: "application/json" }, signal }));
  }

  async function postForm<T>(
    path: string,
    body: Record<string, string | string[]>,
    signal: AbortSignal,
  ): Promise<DebridResult<T>> {
    const form = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) {
      if (Array.isArray(v)) for (const item of v) form.append(k, item);
      else form.append(k, v);
    }
    return wrap<T>(() =>
      fetch(withKey(path), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
        signal,
      }),
    );
  }

  async function account(signal: AbortSignal): Promise<DebridResult<Account>> {
    const r = await get<PmAccountInfo>("/account/info", signal);
    if (!r.ok) return r;
    return {
      ok: true,
      data: {
        slug: "pm",
        username: r.data.customer_id ? String(r.data.customer_id) : undefined,
        premium: typeof r.data.premium_until === "number" && r.data.premium_until * 1000 > Date.now(),
        premiumUntil: r.data.premium_until,
      },
    };
  }

  async function cacheCheckBatch(
    batch: string[],
    signal: AbortSignal,
  ): Promise<DebridResult<CacheMap>> {
    const params = new URLSearchParams();
    for (const h of batch) params.append("items[]", h);
    const r = await get<PmCacheCheck>(`/cache/check?${params.toString()}`, signal);
    if (!r.ok) {
      dwarn("[pm] cacheCheck batch failed", { code: r.code, status: r.status });
      return { ok: true, data: {} };
    }
    const out: CacheMap = {};
    const responses = r.data.response ?? [];
    for (let i = 0; i < batch.length; i++) {
      if (responses[i] === true) out[batch[i]] = true;
    }
    return { ok: true, data: out };
  }

  async function cacheCheck(hashes: string[], signal: AbortSignal): Promise<DebridResult<CacheMap>> {
    if (hashes.length === 0) return { ok: true, data: {} };
    const lower = hashes.map((h) => h.toLowerCase());
    const BATCH = 100;
    const batches: string[][] = [];
    for (let i = 0; i < lower.length; i += BATCH) {
      batches.push(lower.slice(i, i + BATCH));
    }
    const results = await Promise.allSettled(batches.map((b) => cacheCheckBatch(b, signal)));
    const merged: CacheMap = {};
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.ok) Object.assign(merged, r.value.data);
    }
    dlog(
      `[pm] cacheCheck total ${hashes.length} hashes → ${Object.keys(merged).length} cached`,
    );
    return { ok: true, data: merged };
  }

  async function playableUrl(
    magnet: string,
    fileIdx: number | undefined,
    signal: AbortSignal,
    hint?: EpisodeHint,
  ): Promise<DebridResult<DirectLink>> {
    const fullMagnet = magnetFromHash(magnet);
    const direct = await postForm<PmDirectDl>("/transfer/directdl", { src: fullMagnet }, signal);
    if (!direct.ok) return direct;
    const content = direct.data.content ?? [];
    if (content.length === 0) {
      return { ok: false, code: "not-cached", status: 0, raw: { hash: hashFromMagnet(magnet) } };
    }
    const file = pickPmFile(content, fileIdx, hint);
    if (!file) return { ok: false, code: "no-video-file", status: 0 };
    const url =
      file.transcode_status === "finished" && file.stream_link ? file.stream_link : file.link;
    if (!url) return { ok: false, code: "no-link", status: 0 };
    return {
      ok: true,
      data: {
        url,
        filename: file.path?.split("/").pop(),
        filesize: typeof file.size === "string" ? Number(file.size) : file.size,
      },
    };
  }

  async function listLibrary(signal: AbortSignal): Promise<DebridResult<LibraryEntry[]>> {
    const cached = LIBRARY_CACHE.get(apiKey);
    if (cached && Date.now() - cached.at < LIBRARY_TTL_MS) {
      return { ok: true, data: cached.data };
    }
    const r = await get<{ status: string; transfers: PmTransfer[] }>("/transfer/list", signal);
    if (!r.ok) return r;
    const list = r.data.transfers ?? [];
    const data: LibraryEntry[] = list
      .filter((t) => t.status === "finished" || t.status === "seeding")
      .map((t) => ({
        slug: "pm" as const,
        id: String(t.id),
        hash: "",
        name: t.name ?? "",
      }));
    LIBRARY_CACHE.set(apiKey, { at: Date.now(), data });
    return { ok: true, data };
  }

  async function listTorrentFiles(hash: string, signal: AbortSignal): Promise<DebridResult<DebridFile[]>> {
    const fullMagnet = magnetFromHash(hash);
    const dl = await postForm<PmDirectDl>("/transfer/directdl", { src: fullMagnet }, signal);
    if (!dl.ok) return dl;
    const content = dl.data.content ?? [];
    if (content.length === 0) return { ok: false, code: "not-cached", status: 0 };
    return {
      ok: true,
      data: content.map((f, i) => ({
        id: String(i),
        name: f.path?.split("/").pop() ?? f.path ?? `file-${i}`,
        size: typeof f.size === "string" ? parseInt(f.size, 10) || 0 : (f.size ?? 0),
        url: f.link,
      })),
    };
  }

  return {
    slug: "pm",
    name: "Premiumize",
    account,
    cacheCheck,
    playableUrl,
    listLibrary,
    listTorrentFiles,
  };
}

async function wrap<T>(call: () => Promise<Response>): Promise<DebridResult<T>> {
  let res: Response;
  try {
    res = await call();
  } catch (err: any) {
    if (err?.name === "AbortError") return { ok: false, code: "aborted", status: 0 };
    return { ok: false, code: "network-error", status: 0, raw: err };
  }
  if (res.status === 429) return { ok: false, code: "rate-limited", status: 429 };
  if (!res.ok) {
    let body: unknown;
    try { body = await res.json(); } catch { body = await res.text().catch(() => null); }
    return { ok: false, code: `http-${res.status}`, status: res.status, raw: body };
  }
  let body: PmEnvelope & T;
  try {
    body = (await res.json()) as PmEnvelope & T;
  } catch {
    return { ok: false, code: "parse-error", status: res.status };
  }
  if (body.status === "error") {
    const msg = (body.message ?? "").toLowerCase();
    let code = "pm-error";
    if (msg.includes("not_logged_in") || msg.includes("invalid api")) code = "unauthorized";
    else if (msg.includes("not_premium") || msg.includes("expired")) code = "not-premium";
    else if (msg.includes("rate")) code = "rate-limited";
    return { ok: false, code, status: res.status, raw: body };
  }
  return { ok: true, data: body as T };
}

function pickPmFile(content: PmFile[], fileIdx: number | undefined, hint?: EpisodeHint): PmFile | null {
  if (content.length === 0) return null;
  if (fileIdx != null && content[fileIdx]) return content[fileIdx];
  const videos = content.filter((f) =>
    VIDEO_EXTS.some((ext) => (f.path ?? "").toLowerCase().endsWith(ext)),
  );
  const pool = videos.length > 0 ? videos : content;
  const mi = matchEpisodeFileIndex(pool.map((f) => f.path ?? ""), hint);
  if (mi >= 0) return pool[mi];
  return pool
    .slice()
    .sort((a, b) => Number(b.size ?? 0) - Number(a.size ?? 0))[0];
}

type PmEnvelope = {
  status?: "success" | "error";
  message?: string;
};

type PmAccountInfo = {
  customer_id?: number | string;
  premium_until?: number;
  limit_used?: number;
  space_used?: number;
};

type PmCacheCheck = {
  response?: boolean[];
  transcoded?: boolean[];
  filename?: string[];
  filesize?: Array<string | number>;
};

type PmFile = {
  path?: string;
  size?: number | string;
  link?: string;
  stream_link?: string;
  transcode_status?: string;
};

type PmDirectDl = {
  location?: string;
  filename?: string;
  filesize?: number | string;
  content?: PmFile[];
};

type PmTransfer = {
  id: number | string;
  name?: string;
  status?: string;
  progress?: number;
  folder_id?: string;
  file_id?: string;
};
