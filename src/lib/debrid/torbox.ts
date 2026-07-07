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

const BASE = "https://api.torbox.app/v1/api";
const VIDEO_EXTS = [".mkv", ".mp4", ".avi", ".m4v", ".webm", ".ts", ".mov", ".wmv"];
const POLL_DELAY_MS = 1000;
const POLL_MAX_ATTEMPTS = 30;
const LIBRARY_TTL_MS = 5 * 60_000;
const LIBRARY_CACHE = new Map<string, { at: number; data: LibraryEntry[] }>();

export function createTorbox(apiKey: string): DebridStore {
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

  async function account(signal: AbortSignal): Promise<DebridResult<Account>> {
    const r = await get<TbEnvelope<TbUser>>("/user/me", signal);
    if (!r.ok) return r;
    const d = r.data.data;
    const expiresAt = d?.premium_expires_at
      ? Math.floor(new Date(d.premium_expires_at).getTime() / 1000)
      : undefined;
    return {
      ok: true,
      data: {
        slug: "tb",
        username: d?.customer ?? d?.email,
        email: d?.email,
        premium: (d?.plan ?? 0) > 0,
        premiumUntil: expiresAt,
      },
    };
  }

  async function cacheCheckBatch(
    batch: string[],
    signal: AbortSignal,
  ): Promise<DebridResult<CacheMap>> {
    const params = new URLSearchParams();
    for (const h of batch) params.append("hash", h.toLowerCase());
    params.append("format", "object");
    params.append("list_files", "false");
    const r = await get<TbEnvelope<unknown>>(
      `/torrents/checkcached?${params.toString()}`,
      signal,
    );
    if (!r.ok) {
      dwarn("[torbox] cacheCheck batch failed", { code: r.code, status: r.status });
      return { ok: true, data: {} };
    }
    const out: CacheMap = {};
    const data = r.data?.data;
    const requested = new Set(batch.map((h) => h.toLowerCase()));

    const tag = (h: string) => {
      const lh = h.toLowerCase();
      if (requested.has(lh)) out[lh] = true;
    };

    if (data && typeof data === "object" && !Array.isArray(data)) {
      for (const key of Object.keys(data)) {
        const v = (data as Record<string, unknown>)[key];
        if (v == null || v === false) continue;
        if (typeof v === "object") {
          const itemHash = (v as { hash?: string }).hash;
          tag(itemHash ?? key);
        } else {
          tag(key);
        }
      }
    } else if (Array.isArray(data)) {
      for (const item of data) {
        const h = (item as { hash?: string })?.hash;
        if (h) tag(h);
      }
    }
    dlog(
      `[torbox] cacheCheck batch ${batch.length} → ${Object.keys(out).length} cached`,
    );
    return { ok: true, data: out };
  }

  async function cacheCheck(hashes: string[], signal: AbortSignal): Promise<DebridResult<CacheMap>> {
    if (hashes.length === 0) return { ok: true, data: {} };
    const BATCH = 25;
    const batches: string[][] = [];
    for (let i = 0; i < hashes.length; i += BATCH) {
      batches.push(hashes.slice(i, i + BATCH));
    }
    const results = await Promise.allSettled(
      batches.map((b) => cacheCheckBatch(b, signal)),
    );
    const merged: CacheMap = {};
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.ok) {
        Object.assign(merged, r.value.data);
      }
    }
    dlog(
      `[torbox] cacheCheck total ${hashes.length} hashes → ${Object.keys(merged).length} cached`,
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

    const add = await postForm<TbEnvelope<TbCreate>>(
      "/torrents/createtorrent",
      { magnet: fullMagnet, allow_zip: "false", as_queued: "false" },
      signal,
    );
    if (!add.ok) return add;
    const id = add.data.data?.torrent_id ?? add.data.data?.queued_id;
    if (!id) return { ok: false, code: "no-id", status: 0, raw: add.data };

    let info: TbTorrent | null = null;
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      if (signal.aborted) return { ok: false, code: "aborted", status: 0 };
      const r = await get<TbEnvelope<TbTorrent>>(`/torrents/mylist?id=${id}&bypass_cache=true`, signal);
      if (!r.ok) return r;
      info = r.data.data ?? null;
      if (!info) {
        await sleep(POLL_DELAY_MS, signal);
        continue;
      }
      if (info.download_finished || info.download_present) break;
      if (info.download_state === "error" || info.download_state === "stalled") {
        return { ok: false, code: info.download_state, status: 0, raw: { hash } };
      }
      await sleep(POLL_DELAY_MS, signal);
    }

    if (!info || (!info.download_finished && !info.download_present)) {
      return { ok: false, code: "still-downloading", status: 0, raw: { hash, progress: info?.progress } };
    }

    const file = pickTbFile(info.files ?? [], fileIdx, hint);
    if (!file) return { ok: false, code: "no-video-file", status: 0 };

    const dl = await get<TbEnvelope<string>>(
      `/torrents/requestdl?token=${encodeURIComponent(apiKey)}&torrent_id=${id}&file_id=${file.id}&zip_link=false`,
      signal,
    );
    if (!dl.ok) return dl;
    const url = dl.data.data;
    if (!url || typeof url !== "string") return { ok: false, code: "no-link", status: 0 };
    return {
      ok: true,
      data: {
        url,
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
    const r = await get<TbEnvelope<TbTorrent[]>>("/torrents/mylist?bypass_cache=true", signal);
    if (!r.ok) {
      dwarn("[torbox] listLibrary failed", { code: r.code, status: r.status });
      return r;
    }
    const list = r.data.data ?? [];
    const data: LibraryEntry[] = list
      .filter((t) => t.download_finished || t.download_present)
      .map((t) => ({
        slug: "tb" as const,
        id: String(t.id),
        hash: (t.hash ?? "").toLowerCase(),
        name: t.name ?? "",
        size: typeof t.size === "number" ? t.size : undefined,
        files: (t.files ?? []).map((f) => ({
          id: String(f.id),
          name: f.short_name ?? f.name ?? "",
          size: f.size ?? 0,
        })),
      }));
    dlog(`[torbox] listLibrary → ${data.length} ready torrents in your library`);
    LIBRARY_CACHE.set(apiKey, { at: Date.now(), data });
    return { ok: true, data };
  }

  async function queueCache(
    magnet: string,
    signal: AbortSignal,
  ): Promise<DebridResult<{ id: string }>> {
    const fullMagnet = magnetFromHash(magnet);
    const add = await postForm<TbEnvelope<TbCreate>>(
      "/torrents/createtorrent",
      { magnet: fullMagnet, allow_zip: "false", as_queued: "true" },
      signal,
    );
    if (!add.ok) return add;
    const id = add.data.data?.torrent_id ?? add.data.data?.queued_id;
    if (!id) return { ok: false, code: "no-id", status: 0, raw: add.data };
    LIBRARY_CACHE.delete(apiKey);
    return { ok: true, data: { id: String(id) } };
  }

  async function listTorrentFiles(hash: string, signal: AbortSignal): Promise<DebridResult<DebridFile[]>> {
    const fullMagnet = magnetFromHash(hash);
    const created = await postForm<TbEnvelope<TbCreate>>("/torrents/createtorrent", { magnet: fullMagnet, allow_zip: "false", as_queued: "false" }, signal);
    if (!created.ok) return created;
    const id = created.data.data?.torrent_id ?? created.data.data?.queued_id;
    if (id == null) return { ok: false, code: "no-id", status: 0 };

    for (let attempt = 0; attempt < 60; attempt++) {
      if (signal.aborted) return { ok: false, code: "aborted", status: 0 };
      const list = await get<TbEnvelope<TbTorrent[]>>(`/torrents/mylist?bypass_cache=true`, signal);
      if (!list.ok) return list;
      const torrent = list.data.data?.find((t) => t.id === id);
      if (torrent?.download_state === "error" || torrent?.download_state === "stalled") {
        return { ok: false, code: torrent.download_state, status: 0 };
      }
      if (torrent?.files && torrent.files.length > 0 && (torrent.download_finished || torrent.download_present)) {
        const files: DebridFile[] = [];
        for (const f of torrent.files) {
          if (signal.aborted) return { ok: false, code: "aborted", status: 0 };
          const dl = await get<TbEnvelope<string>>(
            `/torrents/requestdl?token=${encodeURIComponent(apiKey)}&torrent_id=${id}&file_id=${f.id}&zip_link=false`,
            signal,
          );
          if (!dl.ok) continue;
          const url = dl.data.data;
          if (!url || typeof url !== "string") continue;
          files.push({
            id: String(f.id),
            name: f.name ?? f.short_name ?? "",
            size: f.size ?? 0,
            url,
          });
        }
        if (files.length === 0) continue;
        return { ok: true, data: files };
      }
      await sleep(1000, signal);
    }
    return { ok: false, code: "timeout", status: 0 };
  }

  return {
    slug: "tb",
    name: "TorBox",
    account,
    cacheCheck,
    playableUrl,
    queueCache,
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
  if (res.status === 401 || res.status === 403)
    return { ok: false, code: "unauthorized", status: res.status };
  if (res.status === 402) return { ok: false, code: "not-premium", status: 402 };
  if (res.status === 429) return { ok: false, code: "rate-limited", status: 429 };
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text().catch(() => null);
    }
    const code = (body as TbError)?.detail ?? (body as TbError)?.error ?? `http-${res.status}`;
    return { ok: false, code, status: res.status, raw: body };
  }
  try {
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, code: "parse-error", status: res.status };
  }
}

