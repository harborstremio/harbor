import { useEffect, useMemo } from "react";
import type { Meta } from "@/lib/cinemeta";
import { detectAnimeForMetas, metaLooksAnime, useDetectedAnimeVersion } from "@/lib/anime-detect";
import { useSettings } from "@/lib/settings";

export function useHideAnime(): boolean {
  const { settings } = useSettings();
  return settings.hideContent.anime === true;
}

export function useHideAnimeMetas(metas: Meta[]): Meta[] {
  const on = useHideAnime();
  const version = useDetectedAnimeVersion();
  useEffect(() => {
    if (on) detectAnimeForMetas(metas);
  }, [on, metas]);
  return useMemo(
    () => (on ? metas.filter((m) => !metaLooksAnime(m)) : metas),
    [on, metas, version],
  );
}

export function useHideAnimeSlides<T extends { meta: Meta }>(slides: T[]): T[] {
  const on = useHideAnime();
  const version = useDetectedAnimeVersion();
  useEffect(() => {
    if (on) detectAnimeForMetas(slides.map((s) => s.meta));
  }, [on, slides]);
  return useMemo(
    () => (on ? slides.filter((s) => !metaLooksAnime(s.meta)) : slides),
    [on, slides, version],
  );
}

export function useHideAnimeRows<T extends { metas: Meta[] }>(rows: T[]): T[] {
  const on = useHideAnime();
  const version = useDetectedAnimeVersion();
  useEffect(() => {
    if (!on) return;
    for (const r of rows) detectAnimeForMetas(r.metas);
  }, [on, rows]);
  return useMemo(() => {
    if (!on) return rows;
    return rows
      .map((r) => ({ ...r, metas: r.metas.filter((m) => !metaLooksAnime(m)) }))
      .filter((r) => r.metas.length > 0);
  }, [on, rows, version]);
}
