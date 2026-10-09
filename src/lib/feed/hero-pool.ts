import type { Meta } from "@/lib/cinemeta";
import { safeFetch } from "@/lib/safe-fetch";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";

export type HeroFeed = "trending" | "trakt" | "simkl" | "classic";

const HOSTED_URL = `${HARBOR_API_BASE}/feed/hero-pool.json`;
const CACHE_KEY = "harbor.heroPool.v1";
const TTL = 3 * 60 * 60 * 1000;

const SRC: Record<Exclude<HeroFeed, "classic">, string> = {
  trending: "now",
  trakt: "trakt",
  simkl: "simkl",
};

type Pool = { at: number; sources: Record<string, Meta[]> };

let mem: Pool | null = null;
let inflight: Promise<Pool | null> | null = null;

function fromStore(): Pool | null {
  if (mem) return mem;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Pool;
      if (p && p.sources && Array.isArray(p.sources.now)) {
        mem = p;
        return p;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function load(): Promise<Pool | null> {
  const cached = fromStore();
  if (cached && Date.now() - cached.at < TTL) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await safeFetch(HOSTED_URL, { cache: "no-cache" });
      if (!res.ok) return cached;
      const j = (await res.json()) as { sources?: Record<string, Meta[]> };
      if (!j || !j.sources || !Array.isArray(j.sources.now)) return cached;
      mem = { at: Date.now(), sources: j.sources };
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(mem));
      } catch {
        /* ignore */
      }
      return mem;
    } catch {
      return cached;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function fetchHeroFeed(source: HeroFeed): Promise<Meta[]> {
  if (source === "classic") return [];
  const p = await load();
  if (!p) return [];
  const key = SRC[source] ?? "now";
  const arr = p.sources[key] ?? p.sources.now ?? [];
  return Array.isArray(arr) ? arr.filter((m) => m && typeof m.id === "string" && m.background) : [];
}
