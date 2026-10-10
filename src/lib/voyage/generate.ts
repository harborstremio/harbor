import { safeFetch } from "@/lib/safe-fetch";
import { meta as fetchMeta, type Meta } from "@/lib/cinemeta";
import { watchTitleKey } from "@/lib/playback-history";
import type { VoyageTheme } from "./types";

const BASE = "https://v3-cinemeta.strem.io/catalog";
const POOL_MAX = 40;
const LIVE_MIN = 6;
const PAGE = 50;
const MAX_PAGES = 16;
const EMPTY_STOP = 2;

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

function pageUrl(theme: VoyageTheme, skip: number): string {
  const parts: string[] = [];
  if (theme.genre) parts.push(`genre=${encodeURIComponent(theme.genre)}`);
  if (skip > 0) parts.push(`skip=${skip}`);
  const tail = parts.length > 0 ? `/${parts.join("&")}` : "";
  return `${BASE}/${theme.type}/top${tail}.json`;
}

async function livePage(theme: VoyageTheme, skip: number): Promise<Meta[]> {
  try {
    const res = await safeFetch(pageUrl(theme, skip));
    if (!res.ok) return [];
    const j = (await res.json()) as { metas?: Meta[] };
    return Array.isArray(j.metas) ? j.metas : [];
  } catch {
    return [];
  }
}

function onGenre(clean: Meta[], theme: VoyageTheme): Meta[] {
  if (!theme.genre) return clean;
  const lead = clean.filter((m) => leadsWithGenre(m, theme.genre));
  if (lead.length >= LIVE_MIN) return lead;
  const want = theme.genre.toLowerCase();
  const taken = new Set(lead.map((m) => m.id));
  const tagged = clean.filter(
    (m) => !taken.has(m.id) && (m.genres ?? []).some((g) => g.toLowerCase() === want),
  );
  return [...lead, ...tagged];
}

async function livePool(
  theme: VoyageTheme,
  want: number,
  exclude?: PoolExclude,
  startPage = 0,
): Promise<Meta[]> {
  const out: Meta[] = [];
  const seen = new Set<string>();
  let empties = 0;
  for (let i = 0; i < MAX_PAGES && out.length < want && empties < EMPTY_STOP; i++) {
    const raw = await livePage(theme, (startPage + i) * PAGE);
    if (raw.length === 0) {
      empties += 1;
      continue;
    }
    empties = 0;
    const fresh = onGenre(
      raw.filter((m) => usable(m, exclude) && !seen.has(m.id)),
      theme,
    );
    for (const m of fresh) {
      seen.add(m.id);
      out.push(m);
    }
  }
  return out;
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

export async function generatePool(
  theme: VoyageTheme,
  exclude?: PoolExclude,
  want = POOL_MAX,
): Promise<Meta[]> {
  const [curated, live] = await Promise.all([
    curatedPool(theme, exclude),
    livePool(theme, want, exclude),
  ]);
  const merged = interleave(shuffle(curated), shuffle(live));
  return merged.length > 0 ? merged.slice(0, want) : [];
}

export async function deeperPool(
  theme: VoyageTheme,
  exclude: PoolExclude | undefined,
  round: number,
  want = POOL_MAX,
): Promise<Meta[]> {
  const startPage = Math.max(1, Math.round(round)) * Math.max(1, Math.floor(MAX_PAGES / 2));
  const live = await livePool(theme, want, exclude, startPage);
  if (live.length > 0) return shuffle(live).slice(0, want);
  return livePool(theme, want, exclude, 0).then((all) => shuffle(all).slice(0, want));
}
