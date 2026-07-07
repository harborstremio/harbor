import { safeFetch as fetch } from "@/lib/safe-fetch";
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

const BASE = "https://api.real-debrid.com/rest/1.0";
const VIDEO_EXTS = [".mkv", ".mp4", ".avi", ".m4v", ".webm", ".ts", ".mov", ".wmv"];
const POLL_DELAY_MS = 600;
const POLL_MAX_ATTEMPTS = 18;
const LIBRARY_TTL_MS = 5 * 60_000;
const LIBRARY_CACHE = new Map<string, { at: number; data: LibraryEntry[] }>();

export function createRealDebrid(apiKey: string): DebridStore {
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
    const r = await get<RdUser>("/user", signal);
    if (!r.ok) return r;
    const expiresAt = r.data.expiration ? Math.floor(new Date(r.data.expiration).getTime() / 1000) : undefined;
    return {
      ok: true,
      data: {
        slug: "rd",
        username: r.data.username,
        email: r.data.email,
        premium: (r.data.premium ?? 0) > 0,
        premiumUntil: expiresAt,
      },
    };
  }

  async function cacheCheckBatch(
    _batch: string[],
    _signal: AbortSignal,
  ): Promise<DebridResult<CacheMap>> {
    return { ok: true, data: {} };
  }

  async function cacheCheck(hashes: string[], signal: AbortSignal): Promise<DebridResult<CacheMap>> {
    void hashes;
    void signal;
    void cacheCheckBatch;
    return { ok: true, data: {} };
  }

  async function playableUrl(
    magnet: string,
    fileIdx: number | undefined,
    signal: AbortSignal,
    hint?: EpisodeHint,
  ): Promise<DebridResult<DirectLink>> {
    const hash = hashFromMagnet(magnet);
    const fullMagnet = magnetFromHash(magnet);

    const add = await postForm<{ id: string }>("/torrents/addMagnet", { magnet: fullMagnet }, signal);
    if (!add.ok) return add;
    const id = add.data.id;

    let info: DebridResult<RdTorrentInfo> | null = null;
    let selected = false;
    let effIdx = fileIdx;
    const ensureIdx = (files: RdFile[]): number | undefined => {
      if (effIdx == null && hint) {
        const mi = matchEpisodeFileIndex(files.map((f) => f.path), hint);
        if (mi >= 0) effIdx = mi;
      }
      return effIdx;
    };

    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      if (signal.aborted) {
        await delEmpty(`/torrents/delete/${id}`, signal);
        return { ok: false, code: "aborted", status: 0 };
      }
      info = await get<RdTorrentInfo>(`/torrents/info/${id}`, signal);
      if (!info.ok) return info;
      const status = info.data.status;
      if (status === "magnet_error") {
        await delEmpty(`/torrents/delete/${id}`, signal);
        return { ok: false, code: "magnet-error", status: 0 };
      }
      if ((status === "magnet_conversion" || status === "waiting_files_selection") && !selected) {
        const fileIds = pickRdFiles(info.data.files, ensureIdx(info.data.files));
        if (fileIds.length === 0) {
          await delEmpty(`/torrents/delete/${id}`, signal);
          return { ok: false, code: "no-video-file", status: 0 };
        }
        const sel = await postForm(`/torrents/selectFiles/${id}`, { files: fileIds.join(",") }, signal);
        if (!sel.ok) return sel;
        selected = true;
        await sleep(POLL_DELAY_MS, signal);
        continue;
      }
      if (status === "downloaded") break;
      if (status === "downloading" || status === "queued") {
        await delEmpty(`/torrents/delete/${id}`, signal);
        return { ok: false, code: "not-cached", status: 0, raw: { hash, progress: info.data.progress } };
      }
      if (status === "error" || status === "virus" || status === "dead") {
        await delEmpty(`/torrents/delete/${id}`, signal);
        return { ok: false, code: status, status: 0 };
      }
      await sleep(POLL_DELAY_MS, signal);
    }

    if (!info?.ok || info.data.status !== "downloaded") {
      await delEmpty(`/torrents/delete/${id}`, signal);
      return { ok: false, code: "timeout", status: 0 };
    }

    const links = info.data.links ?? [];
    if (links.length === 0) return { ok: false, code: "no-link", status: 0 };
    const linkIdx = pickLinkIndex(info.data.files, ensureIdx(info.data.files ?? []), links.length);
    const link = links[linkIdx];

    const u = await postForm<RdUnrestrict>("/unrestrict/link", { link }, signal);
    if (!u.ok) return u;
    return {
      ok: true,
      data: {
        url: u.data.download,
        filename: u.data.filename,
        filesize: u.data.filesize,
      },
    };
  }

  async function listLibrary(signal: AbortSignal): Promise<DebridResult<LibraryEntry[]>> {
    const cached = LIBRARY_CACHE.get(apiKey);
    if (cached && Date.now() - cached.at < LIBRARY_TTL_MS) {
      return { ok: true, data: cached.data };
    }
    const all: RdTorrentSummary[] = [];
    for (let page = 1; page <= 5; page++) {
      const r = await get<RdTorrentSummary[]>(`/torrents?limit=100&page=${page}`, signal);
      if (!r.ok) break;
      if (r.data.length === 0) break;
      all.push(...r.data);
      if (r.data.length < 100) break;
    }
    const data: LibraryEntry[] = all
      .filter((t) => t.status === "downloaded")
      .map((t) => ({
        slug: "rd" as const,
        id: t.id,
        hash: t.hash.toLowerCase(),
        name: t.filename,
        size: t.bytes,
      }));
    LIBRARY_CACHE.set(apiKey, { at: Date.now(), data });
    return { ok: true, data };
  }

  async function listTorrentFiles(hash: string, signal: AbortSignal): Promise<DebridResult<DebridFile[]>> {
    const fullMagnet = magnetFromHash(hash);
    const add = await postForm<{ id: string }>("/torrents/addMagnet", { magnet: fullMagnet }, signal);
    if (!add.ok) return add;
    const id = add.data.id;

    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      if (signal.aborted) {
        await delEmpty(`/torrents/delete/${id}`, signal);
        return { ok: false, code: "aborted", status: 0 };
      }
      const info = await get<RdTorrentInfo>(`/torrents/info/${id}`, signal);
      if (!info.ok) return info;
      const status = info.data.status;
      if (status === "magnet_error") {
        await delEmpty(`/torrents/delete/${id}`, signal);
        return { ok: false, code: "magnet-error", status: 0 };
      }
      if (status === "magnet_conversion" || status === "waiting_files_selection") {
        const files = info.data.files ?? [];
        const videoIds = files
          .filter((f) => VIDEO_EXTS.some((ext) => f.path.toLowerCase().endsWith(ext)))
          .map((f) => f.id);
        const sel = await postForm(`/torrents/selectFiles/${id}`, { files: videoIds.join(",") }, signal);
        if (!sel.ok) return sel;
        continue;
      }
      if (status === "downloaded") {
        const files = info.data.files ?? [];
        const selected = files.filter((f) => f.selected === 1);
        const links = info.data.links ?? [];
        const result: DebridFile[] = [];
        for (let i = 0; i < selected.length; i++) {
          if (signal.aborted) {
            await delEmpty(`/torrents/delete/${id}`, signal);
            return { ok: false, code: "aborted", status: 0 };
          }
          const link = links[i];
          if (!link) continue;
          const u = await postForm<RdUnrestrict>("/unrestrict/link", { link }, signal);
          if (!u.ok) continue;
          const f = selected[i];
          result.push({
            id: String(f.id),
            name: f.path.split("/").pop() ?? f.path,
            size: f.bytes,
            url: u.data.download,
          });
        }
        if (result.length === 0) continue;
        return { ok: true, data: result };
      }
      if (status === "downloading" || status === "compressing" || status === "uploading") {
        await sleep(POLL_DELAY_MS, signal);
        continue;
      }
      if (status === "error" || status === "virus" || status === "dead") {
        await delEmpty(`/torrents/delete/${id}`, signal);
        return { ok: false, code: status, status: 0 };
      }
      await sleep(POLL_DELAY_MS, signal);
    }
    await delEmpty(`/torrents/delete/${id}`, signal);
    return { ok: false, code: "timeout", status: 0 };
  }

  return {
    slug: "rd",
    name: "Real-Debrid",
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
    const errMsg = (body as RdErrorBody)?.error ?? "";
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
    const code = (body as RdErrorBody)?.error ?? `http-${res.status}`;
    return { ok: false, code, status: res.status, raw: body };
  }
  try {
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, code: "parse-error", status: res.status };
  }
}

