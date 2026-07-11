import type { Meta } from "@/lib/cinemeta";
import { getStore } from "@/lib/discover/store";
import type { FeedItem } from "@/lib/feed";
import { loadStoredSettings } from "@/lib/settings/load";

import { localeWeights } from "./locale";

type Affinity = ReturnType<typeof getStore>["affinity"];
type Locale = ReturnType<typeof localeWeights>;

function decadeOf(year?: string): string | undefined {
  if (!year) return undefined;
  const y = parseInt(year.slice(0, 4), 10);
  if (!Number.isFinite(y)) return undefined;
  return `${Math.floor(y / 10) * 10}s`;
}

function maxAbs(map: Record<string, number>): number {
  let max = 0;
  for (const v of Object.values(map)) {
    const a = Math.abs(v);
    if (a > max) max = a;
  }
  return max;
}

function localeScore(meta: Meta, locale: Locale, affinity: Affinity): number {
  if (locale.penalty === 0) return 0;
  const code = meta.originalLanguage;
  if (!code || locale.codes.has(code)) return 0;
  const langMax = maxAbs(affinity.languages) || 1;
  const liked = Math.max(0, (affinity.languages[code] ?? 0) / langMax);
  return -locale.penalty * (1 - liked);
}

function scoreItem(item: FeedItem, affinity: Affinity, locale: Locale): number {
  let score = localeScore(item.meta, locale, affinity);
  if (affinity.totalEvents === 0) return score;
  const genreMax = maxAbs(affinity.genres) || 1;
  for (const g of item.meta.genres ?? []) {
    const w = affinity.genres[g] ?? 0;
    if (w !== 0) score += (w / genreMax) * 4;
  }
  const decade = decadeOf(item.meta.releaseInfo);
  if (decade) {
    const decadeMax = maxAbs(affinity.decades) || 1;
    const w = affinity.decades[decade] ?? 0;
    if (w !== 0) score += (w / decadeMax) * 1.5;
  }
  return score;
}

export function rankByAffinity(items: FeedItem[]): FeedItem[] {
  const { affinity } = getStore();
  const locale = localeWeights(loadStoredSettings());
  if (affinity.totalEvents < 1 && locale.penalty === 0) return items;
  const scored = items.map((item, idx) => ({
    item,
    score: scoreItem(item, affinity, locale),
    idx,
  }));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.idx - b.idx;
  });
  return scored.map((s) => s.item);
}

export function rankMetasByAffinity(metas: Meta[]): Meta[] {
  const wrapped: FeedItem[] = metas.map((m) => ({ meta: m, tag: "", category: "" }));
  const ranked = rankByAffinity(wrapped);
  return ranked.map((w) => w.meta);
}