function pickTbFile(files: TbFile[], fileIdx: number | undefined, hint?: EpisodeHint): TbFile | null {
  if (files.length === 0) return null;
  if (fileIdx != null && files[fileIdx]) return files[fileIdx];
  const videos = files.filter((f) =>
    VIDEO_EXTS.some((ext) => (f.short_name ?? f.name ?? "").toLowerCase().endsWith(ext)),
  );
  const pool = videos.length > 0 ? videos : files;
  const mi = matchEpisodeFileIndex(pool.map((f) => f.short_name ?? f.name ?? ""), hint);
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

type TbEnvelope<T> = {
  success: boolean;
  detail?: string;
  data?: T;
};

type TbUser = {
  id?: number;
  customer?: string;
  email?: string;
  plan?: number;
  premium_expires_at?: string;
};

type TbCreate = {
  torrent_id?: number;
  queued_id?: number;
  hash?: string;
};

type TbFile = {
  id: number;
  name?: string;
  short_name?: string;
  size?: number;
};

type TbTorrent = {
  id: number;
  hash: string;
  name?: string;
  size?: number;
  progress?: number;
  download_state?: string;
  download_finished?: boolean;
  download_present?: boolean;
  files?: TbFile[];
};

type TbError = {
  detail?: string;
  error?: string;
};
