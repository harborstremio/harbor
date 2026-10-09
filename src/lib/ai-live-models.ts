import { useEffect, useState } from "react";
import type { AiModel } from "./ai-models";

const CACHE_MS = 6 * 60 * 60 * 1000;
const OPENROUTER_KEY = "harbor.ai.catalog.openrouter.v1";
const GROQ_KEY = "harbor.ai.catalog.groq.v1";

type CachedCatalog = { at: number; ids: string[] };

const memory = new Map<string, Set<string> | null>();
const inflight = new Map<string, Promise<Set<string> | null>>();

function readCache(key: string): Set<string> | null {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "null") as CachedCatalog | null;
    if (!raw || !Array.isArray(raw.ids) || Date.now() - raw.at > CACHE_MS) return null;
    return new Set(raw.ids);
  } catch {
    return null;
  }
}

function writeCache(key: string, ids: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), ids: [...ids] }));
  } catch {
    void 0;
  }
}

async function fetchCatalog(cacheKey: string, url: string, headers: Record<string, string>): Promise<Set<string> | null> {
  if (memory.has(cacheKey)) return memory.get(cacheKey) ?? null;
  const cached = readCache(cacheKey);
  if (cached) {
    memory.set(cacheKey, cached);
    return cached;
  }
  const running = inflight.get(cacheKey);
  if (running) return running;
  const p = (async () => {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) return null;
      const data = (await res.json()) as { data?: Array<{ id?: string }> };
      if (!Array.isArray(data?.data)) return null;
      const ids = new Set(data.data.map((m) => String(m.id || "")).filter(Boolean));
      if (ids.size === 0) return null;
      memory.set(cacheKey, ids);
      writeCache(cacheKey, ids);
      return ids;
    } catch {
      return null;
    } finally {
      inflight.delete(cacheKey);
    }
  })();
  inflight.set(cacheKey, p);
  return p;
}

export function fetchOpenRouterCatalog(): Promise<Set<string> | null> {
  return fetchCatalog(OPENROUTER_KEY, "https://openrouter.ai/api/v1/models", {});
}

export function fetchGroqCatalog(key: string): Promise<Set<string> | null> {
  const k = key.trim();
  if (!k) return Promise.resolve(null);
  return fetchCatalog(GROQ_KEY, "https://api.groq.com/openai/v1/models", {
    Authorization: `Bearer ${k}`,
  });
}

export function pruneToCatalog(models: AiModel[], catalog: Set<string> | null): AiModel[] {
  if (!catalog) return models;
  const pruned = models.filter((m) => catalog.has(m.id));
  return pruned.length > 0 ? pruned : models;
}

export function useOpenRouterCatalog(): Set<string> | null {
  const [cat, setCat] = useState<Set<string> | null>(() => readCache(OPENROUTER_KEY));
  useEffect(() => {
    let alive = true;
    void fetchOpenRouterCatalog().then((c) => {
      if (alive && c) setCat(c);
    });
    return () => {
      alive = false;
    };
  }, []);
  return cat;
}

export function useGroqCatalog(key: string): Set<string> | null {
  const [cat, setCat] = useState<Set<string> | null>(() => (key.trim() ? readCache(GROQ_KEY) : null));
  useEffect(() => {
    if (!key.trim()) return;
    let alive = true;
    void fetchGroqCatalog(key).then((c) => {
      if (alive && c) setCat(c);
    });
    return () => {
      alive = false;
    };
  }, [key]);
  return cat;
}
