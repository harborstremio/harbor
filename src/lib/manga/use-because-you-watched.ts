import { useEffect, useState } from "react";
import { playbackEntries } from "@/lib/playback-history";
import { resolveAnimeSourceManga } from "@/lib/manga/anime-adaptation";
import type { MangaSummary } from "@/lib/manga/types";

const ANIME_ID = /^(kitsu|mal|anilist|anidb):/;
const MAX_ANIME = 8;
const MAX_RECS = 12;

export type WatchedMangaRec = { animeName: string; manga: MangaSummary };

function hasAnimeHistory(): boolean {
  return playbackEntries().some((e) => ANIME_ID.test(e.metaId));
}

export function useBecauseYouWatched(): { recs: WatchedMangaRec[]; loading: boolean } {
  const [recs, setRecs] = useState<WatchedMangaRec[]>([]);
  const [loading, setLoading] = useState(() => hasAnimeHistory());
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const byAnime = new Map<string, { metaId: string; animeName: string; savedAt: number }>();
      for (const e of playbackEntries()) {
        if (!ANIME_ID.test(e.metaId)) continue;
        const prev = byAnime.get(e.metaId);
        if (!prev || e.savedAt > prev.savedAt) {
          byAnime.set(e.metaId, {
            metaId: e.metaId,
            animeName: (e.title || e.parsedTitle || "").trim(),
            savedAt: e.savedAt,
          });
        }
      }
      const anime = [...byAnime.values()].sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX_ANIME);
      if (anime.length === 0) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { searchManga } = await import("@/lib/manga/api");
      const out: WatchedMangaRec[] = [];
      const seenManga = new Set<string>();
      for (const a of anime) {
        if (cancelled) return;
        const node = await resolveAnimeSourceManga(a.metaId, null, a.animeName).catch(() => null);
        if (!node?.title) continue;
        const found = (await searchManga(node.title, 0).catch(() => []))[0];
        if (!found || seenManga.has(found.id)) continue;
        seenManga.add(found.id);
        out.push({ animeName: a.animeName || node.title, manga: found });
        if (!cancelled) setRecs(out.slice());
        if (out.length >= MAX_RECS) break;
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return { recs, loading };
}
