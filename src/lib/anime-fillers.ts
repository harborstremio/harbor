import { fetch as tauriHttpFetch } from "@tauri-apps/plugin-http";

const CACHE_KEY = "harbor.animefillercache.v2";
const TTL_MS = 14 * 24 * 60 * 60 * 1000;
const NEG_TTL_MS = 24 * 60 * 60 * 1000;
const AFL = "https://www.animefillerlist.com/shows";
const JIKAN = "https://api.jikan.moe/v4";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Harbor";
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type FillerEntry = { fillers: number[]; t: number; ok?: boolean };
type FillerCache = Record<string, FillerEntry>;

function readCache(): FillerCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as FillerCache) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: FillerCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

function expandRanges(tokens: string[]): number[] {
  const out = new Set<number>();
  for (const tk of tokens) {
    const range = tk.split("-");
    if (range.length === 2) {
      const a = Number(range[0]);
      const b = Number(range[1]);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        for (let n = a; n <= b; n++) if (n > 0) out.add(n);
      }
    } else {
      const v = Number(tk);
      if (Number.isFinite(v) && v > 0) out.add(v);
    }
  }
  return [...out];
}

function extractFiller(html: string): number[] {
  const m = html.match(
    /<div class="filler"><span class="Label">Filler Episodes:<\/span><span class="Episodes">([\s\S]*?)<\/span>/,
  );
  if (!m) return [];
  const text = m[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ");
  const tokens = text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return expandRanges(tokens);
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/['’.:,!?]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function malInfo(malId: number): Promise<{ titles: string[]; year?: number }> {
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8000);
    const r = await fetch(`${JIKAN}/anime/${malId}`, { signal: ac.signal }).finally(() => clearTimeout(timer));
    if (!r.ok) return { titles: [] };
    const j = (await r.json()) as {
      data?: {
        title?: string;
        title_english?: string;
        titles?: Array<{ title?: string }>;
        year?: number;
        aired?: { from?: string };
      };
    };
    const d = j?.data ?? {};
    const titles: string[] = [];
    if (d.title_english) titles.push(d.title_english);
    if (d.title) titles.push(d.title);
    for (const x of d.titles ?? []) if (x?.title) titles.push(x.title);
    const year = d.year ?? (d.aired?.from ? Number(d.aired.from.slice(0, 4)) : undefined);
    return { titles, year: year && Number.isFinite(year) ? year : undefined };
  } catch {
    return { titles: [] };
  }
}

function slugCandidates(titles: string[], year?: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (s: string) => {
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  };
  for (const title of titles) {
    const base = slugify(title);
    if (!base) continue;
    if (year) push(`${base}-${year}`);
    push(`${base}-tv`);
    push(base);
  }
  return out.slice(0, 12);
}

async function fetchShow(slug: string): Promise<string | null> {
  try {
    const url = `${AFL}/${slug}`;
    const r = isTauri ? await tauriHttpFetch(url, { method: "GET", headers: { "User-Agent": UA } }) : await fetch(url);
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

const inflight = new Map<number, Promise<number[]>>();

export async function fillerEpisodes(malId: number | null): Promise<Set<number>> {
  if (!malId || !Number.isFinite(malId)) return new Set();
  const cache = readCache();
  const hit = cache[malId];
  if (hit && Date.now() - hit.t < (hit.ok ? TTL_MS : NEG_TTL_MS)) return new Set(hit.fillers);
  const existing = inflight.get(malId);
  if (existing) return new Set(await existing);
  const p = (async (): Promise<number[]> => {
    let ok = false;
    let fillers: number[] = [];
    try {
      const { titles, year } = await malInfo(malId);
      for (const slug of slugCandidates(titles, year)) {
        const html = await fetchShow(slug);
        if (html) {
          ok = true;
          fillers = extractFiller(html);
          break;
        }
      }
    } catch {}
    const next = readCache();
    next[malId] = { fillers, t: Date.now(), ok };
    writeCache(next);
    return fillers;
  })().finally(() => inflight.delete(malId));
  inflight.set(malId, p);
  return new Set(await p);
}
