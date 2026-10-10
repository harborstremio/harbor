import { socialPost } from "./client";
import type { MyRating } from "@/lib/ratings/types";
import type { CwCard } from "@/lib/continue-watching";
import type { MediaEntry } from "@/lib/media-list-store";
import type { MangaFavEntry } from "@/lib/manga-favorites";
import type { WatchEvent } from "@/lib/watch-events";

import { wasImported, type ImportReceipt } from "@/lib/ratings/import/receipts";

export type ActivityKind = "watched" | "finished" | "favorited" | "rated" | "imported";

export type ActivityFeedItem = {
  kind: ActivityKind;
  metaId: string;
  mediaType: "movie" | "series" | "anime" | "manga";
  title: string;
  poster?: string;
  subtitle?: string;
  at: number;
  rating?: number;
};

const MAX = 30;

function withAnime(id: string, type: "movie" | "series"): "movie" | "series" | "anime" {
  return /^(kitsu|mal|anilist|anidb):/i.test(id) ? "anime" : type;
}

export function buildActivityFeed(input: {
  cw: CwCard[];
  ratings: MyRating[];
  favorites: MediaEntry[];
  mangaFavorites: MangaFavEntry[];
  imports?: ImportReceipt[];
  watchEvents?: WatchEvent[];
}): ActivityFeedItem[] {
  const items: ActivityFeedItem[] = [];
  const receipts = input.imports ?? [];

  for (const w of input.watchEvents ?? []) {
    items.push({
      kind: "finished",
      metaId: w.id,
      mediaType: withAnime(w.id, w.type),
      title: w.name,
      poster: w.poster,
      subtitle:
        w.type === "series" && w.season && w.episode ? `S${w.season} E${w.episode}` : undefined,
      at: w.at,
    });
  }

  for (const c of input.cw) {
    if (!(c.progress > 0)) continue;
    const finished = c.progress >= 0.9;
    const sub = c.type === "series" && c.season && c.episode ? `S${c.season} E${c.episode}` : undefined;
    items.push({
      kind: finished ? "finished" : "watched",
      metaId: c.id,
      mediaType: withAnime(c.id, c.type),
      title: c.name,
      poster: c.poster,
      subtitle: sub,
      at: c.at,
    });
  }
  for (const r of input.ratings) {
    if (wasImported(r.updatedAt, receipts)) continue;
    items.push({
      kind: "rated",
      metaId: r.itemKey,
      mediaType: r.mediaType,
      title: r.title,
      poster: r.poster,
      at: r.updatedAt,
      rating: r.score,
    });
  }
  for (const imp of receipts) {
    if (imp.count <= 0) continue;
    items.push({
      kind: "imported",
      metaId: `import:${imp.id}`,
      mediaType: "movie",
      title: imp.sourceLabel,
      subtitle: String(imp.count),
      at: imp.finishedAt,
      rating: imp.count,
    });
  }
  for (const f of input.favorites) {
    items.push({
      kind: "favorited",
      metaId: f.id,
      mediaType: withAnime(f.id, f.type),
      title: f.name,
      poster: f.poster,
      at: f.addedAt,
    });
  }
  for (const m of input.mangaFavorites) {
    items.push({
      kind: "favorited",
      metaId: m.id,
      mediaType: "manga",
      title: m.title,
      poster: m.cover,
      at: m.addedAt,
    });
  }

  const byKey = new Map<string, ActivityFeedItem>();
  for (const it of items) {
    if (!it.metaId || !it.title) continue;
    const key = `${it.kind}:${it.metaId}`;
    const prev = byKey.get(key);
    if (!prev || it.at > prev.at) byKey.set(key, it);
  }
  return [...byKey.values()].sort((a, b) => b.at - a.at).slice(0, MAX);
}

export function sameFeed(a: ActivityFeedItem[], b: ActivityFeedItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].kind !== b[i].kind || a[i].metaId !== b[i].metaId || a[i].rating !== b[i].rating) return false;
  }
  return true;
}

export async function pushActivity(items: ActivityFeedItem[]): Promise<void> {
  await socialPost("/social/activity", { items });
}
