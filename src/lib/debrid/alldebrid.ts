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

const BASE = "https://api.alldebrid.com/v4";
const AGENT = "Harbor";
const VIDEO_EXTS = [".mkv", ".mp4", ".avi", ".m4v", ".webm", ".ts", ".mov", ".wmv"];
const POLL_DELAY_MS = 1500;
const POLL_MAX_ATTEMPTS = 12;
const LIBRARY_TTL_MS = 5 * 60_000;
const LIBRARY_CACHE = new Map<string, { at: number; data: LibraryEntry[] }>();

const READY_STATUS_CODE = 4;
const TERMINAL_FAIL_STATUS = new Set([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

export function createAllDebrid(apiKey: string): DebridStore {
  const headers = (extra?: HeadersInit): HeadersInit => ({
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
    ...extra,
  });
  const withAgent = (path: string): string => {
    const sep = path.includes("?") ? "&" : "?";
    return `${BASE}${path}${sep}agent=${AGENT}`;
  };

  async function get<T>(path: string, signal: AbortSignal): Promise<DebridResult<T>> {
    return wrap<T>(() => fetch(withAgent(path), { headers: headers(), signal }));
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
      fetch(withAgent(path), {
        method: "POST",
        headers: headers({ "Content-Type": "application/x-www-form-urlencoded" }),
        body: form.toString(),
        signal,
      }),
    );
  }

  async function account(signal: AbortSignal): Promise<DebridResult<Account>> {
    const r = await get<{ user: AdUser }>("/user", signal);
    if (!r.ok) return r;
    const u = r.data.user;
    return {
      ok: true,
      data: {
        slug: "ad",
        username: u.username,
        email: u.email,
        premium: u.isPremium === true,
        premiumUntil: u.premiumUntil,
      },
    };
  }

  async function cacheCheckBatch(
    batch: string[],
    signal: AbortSignal,
  ): Promise<DebridResult<CacheMap>> {
    const r = await postForm<{ magnets: AdInstantEntry[] }>(
      "/magnet/instant",
      { "magnets[]": batch },
      signal,
    );
    if (!r.ok) {
      dwarn("[ad] cacheCheck batch failed", { code: r.code, status: r.status });
      return { ok: true, data: {} };
    }
    const out: CacheMap = {};
    for (const m of r.data.magnets ?? []) {
      if (m.hash && m.instant === true) out[m.hash.toLowerCase()] = true;
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
      `[ad] cacheCheck total ${hashes.length} hashes → ${Object.keys(merged).length} cached`,
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

    const add = await postForm<{ magnets: AdAddResult[] }>(
      "/magnet/upload",
      { "magnets[]": fullMagnet },
      signal,
    );
    if (!add.ok) return add;
    const first = add.data.magnets?.[0];
    if (!first) return { ok: false, code: "no-result", status: 0, raw: add.data };
    if (first.error) {
      return { ok: false, code: first.error.code ?? "magnet-error", status: 0, raw: first.error };
    }
    const id = first.id;

    let entry: AdMagnetStatus | null = first.ready
      ? null
      : null;
    let chosenLink: AdMagnetLink | null = null;

    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      if (signal.aborted) return { ok: false, code: "aborted", status: 0 };
      const s = await get<{ magnets: AdMagnetStatus }>(`/magnet/status?id=${id}`, signal);
      if (!s.ok) return s;
      entry = s.data.magnets;
      if (!entry) {
        await sleep(POLL_DELAY_MS, signal);
        continue;
      }
      if (entry.statusCode === READY_STATUS_CODE) {
        chosenLink = pickAdLink(entry.links ?? [], fileIdx, hint);
        break;
      }
      if (TERMINAL_FAIL_STATUS.has(entry.statusCode)) {
        return { ok: false, code: `status-${entry.statusCode}`, status: 0, raw: { hash } };
      }
      if (attempt >= 3) {
        return { ok: false, code: "not-cached", status: 0, raw: { hash, statusCode: entry.statusCode } };
      }
      await sleep(POLL_DELAY_MS, signal);
    }

    if (!chosenLink) return { ok: false, code: "no-link", status: 0 };

    const u = await get<AdUnlock>(`/link/unlock?link=${encodeURIComponent(chosenLink.link)}`, signal);
    if (!u.ok) return u;
    if (u.data.delayed && u.data.delayed > 0) {
      const settled = await pollDelayed(u.data.delayed, signal);
      if (!settled.ok) return settled;
      return {
        ok: true,
        data: { url: settled.data.link, filename: settled.data.filename, filesize: settled.data.filesize },
      };
    }
    return {
      ok: true,
      data: { url: u.data.link, filename: u.data.filename, filesize: u.data.filesize },
    };
  }

  async function pollDelayed(delayedId: number, signal: AbortSignal): Promise<DebridResult<AdUnlock>> {
    for (let attempt = 0; attempt < 18; attempt++) {
      if (signal.aborted) return { ok: false, code: "aborted", status: 0 };
      await sleep(2500, signal);
      const r = await get<AdUnlock & { status: number }>(`/link/delayed?id=${delayedId}`, signal);
      if (!r.ok) return r;
      if (r.data.status === 2) return { ok: true, data: r.data };
      if (r.data.status === 3) return { ok: false, code: "delayed-error", status: 0 };
    }
    return { ok: false, code: "timeout", status: 0 };
  }

  async function listLibrary(signal: AbortSignal): Promise<DebridResult<LibraryEntry[]>> {
    const cached = LIBRARY_CACHE.get(apiKey);
    if (cached && Date.now() - cached.at < LIBRARY_TTL_MS) {
      return { ok: true, data: cached.data };
    }
    const r = await get<{ magnets: AdMagnetStatus[] }>("/magnet/status", signal);
    if (!r.ok) return r;
    const list = r.data.magnets ?? [];
    const data: LibraryEntry[] = list
      .filter((m) => m.statusCode === READY_STATUS_CODE)
      .map((m) => ({
        slug: "ad" as const,
        id: String(m.id),
        hash: (m.hash ?? "").toLowerCase(),
        name: m.filename ?? m.filename_original ?? "",
        size: m.size,
        files: (m.links ?? []).map((l) => ({
          id: l.link,
          name: l.filename,
          size: l.size ?? 0,
        })),
      }));
    LIBRARY_CACHE.set(apiKey, { at: Date.now(), data });
    return { ok: true, data };
  }

  async function listTorrentFiles(hash: string, signal: AbortSignal): Promise<DebridResult<DebridFile[]>> {
    const fullMagnet = magnetFromHash(hash);
    const upload = await postForm<AdUpload>("/magnet/upload", { "magnets[]": fullMagnet }, signal);
    if (!upload.ok) return upload;
    const magnet = upload.data.magnets?.[0];
    if (!magnet || magnet.error) {
      return { ok: false, code: magnet?.error?.code ?? "no-magnet", status: 0 };
    }
    const id = magnet.id;

    for (let attempt = 0; attempt < 12; attempt++) {
      if (signal.aborted) return { ok: false, code: "aborted", status: 0 };
      const status = await get<AdMagnetStatus>(`/magnet/status?id=${id}`, signal);
      if (!status.ok) return status;
      if (status.data.statusCode === 4) {
        const links = status.data.links ?? [];
        const result: DebridFile[] = [];
        for (let i = 0; i < links.length; i++) {
          if (signal.aborted) return { ok: false, code: "aborted", status: 0 };
          const u = await postForm<AdUnlock>("/link/unlock", { link: links[i].link }, signal);
          if (!u.ok) continue;
          result.push({
            id: String(i),
            name: links[i].filename,
            size: links[i].size ?? 0,
            url: u.data.link,
          });
        }
        if (result.length === 0) continue;
        return { ok: true, data: result };
      }
      if (status.data.statusCode >= 5 && status.data.statusCode <= 15) {
        return { ok: false, code: `status-${status.data.statusCode}`, status: 0 };
      }
      await sleep(1500, signal);
    }
    return { ok: false, code: "timeout", status: 0 };
  }

  return {
    slug: "ad",
    name: "AllDebrid",
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
  if (!res.ok && res.status !== 200) {
    let body: unknown;
    try { body = await res.json(); } catch { body = await res.text().catch(() => null); }
    return { ok: false, code: `http-${res.status}`, status: res.status, raw: body };
  }
  let body: AdEnvelope<T>;
  try {
    body = (await res.json()) as AdEnvelope<T>;
  } catch {
    return { ok: false, code: "parse-error", status: res.status };
  }
  if (body.status !== "success") {
    return {
      ok: false,
      code: body.error?.code ?? "ad-error",
      status: res.status,
      raw: body.error ?? body,
    };
  }
  return { ok: true, data: body.data as T };
}

function pickAdLink(links: AdMagnetLink[], fileIdx: number | undefined, hint?: EpisodeHint): AdMagnetLink | null {
  if (links.length === 0) return null;
  if (fileIdx != null && links[fileIdx]) return links[fileIdx];
  const videos = links.filter((l) =>
    VIDEO_EXTS.some((ext) => l.filename.toLowerCase().endsWith(ext)),
  );
  const pool = videos.length > 0 ? videos : links;
  const mi = matchEpisodeFileIndex(pool.map((l) => l.filename), hint);
  if (mi >= 0) return pool[mi];
  return pool.slice().sort((a, b) => (b.size ?? 0) - (a.size ?? 0))[0];
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

type AdEnvelope<T> = {
  status: "success" | "error";
  data?: T;
  error?: { code?: string; message?: string };
};

type AdUser = {
  username?: string;
  email?: string;
  isPremium?: boolean;
  premiumUntil?: number;
};

type AdInstantEntry = {
  magnet?: string;
  hash?: string;
  instant?: boolean;
};

type AdUpload = {
  magnets: AdAddResult[];
};

type AdAddResult = {
  id: number;
  hash?: string;
  magnet?: string;
  name?: string;
  ready?: boolean;
  size?: number;
  error?: { code?: string; message?: string };
};

type AdMagnetLink = {
  link: string;
  filename: string;
  size?: number;
};

type AdMagnetStatus = {
  id: number;
  hash?: string;
  filename?: string;
  filename_original?: string;
  statusCode: number;
  size?: number;
  links?: AdMagnetLink[];
};

type AdUnlock = {
  link: string;
  filename: string;
  filesize?: number;
  host?: string;
  delayed?: number;
};
