import { lruSet } from "../cache";
import { safeFetch } from "../safe-fetch";
import {
  parseProductionFacts,
  productionSlug,
  productionSlugs,
  verifyProductionPage,
  type ProductionFacts,
} from "./shotonwhat-parser";

export type { ProductionFacts } from "./shotonwhat-parser";

const CACHE_MAX = 60;
const TIMEOUT_MS = 9000;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const cache = new Map<string, ProductionFacts | null>();
const inflight = new Map<string, Promise<ProductionFacts | null>>();
const subs = new Set<() => void>();

export type ProductionRequest = {
  title: string;
  originalTitle?: string;
  year?: string;
  imdbId?: string | null;
};

export function productionKey(request: ProductionRequest): string {
  const base = request.imdbId?.trim() || productionSlug(request.title);
  return `${base}:${request.year?.trim().slice(0, 4) ?? ""}`;
}

export function productionCached(key: string): ProductionFacts | null {
  return cache.get(key) ?? null;
}

export function subscribeProduction(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export async function fetchProductionFacts(
  request: ProductionRequest,
): Promise<ProductionFacts | null> {
  const key = productionKey(request);
  if (cache.has(key)) return cache.get(key) ?? null;
  const pending = inflight.get(key);
  if (pending) return pending;

  const slugs = productionSlugs(request.title, request.originalTitle, request.year);
  if (slugs.length === 0) return null;

  const expect = {
    imdbId: request.imdbId ?? null,
    titles: [request.title, request.originalTitle ?? ""].filter(Boolean),
    year: request.year,
  };

  const promise = (async () => {
    let facts: ProductionFacts | null = null;
    for (const slug of slugs) {
      const url = `https://shotonwhat.com/${slug}`;
      try {
        const res = await safeFetch(url, {
          headers: HEADERS,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) continue;
        if (!(res.headers.get("content-type") ?? "").toLowerCase().includes("text/html")) continue;
        const html = await res.text();
        if (!verifyProductionPage(html, expect)) continue;
        facts = parseProductionFacts(html, url, expect);
        break;
      } catch {
        continue;
      }
    }
    lruSet(cache, key, facts, CACHE_MAX);
    subs.forEach((fn) => fn());
    return facts;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}
