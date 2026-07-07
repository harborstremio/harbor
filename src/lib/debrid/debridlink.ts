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

const BASE = "https://debrid-link.com/api/v2";
const VIDEO_EXTS = [".mkv", ".mp4", ".avi", ".m4v", ".webm", ".ts", ".mov", ".wmv"];
const POLL_DELAY_MS = 800;
const POLL_MAX_ATTEMPTS = 24;
const LIBRARY_TTL_MS = 5 * 60_000;
const LIBRARY_CACHE = new Map<string, { at: number; data: LibraryEntry[] }>();

export function createDebridLink(apiKey: string): DebridStore {
  const headers = (extra?: HeadersInit): HeadersInit => ({
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
    ...extra,
  });

  async function get<T>(path: string, signal: AbortSignal): Promise<DebridResult<T>> {
    return wrap<T>(() => fetch(`${BASE}${path}`, { headers: headers(), signal }));
  }

  async function postForm<T>(
    path: string,
    body: Record<string, string>,
    signal: AbortSignal,
  ): Promise<DebridResult<T>> {
    const form = new URLSearchParams(body);
    return wrap<T>(() =>
      fetch(`${BASE}${path}`, {
        method: "POST",
        headers: headers({ "Content-Type": "application/x-www-form-urlencoded" }),
        body: form.toString(),
        signal,
      }),
    );
  }

  async function delEmpty(path: string, signal: AbortSignal): Promise<void> {
    await fetch(`${BASE}${path}`, { method: "DELETE", headers: headers(), signal }).catch(() => {});
  }

  async function account(signal: AbortSignal): Promise<DebridResult<Account>> {
    const r = await get<DlEnvelope<DlUser>>("/account/infos", signal);
    if (!r.ok) return r;
    const u = r.data.value;
    const expiresAt = typeof u?.premiumLeft === "number"
      ? Math.floor(Date.now() / 1000) + u.premiumLeft
      : undefined;
    return {
      ok: true,
      data: {
        slug: "dl",
        username: u?.username,
        email: u?.email,
        premium: (u?.accountType ?? 0) > 0 || (u?.premiumLeft ?? 0) > 0,
        premiumUntil: expiresAt,
      },
    };
  }

  async function cacheCheckBatch(
    batch: string[],
    signal: AbortSignal,
  ): Promise<DebridResult<CacheMap>> {
    const r = await get<DlEnvelope<Record<string, DlCacheEntry>>>(
      `/seedbox/cached?url=${encodeURIComponent(batch.join(","))}`,
      signal,
    );
    if (!r.ok) {
      dwarn("[dl] cacheCheck batch failed", { code: r.code, status: r.status });
      return { ok: true, data: {} };
    }
    const out: CacheMap = {};
    const value = r.data.value;
    if (!value || typeof value !== "object") return { ok: true, data: out };
    for (const h of batch) {
      const entry = value[h];
      if (entry && typeof entry === "object") out[h] = true;
    }
    return { ok: true, data: out };
  }

  async function cacheCheck(hashes: string[], signal: AbortSignal): Promise<DebridResult<CacheMap>> {
    if (hashes.length === 0) return { ok: true, data: {} };
    const lower = hashes.map((h) => h.toLowerCase());
    const BATCH = 20;
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
      `[dl] cacheCheck total ${hashes.length} hashes → ${Object.keys(merged).length} cached`,
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
    const hash = hashFromMagnet(magnet);

    const add = await postForm<DlEnvelope<DlSeedbox>>(
      "/seedbox/add",
      { url: fullMagnet, async: "true" },
      signal,
    );
    if (!add.ok) return add;
    const id = add.data.value?.id;
    if (!id) return { ok: false, code: "no-id", status: 0, raw: add.data };

    let info: DlSeedbox | null = add.data.value ?? null;

    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      if (signal.aborted) {
        await delEmpty(`/seedbox/${id}/remove`, signal);
        return { ok: false, code: "aborted", status: 0 };
      }
      const r = await get<DlEnvelope<DlSeedbox>>(`/seedbox/list?ids=${encodeURIComponent(id)}`, signal);
      if (!r.ok) return r;
      const arr = (r.data.value as unknown as DlSeedbox[]) ?? [];
      info = Array.isArray(arr) ? arr[0] ?? null : (r.data.value as DlSeedbox);
      if (!info) {
        await sleep(POLL_DELAY_MS, signal);
        continue;
      }
      if (info.status === 6 || info.downloadPercent === 100) break;
      if (info.status === 100) {
        await delEmpty(`/seedbox/${id}/remove`, signal);
        return { ok: false, code: "error", status: 0, raw: { hash } };
      }
      await sleep(POLL_DELAY_MS, signal);
    }

    if (!info || (info.status !== 6 && info.downloadPercent !== 100)) {
      await delEmpty(`/seedbox/${id}/remove`, signal);
      return { ok: false, code: "not-cached", status: 0, raw: { hash, progress: info?.downloadPercent } };
    }

    const file = pickDlFile(info.files ?? [], fileIdx, hint);
    if (!file) return { ok: false, code: "no-video-file", status: 0 };
    if (!file.downloadUrl) return { ok: false, code: "no-link", status: 0 };

    return {
      ok: true,
      data: {
        url: file.downloadUrl,
        filename: file.name,
        filesize: file.size,
      },
    };
  }

  async function listLibrary(signal: AbortSignal): Promise<DebridResult<LibraryEntry[]>> {
    const cached = LIBRARY_CACHE.get(apiKey);
    if (cached && Date.now() - cached.at < LIBRARY_TTL_MS) {
      return { ok: true, data: cached.data };
    }
    const all: DlSeedbox[] = [];
    for (let page = 0; page < 5; page++) {
      const r = await get<DlEnvelope<DlSeedbox[]>>(`/seedbox/list?perPage=50&page=${page}`, signal);
      if (!r.ok) break;
      const items = r.data.value ?? [];
      if (!Array.isArray(items) || items.length === 0) break;
      all.push(...items);
      if (items.length < 50) break;
    }
    const data: LibraryEntry[] = all
      .filter((t) => t.status === 6 || t.downloadPercent === 100)
      .map((t) => ({
        slug: "dl" as const,
        id: t.id,
        hash: (t.hashString ?? "").toLowerCase(),
        name: t.name ?? "",
        size: t.totalSize,
        files: (t.files ?? []).map((f) => ({
          id: f.id,
          name: f.name,
          size: f.size,
        })),
      }))
      .filter((e) => e.hash);
    LIBRARY_CACHE.set(apiKey, { at: Date.now(), data });
    return { ok: true, data };
  }

  async function listTorrentFiles(hash: string, signal: AbortSignal): Promise<DebridResult<DebridFile[]>> {
    const fullMagnet = magnetFromHash(hash);
    const add = await postForm<DlEnvelope<{ id: string }>>("/seedbox/add", { url: fullMagnet, async: "true" }, signal);
    if (!add.ok) return add;
    const id = add.data.value.id;

    for (let attempt = 0; attempt < 24; attempt++) {
      if (signal.aborted) {
        await delEmpty(`/seedbox/${id}/remove`, signal);
        return { ok: false, code: "aborted", status: 0 };
      }
      const list = await get<DlEnvelope<DlSeedbox[]>>(`/seedbox/list?ids=${encodeURIComponent(id)}`, signal);
      if (!list.ok) return list;
      const seedbox = list.data.value?.[0];
      if (seedbox?.files && seedbox.files.length > 0) {
        if (seedbox.status === 6 || seedbox.downloadPercent === 100) {
          return {
            ok: true,
            data: seedbox.files.map((f, i) => ({
              id: String(i),
              name: f.name,
              size: f.size,
              url: f.downloadUrl,
            })),
          };
        }
      }
      await sleep(800, signal);
    }
    await delEmpty(`/seedbox/${id}/remove`, signal);
    return { ok: false, code: "timeout", status: 0 };
  }

  return {
    slug: "dl",
    name: "Debrid-Link",
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
  if (res.status === 401 || res.status === 403) {
    let body: unknown;
    try { body = await res.json(); } catch { body = await res.text().catch(() => null); }
    const errMsg = (body as DlError)?.error ?? (body as DlError)?.message ?? "";
    const code = /subscription|premium/i.test(errMsg) ? "not-premium" : "unauthorized";
    return { ok: false, code, status: res.status, raw: body };
  }
  if (res.status === 402) return { ok: false, code: "not-premium", status: 402 };
  if (res.status === 429) return { ok: false, code: "rate-limited", status: 429 };
  if (res.status === 503 || res.status === 504)
    return { ok: false, code: "upstream-unavailable", status: res.status };
  if (res.status === 204) return { ok: true, data: undefined as unknown as T };
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text().catch(() => null);
    }
    const errMsg = (body as DlError)?.error ?? (body as DlError)?.message ?? "";
    if (/subscription|premium/i.test(errMsg)) {
      return { ok: false, code: "not-premium", status: res.status, raw: body };
    }
    const code = (body as DlError)?.error ?? `http-${res.status}`;
    return { ok: false, code, status: res.status, raw: body };
  }
  try {
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, code: "parse-error", status: res.status };
  }
}

