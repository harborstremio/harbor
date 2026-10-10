import { tmdbDetails } from "@/lib/providers/tmdb/tmdb-details";
import type { Meta } from "@/lib/cinemeta";

const REL_MAX = 15;

const inflight = new Map<string, Promise<Meta[]>>();
const resolved = new Map<string, Meta[]>();

function dedup(list: Meta[]): Meta[] {
  const seen = new Set<string>();
  const out: Meta[] = [];
  for (const m of list) {
    if (!m || !m.id || !m.poster || !m.name || seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
    if (out.length >= REL_MAX) break;
  }
  return out;
}

function load(meta: Meta, key: string): Promise<Meta[]> {
  const existing = inflight.get(meta.id);
  if (existing) return existing;
  const p = tmdbDetails(key, meta)
    .then((d) => {
      const out = d ? dedup([...(d.recommendations ?? []), ...(d.similar ?? [])]) : [];
      resolved.set(meta.id, out);
      return out;
    })
    .catch(() => {
      resolved.set(meta.id, []);
      return [];
    });
  inflight.set(meta.id, p);
  return p;
}

export function prefetchRelated(metas: Meta[], key: string): void {
  if (!key) return;
  for (const m of metas) {
    if (m && !resolved.has(m.id) && !inflight.has(m.id)) void load(m, key);
  }
}

export function relatedResolved(id: string): Meta[] | null {
  return resolved.get(id) ?? null;
}

export function ensureRelated(meta: Meta, key: string): Promise<Meta[]> {
  if (!key) return Promise.resolve([]);
  const done = resolved.get(meta.id);
  if (done) return Promise.resolve(done);
  return load(meta, key);
}
