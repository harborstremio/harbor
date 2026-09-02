import { safeFetch } from "@/lib/safe-fetch";

const JIKAN = "https://api.jikan.moe/v4";
const CACHE_KEY = "harbor.mal.hero.v1";
const TTL_MS = 6 * 60 * 60 * 1000;

export type MalHeroItem = {
  id: string;
  name: string;
  description?: string;
  poster?: string;
  year?: string;
  rating?: string;
  format?: string;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let mem: MalHeroItem[] | null = null;
let inflight: Promise<MalHeroItem[]> | null = null;

function cleanSynopsis(s?: string): string | undefined {
  if (!s) return undefined;
  const out = s
    .replace(/\s*\[Written by [^\]]+\]\s*$/i, "")
    .replace(/\s*\(Source:[^)]*\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return out || undefined;
}

async function jikanPage(filter: string, page: number): Promise<Array<Record<string, unknown>>> {
  try {
    const res = await safeFetch(`${JIKAN}/top/anime?filter=${filter}&page=${page}&sfw=true`);
    if (!res.ok) return [];
    const j = (await res.json()) as { data?: Array<Record<string, unknown>> };
    return j?.data ?? [];
  } catch {
    return [];
  }
}

function toItem(a: Record<string, any>): MalHeroItem | null {
  const name = (a.title_english || a.title || "").trim();
  if (!name || a.mal_id == null) return null;
  return {
    id: `mal:${a.mal_id}`,
    name,
    description: cleanSynopsis(a.synopsis),
    poster:
      a.images?.webp?.image_url ||
      a.images?.jpg?.image_url ||
      a.images?.webp?.large_image_url ||
      a.images?.jpg?.large_image_url ||
      undefined,
    year: a.year ? String(a.year) : a.aired?.prop?.from?.year ? String(a.aired.prop.from.year) : undefined,
    rating: a.score ? Number(a.score).toFixed(1) : undefined,
    format: a.type ? String(a.type).toUpperCase() : undefined,
  };
}

function readDisk(): MalHeroItem[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const c = JSON.parse(raw) as { t: number; items: MalHeroItem[] };
      if (c?.items?.length && Date.now() - c.t < TTL_MS) {
        mem = c.items;
        return c.items;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function crawlMalHeroList(): Promise<MalHeroItem[]> {
  const seen = new Set<number>();
  const out: MalHeroItem[] = [];
  const plan: Array<[string, number]> = [
    ["bypopularity", 6],
    ["favorite", 3],
    ["airing", 2],
  ];
  for (const [filter, pages] of plan) {
    for (let p = 1; p <= pages; p += 1) {
      const data = await jikanPage(filter, p);
      if (data.length === 0) break;
      for (const a of data) {
        const id = (a as { mal_id?: number }).mal_id;
        if (id == null || seen.has(id)) continue;
        seen.add(id);
        const item = toItem(a);
        if (item) out.push(item);
      }
      await sleep(800);
    }
  }
  if (out.length > 0) {
    mem = out;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), items: out }));
    } catch {
      /* ignore */
    }
  }
  return out;
}

export function fetchMalHeroList(): Promise<MalHeroItem[]> {
  if (mem) return Promise.resolve(mem);
  const disk = readDisk();
  if (disk) return Promise.resolve(disk);
  if (inflight) return inflight;
  inflight = crawlMalHeroList().finally(() => {
    inflight = null;
  });
  return inflight;
}
