import { invoke } from "@tauri-apps/api/core";
import { safeFetch } from "@/lib/safe-fetch";
import { dwarn } from "@/lib/debug";
import { normalizeLang } from "@/lib/subtitles/language";
import { fetchAndParse, type SubCue } from "@/lib/subtitles/parser";

const API_BASE = "https://api.opensubtitles.com/api/v1";
const POS_TTL_MS = 30 * 24 * 3600 * 1000;
const NEG_TTL_MS = 6 * 3600 * 1000;
const MIN_TRUSTED_DOWNLOADS = 50;

export type OsConfig = {
  apiKey: string;
  userAgent: string;
  bearer?: string | null;
};

export type OsFile = { fileId: number; fileName: string };

export type OsSub = {
  id: string;
  language: string;
  moviehashMatch: boolean;
  downloadCount: number;
  fromTrusted: boolean;
  hearingImpaired: boolean;
  aiTranslated: boolean;
  machineTranslated: boolean;
  release: string | null;
  fps: number | null;
  imdbId: string | null;
  files: OsFile[];
};

export type Tier0Status = "exact" | "candidate" | "miss" | "unavailable";

export type Tier0Result = {
  status: Tier0Status;
  hash?: string;
  size?: number;
  exact?: OsSub;
  candidates?: OsSub[];
  reason?: string;
};

type CacheEntry = { expires: number; value: OsSub[] };

const memCache = new Map<string, CacheEntry>();
let rateLimitedUntil = 0;

type PersistHooks = {
  load?: (key: string) => Promise<CacheEntry | null>;
  save?: (key: string, entry: CacheEntry) => Promise<void>;
};

let persist: PersistHooks = {};

export function configureCache(hooks: PersistHooks): void {
  persist = hooks;
}

export async function computeMovieHash(
  url: string,
  headers?: Record<string, string>,
  size?: number,
): Promise<{ hash: string; size: number } | null> {
  try {
    return await invoke<{ hash: string; size: number }>("compute_moviehash", {
      url,
      headers,
      size,
    });
  } catch (e) {
    dwarn("[os-hash] moviehash failed", e);
    return null;
  }
}

function toImdbId(raw: unknown): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/^tt/i, "").replace(/\D/g, "");
  return digits ? `tt${digits.padStart(7, "0")}` : null;
}

function parseSub(item: unknown): OsSub | null {
  const it = item as { id?: unknown; attributes?: Record<string, unknown> };
  const a = it?.attributes;
  if (!a) return null;
  const rawFiles = Array.isArray(a.files) ? (a.files as Array<Record<string, unknown>>) : [];
  const files: OsFile[] = rawFiles
    .map((f) => ({ fileId: Number(f.file_id), fileName: String(f.file_name ?? "") }))
    .filter((f) => Number.isFinite(f.fileId) && f.fileId > 0);
  if (files.length === 0) return null;
  const feature = a.feature_details as Record<string, unknown> | undefined;
  return {
    id: String(it.id ?? a.subtitle_id ?? ""),
    language: String(a.language ?? "").toLowerCase(),
    moviehashMatch: a.moviehash_match === true,
    downloadCount: Number(a.download_count ?? 0),
    fromTrusted: a.from_trusted === true,
    hearingImpaired: a.hearing_impaired === true,
    aiTranslated: a.ai_translated === true,
    machineTranslated: a.machine_translated === true,
    release: (a.release as string) ?? null,
    fps: a.fps != null ? Number(a.fps) : null,
    imdbId: toImdbId(feature?.imdb_id),
    files,
  };
}