function pickDlFile(files: DlFile[], fileIdx: number | undefined, hint?: EpisodeHint): DlFile | null {
  if (files.length === 0) return null;
  if (fileIdx != null && files[fileIdx]) return files[fileIdx];
  const videos = files.filter((f) =>
    VIDEO_EXTS.some((ext) => (f.name ?? "").toLowerCase().endsWith(ext)),
  );
  const pool = videos.length > 0 ? videos : files;
  const mi = matchEpisodeFileIndex(pool.map((f) => f.name ?? ""), hint);
  if (mi >= 0) return pool[mi];
  return pool.slice().sort((a, b) => (b.size ?? 0) - (a.size ?? 0))[0] ?? null;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });
}

type DlEnvelope<T> = {
  success: boolean;
  value: T;
  error?: string;
};

type DlUser = {
  username?: string;
  email?: string;
  accountType?: number;
  premiumLeft?: number;
};

type DlCacheEntry = {
  name?: string;
  hash?: string;
};

type DlFile = {
  id: string;
  name: string;
  size: number;
  downloadUrl?: string;
};

type DlSeedbox = {
  id: string;
  name?: string;
  hashString?: string;
  totalSize?: number;
  status?: number;
  downloadPercent?: number;
  files?: DlFile[];
};

type DlError = {
  error?: string;
  message?: string;
};