function pickRdFiles(files: RdFile[], fileIdx: number | undefined): number[] {
  if (fileIdx != null && files[fileIdx]) return [files[fileIdx].id];
  const videos = files.filter((f) => VIDEO_EXTS.some((ext) => f.path.toLowerCase().endsWith(ext)));
  if (videos.length === 0) return files.map((f) => f.id);
  return videos.map((f) => f.id);
}

function pickLinkIndex(files: RdFile[] | undefined, fileIdx: number | undefined, linkCount: number): number {
  if (!files || fileIdx == null) return 0;
  const selected = files.filter((f) => f.selected === 1);
  const target = files[fileIdx];
  if (!target) return 0;
  const offset = selected.findIndex((f) => f.id === target.id);
  if (offset < 0) return 0;
  return Math.min(offset, linkCount - 1);
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

type RdUser = {
  id?: number;
  username?: string;
  email?: string;
  premium?: number;
  expiration?: string;
};

type RdTorrentSummary = {
  id: string;
  filename: string;
  hash: string;
  bytes: number;
  status: string;
};

type RdFile = {
  id: number;
  path: string;
  bytes: number;
  selected: 0 | 1;
};

type RdTorrentInfo = {
  id: string;
  filename: string;
  hash: string;
  status:
    | "magnet_error"
    | "magnet_conversion"
    | "waiting_files_selection"
    | "queued"
    | "downloading"
    | "downloaded"
    | "error"
    | "virus"
    | "compressing"
    | "uploading"
    | "dead";
  progress: number;
  files: RdFile[];
  links: string[];
};

type RdUnrestrict = {
  id: string;
  filename: string;
  filesize: number;
  link: string;
  host: string;
  download: string;
  streamable: number;
};

type RdErrorBody = {
  error?: string;
  error_code?: number;
};
