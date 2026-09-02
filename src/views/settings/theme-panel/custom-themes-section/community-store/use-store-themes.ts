import { useEffect, useMemo, useState } from "react";
import { t } from "@/lib/i18n";
import { browseThemes, type StoreTheme } from "@/lib/theme-store";
import { MOOD_MIN, MOOD_RAILS, moodScores, type Mood } from "./color-rank";

export type AuthorStat = {
  author: string;
  handle: string | null;
  count: number;
  downloads: number;
  ratingAvg: number;
  avatar: string | null;
};

export type MoodRail = { mood: Mood; title: string; blurb: string; items: StoreTheme[] };

export type StoreData = {
  all: StoreTheme[];
  hero: StoreTheme | null;
  topRated: StoreTheme[];
  popular: StoreTheme[];
  fresh: StoreTheme[];
  moodRails: MoodRail[];
  authors: AuthorStat[];
};

let cache: StoreTheme[] | null = null;

function score(t: StoreTheme): number {
  return (t.ratingAvg || 0) * Math.log10(10 + (t.ratingCount || 0));
}

export function useStoreThemes(): {
  data: StoreData | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const [all, setAll] = useState<StoreTheme[] | null>(cache);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!cache) setLoading(true);
    setError(null);
    browseThemes("top", "")
      .then((list) => {
        if (cancelled) return;
        cache = list;
        setAll(list);
      })
      .catch(
        (e) =>
          !cancelled &&
          setError(e instanceof Error ? e.message : t("Could not reach the theme library.")),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const data = useMemo<StoreData | null>(() => {
    if (!all) return null;
    const topRated = [...all].sort((a, b) => score(b) - score(a));
    const popular = [...all].sort((a, b) => b.downloads - a.downloads);
    const fresh = [...all].sort((a, b) =>
      b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0,
    );
    const hero = topRated.find((t) => t.cover) ?? topRated[0] ?? null;
    const scores = new Map(all.map((t) => [t.id, moodScores(t)] as const));
    const sc = (t: StoreTheme, m: Mood) => scores.get(t.id)?.[m] ?? 0;
    const usedLead = new Set<string>();
    const moodRails = MOOD_RAILS.map((r) => ({
      ...r,
      items: all
        .filter((t) => sc(t, r.mood) >= MOOD_MIN)
        .sort((a, b) => sc(b, r.mood) - sc(a, r.mood) || b.downloads - a.downloads),
    }))
      .filter((r) => r.items.length >= 3)
      .map((r) => {
        const fresh = r.items.filter((t) => !usedLead.has(t.id));
        const dupes = r.items.filter((t) => usedLead.has(t.id));
        const items = [...fresh, ...dupes];
        if (items[0]) usedLead.add(items[0].id);
        return { ...r, items };
      });
    const byAuthor = new Map<string, StoreTheme[]>();
    for (const t of all) {
      const key = (t.author || "Anonymous").trim();
      const arr = byAuthor.get(key);
      if (arr) arr.push(t);
      else byAuthor.set(key, [t]);
    }
    const authors: AuthorStat[] = [...byAuthor.entries()]
      .map(([author, ts]) => ({
        author,
        handle: ts.find((t) => t.authorHandle)?.authorHandle ?? null,
        count: ts.length,
        downloads: ts.reduce((n, t) => n + (t.downloads || 0), 0),
        ratingAvg: ts.reduce((n, t) => n + (t.ratingAvg || 0), 0) / ts.length,
        avatar: ts.find((t) => t.authorAvatar)?.authorAvatar ?? null,
      }))
      .sort((a, b) => b.downloads - a.downloads || b.count - a.count);
    return { all, hero, topRated, popular, fresh, moodRails, authors };
  }, [all]);

  return {
    data,
    loading,
    error,
    reload: () => {
      cache = null;
      setTick((t) => t + 1);
    },
  };
}