async function searchByHash(hash: string, langs: string[], cfg: OsConfig): Promise<OsSub[] | null> {
  if (Date.now() < rateLimitedUntil) return null;
  const lang = langs.map(normalizeLang).filter(Boolean).join(",");
  const qs = lang ? `?moviehash=${encodeURIComponent(hash)}&languages=${encodeURIComponent(lang)}` : `?moviehash=${encodeURIComponent(hash)}`;
  try {
    const res = await safeFetch(`${API_BASE}/subtitles${qs}`, {
      headers: {
        "Api-Key": cfg.apiKey,
        "User-Agent": cfg.userAgent,
        Accept: "application/json",
      },
    });
    if (res.status === 429) {
      const retry = Number(res.headers.get("retry-after") ?? "5");
      rateLimitedUntil = Date.now() + Math.max(1, retry) * 1000;
      dwarn("[os-hash] 429 rate limited");
      return null;
    }
    if (!res.ok) {
      dwarn(`[os-hash] search ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { data?: unknown[] };
    const list = Array.isArray(data?.data) ? data.data : [];
    return list.map(parseSub).filter((s): s is OsSub => s !== null);
  } catch (e) {
    dwarn("[os-hash] search error", e);
    return null;
  }
}

async function cachedSearch(
  hash: string,
  langs: string[],
  cfg: OsConfig,
  netAllowed: boolean,
): Promise<OsSub[] | null> {
  const key = `${hash}|${langs.map(normalizeLang).sort().join(",")}`;
  const now = Date.now();
  const mem = memCache.get(key);
  if (mem && mem.expires > now) return mem.value;
  if (persist.load) {
    const p = await persist.load(key).catch(() => null);
    if (p && p.expires > now) {
      memCache.set(key, p);
      return p.value;
    }
  }
  if (!netAllowed) return null;
  const fresh = await searchByHash(hash, langs, cfg);
  if (fresh === null) return null;
  const entry: CacheEntry = {
    expires: now + (fresh.length ? POS_TTL_MS : NEG_TTL_MS),
    value: fresh,
  };
  memCache.set(key, entry);
  if (persist.save) void persist.save(key, entry).catch(() => {});
  return fresh;
}

function scoreSub(s: OsSub): number {
  let v = s.downloadCount;
  if (s.fromTrusted) v += 100000;
  if (s.aiTranslated || s.machineTranslated) v -= 50000;
  if (s.hearingImpaired) v -= 5;
  return v;
}

function gate(
  subs: OsSub[],
  langs: string[],
  imdbId?: string | null,
): { exact: OsSub | null; candidates: OsSub[] } {
  const want = new Set(langs.map(normalizeLang).filter(Boolean));
  const wantImdb = toImdbId(imdbId);
  const langOk = (s: OsSub) => want.size === 0 || want.has(normalizeLang(s.language));
  const imdbOk = (s: OsSub) => !wantImdb || !s.imdbId || s.imdbId === wantImdb;
  const candidates = subs.filter((s) => s.moviehashMatch && langOk(s) && imdbOk(s));
  candidates.sort((a, b) => scoreSub(b) - scoreSub(a));
  const top = candidates[0] ?? null;
  const trustworthy =
    top != null &&
    (top.fromTrusted || top.downloadCount >= MIN_TRUSTED_DOWNLOADS) &&
    !top.machineTranslated &&
    !top.aiTranslated;
  return { exact: trustworthy ? top : null, candidates };
}

export async function resolveTier0(input: {
  url: string;
  headers?: Record<string, string>;
  size?: number;
  langs: string[];
  imdbId?: string | null;
  cfg: OsConfig;
  netAllowed?: boolean;
}): Promise<Tier0Result> {
  const netAllowed = input.netAllowed ?? true;
  if (!input.cfg.apiKey) return { status: "unavailable", reason: "no-api-key" };
  const mh = await computeMovieHash(input.url, input.headers, input.size);
  if (!mh) return { status: "miss", reason: "no-hash" };
  const subs = await cachedSearch(mh.hash, input.langs, input.cfg, netAllowed);
  if (subs === null) {
    return { status: "unavailable", hash: mh.hash, size: mh.size, reason: "search-unavailable" };
  }
  if (subs.length === 0) return { status: "miss", hash: mh.hash, size: mh.size };
  const { exact, candidates } = gate(subs, input.langs, input.imdbId);
  if (exact) return { status: "exact", hash: mh.hash, size: mh.size, exact, candidates };
  if (candidates.length) return { status: "candidate", hash: mh.hash, size: mh.size, candidates };
  return { status: "miss", hash: mh.hash, size: mh.size };
}

export async function requestDownloadLink(
  fileId: number,
  cfg: OsConfig,
): Promise<{ link: string; remaining: number } | null> {
  if (!cfg.apiKey) return null;
  if (Date.now() < rateLimitedUntil) return null;
  const headers: Record<string, string> = {
    "Api-Key": cfg.apiKey,
    "User-Agent": cfg.userAgent,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (cfg.bearer) headers.Authorization = `Bearer ${cfg.bearer}`;
  try {
    const res = await safeFetch(`${API_BASE}/download`, {
      method: "POST",
      headers,
      body: JSON.stringify({ file_id: fileId }),
    });
    if (res.status === 429) {
      rateLimitedUntil = Date.now() + 5000;
      return null;
    }
    if (!res.ok) {
      dwarn(`[os-hash] download ${res.status}`);
      return null;
    }
    const j = (await res.json()) as { link?: string; remaining?: number };
    if (!j.link) return null;
    return { link: j.link, remaining: Number(j.remaining ?? 0) };
  } catch (e) {
    dwarn("[os-hash] download error", e);
    return null;
  }
}

export type SwapCues = { cues: Array<[number, number]>; cueText: string[] };

function osFileId(url: string): number | null {
  const m = url.match(/^os:file:(\d+)$/);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function resolveSwapCues(
  subSwap: { url: string; format?: "srt" | "vtt" | null },
  cfg: OsConfig,
): Promise<SwapCues | null> {
  let fetchUrl = subSwap.url;
  const fileId = osFileId(subSwap.url);
  if (fileId !== null) {
    const dl = await requestDownloadLink(fileId, cfg);
    if (!dl) return null;
    fetchUrl = dl.link;
  }
  let parsed: SubCue[];
  try {
    parsed = await fetchAndParse(fetchUrl, subSwap.format ? { format: subSwap.format } : {});
  } catch (e) {
    dwarn("[os-hash] swap parse failed", e);
    return null;
  }
  const usable = parsed.filter(
    (c) => Number.isFinite(c.start) && Number.isFinite(c.end) && c.end > c.start,
  );
  if (usable.length < 4) return null;
  return {
    cues: usable.map((c) => [c.start, c.end] as [number, number]),
    cueText: usable.map((c) => c.text),
  };
}

export async function login(
  username: string,
  password: string,
  cfg: OsConfig,
): Promise<{ token: string; baseUrl: string | null } | null> {
  if (!cfg.apiKey) return null;
  try {
    const res = await safeFetch(`${API_BASE}/login`, {
      method: "POST",
      headers: {
        "Api-Key": cfg.apiKey,
        "User-Agent": cfg.userAgent,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { token?: string; base_url?: string };
    if (!j.token) return null;
    return { token: j.token, baseUrl: j.base_url ?? null };
  } catch {
    return null;
  }
}
