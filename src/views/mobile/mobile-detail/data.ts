import { useEffect, useState } from "react";
import { meta as fetchCinemetaMeta, narrowMediaType, type Meta } from "@/lib/cinemeta";
import { tmdbDetails, type TmdbDetail } from "@/lib/providers/tmdb";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export const DETAIL_CSS = `
@keyframes md-detail-in { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
@keyframes md-detail-out { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(20px); } }
@keyframes md-body-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes md-sheet-in { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes md-sheet-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes md-zoom-in { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
@keyframes md-accordion { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
.md-detail-in { animation: md-detail-in 320ms var(--ease-out) both; }
.md-detail-out { animation: md-detail-out 220ms var(--ease-out) both; }
.md-body-in { animation: md-body-in 240ms var(--ease-out) both; }
.md-sheet-in { animation: md-sheet-in 300ms var(--ease-out) both; }
.md-sheet-fade { animation: md-sheet-fade 200ms var(--ease-out) both; }
.md-zoom-in { animation: md-zoom-in 260ms var(--ease-out) both; }
.md-accordion { animation: md-accordion 200ms var(--ease-out) both; }
@media (prefers-reduced-motion: reduce) {
  .md-detail-in, .md-detail-out, .md-body-in, .md-sheet-in, .md-sheet-fade, .md-zoom-in, .md-accordion { animation: none; }
}
`;

export const HIDE_SCROLL = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export type Ep = {
  season: number;
  episode: number;
  name?: string;
  still?: string;
  overview?: string;
  runtime?: number | null;
  airDate?: string | null;
};

export type SeasonOption = { number: number; label: string };

export function useCinemetaFull(meta: Meta): Meta | null {
  const embedded = meta.videos && meta.videos.length > 0 ? meta : null;
  const [result, setResult] = useState<{
    id: string;
    meta: Meta | null;
  } | null>(null);

  useEffect(() => {
    const { id, type } = meta;
    if (!id.startsWith("tt")) return;

    let alive = true;
    fetchCinemetaMeta(narrowMediaType(type), id)
      .then((full) => {
        if (alive) setResult({ id, meta: full });
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [meta.id, meta.type]);

  return embedded ?? (result?.id === meta.id ? result.meta : null);
}

export function useTmdbDetail(
  meta: Meta,
  key: string,
): { detail: TmdbDetail | null; loading: boolean } {
  const requestKey = key ? `${key}:${meta.id}` : "";
  const [result, setResult] = useState<{
    key: string;
    meta: Meta;
    detail: TmdbDetail | null;
  } | null>(null);

  useEffect(() => {
    if (!key || !requestKey) return;

    let alive = true;
    tmdbDetails(key, meta)
      .then((detail) => {
        if (alive) setResult({ key: requestKey, meta, detail });
      })
      .catch(() => {
        if (alive) setResult({ key: requestKey, meta, detail: null });
      });

    return () => {
      alive = false;
    };
  }, [key, meta, requestKey]);

  const matchesRequest = result?.key === requestKey && result.meta === meta;
  return {
    detail: matchesRequest ? result.detail : null,
    loading: Boolean(requestKey) && !matchesRequest,
  };
}

export function seasonList(full: Meta | null, detail: TmdbDetail | null): number[] {
  const set = new Set<number>();
  for (const v of full?.videos ?? []) {
    if (typeof v.season === "number" && v.season >= 1) set.add(v.season);
  }
  if (set.size === 0) for (const s of detail?.seasons ?? []) set.add(s.seasonNumber);
  return [...set].sort((a, b) => a - b);
}

export function firstEpisode(
  full: Meta | null,
  seasons: number[],
): { season: number; episode: number } | null {
  const vids = (full?.videos ?? []).filter(
    (v) => typeof v.season === "number" && v.season >= 1 && typeof v.episode === "number",
  );
  if (vids.length > 0) {
    const sorted = [...vids].sort((a, b) => a.season! - b.season! || a.episode! - b.episode!);
    return { season: sorted[0].season!, episode: sorted[0].episode! };
  }
  if (seasons.length > 0) return { season: seasons[0], episode: 1 };
  return null;
}

export function tmdbTvId(meta: Meta, detail: TmdbDetail | null): number | null {
  if (detail?.kind === "tv" && Number.isFinite(detail.id)) return detail.id;
  const m = meta.id.match(/^tmdb:tv:(\d+)$/);
  return m ? Number(m[1]) : null;
}

export function stillFrom(path: string | null, url?: string): string | undefined {
  if (path) return path.startsWith("http") ? path : `https://image.tmdb.org/t/p/w300${path}`;
  return url;
}
