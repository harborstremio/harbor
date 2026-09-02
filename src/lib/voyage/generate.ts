import { safeFetch } from "@/lib/safe-fetch";
import { meta as fetchMeta, type Meta } from "@/lib/cinemeta";
import { watchTitleKey } from "@/lib/playback-history";
import type { VoyageTheme } from "./types";

const BASE = "https://v3-cinemeta.strem.io/catalog";
const POOL_MAX = 40;
const LIVE_MIN = 6;

export type PoolExclude = { ids?: Set<string>; titles?: Set<string> };

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function usable(m: Meta | null | undefined, exclude?: PoolExclude): m is Meta {
  if (!m || !m.id || !m.poster || !m.name) return false;
  if (exclude?.ids?.has(m.id)) return false;
  if (exclude?.titles?.size && exclude.titles.has(watchTitleKey(m.name))) return false;
  return true;
}

function leadsWithGenre(m: Meta, genre?: string): boolean {
  if (!genre) return true;
  const g = m.genres ?? [];
  return g.length > 0 && g[0].toLowerCase() === genre.toLowerCase();
}

async function curatedPool(theme: VoyageTheme, exclude?: PoolExclude): Promise<Meta[]> {
  const ids = theme.seeds ?? [];
  if (ids.length === 0) return [];
  const got = await Promise.all(
    ids.map((id) => fetchMeta(theme.type, id, true).catch(() => null)),
  );
  return got.filter((m): m is Meta => usable(m, exclude));
}

async function livePool(theme: VoyageTheme, exclude?: PoolExclude): Promise<Meta[]> {
  const url = theme.genre
    ? `${BASE}/${theme.type}/top/genre=${encodeURIComponent(theme.genre)}.json`
    : `${BASE}/${theme.type}/top.json`;
  try {
    const res = await safeFetch(url);
    if (!res.ok) return [];
    const j = (await res.json()) as { metas?: Meta[] };
    const metas = Array.isArray(j.metas) ? j.metas : [];
    const clean = metas.filter((m) => usable(m, exclude));
    if (!theme.genre) return clean;
    const lead = clean.filter((m) => leadsWithGenre(m, theme.genre));
    if (lead.length >= LIVE_MIN) return lead;
    const want = theme.genre.toLowerCase();
    const taken = new Set(lead.map((m) => m.id));
    const tagged = clean.filter(
      (m) => !taken.has(m.id) && (m.genres ?? []).some((g) => g.toLowerCase() === want),
    );
    return [...lead, ...tagged];
  } catch {
    return [];
  }
}

function interleave(a: Meta[], b: Meta[]): Meta[] {
  const out: Meta[] = [];
  const seen = new Set<string>();
  const push = (m?: Meta) => {
    if (!m || seen.has(m.id)) return;
    seen.add(m.id);
    out.push(m);
  };
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    push(a[i]);
    push(b[i]);
  }
  return out;
}

export async function generatePool(theme: VoyageTheme, exclude?: PoolExclude): Promise<Meta[]> {
  const [curated, live] = await Promise.all([
    curatedPool(theme, exclude),
    livePool(theme, exclude),
  ]);
  const merged = interleave(shuffle(curated), shuffle(live));
  return merged.length > 0 ? merged.slice(0, POOL_MAX) : [];
}
