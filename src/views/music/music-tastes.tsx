import { useEffect, useRef, useState } from "react";
import { ChevronLeft, SlidersHorizontal } from "@/components/icons/music-icons";
import { MusicGenreBrowser } from "./music-genre-browser";
import { useT } from "@/lib/i18n";
import {
  loadMusicDiscoveryChart,
  loadMusicDiscoveryGenres,
} from "@/lib/music/discovery";
import { readMusicPreference, writeMusicPreference } from "@/lib/music/preferences";
import type { MusicCatalogRow as CatalogRow } from "@/lib/music/types";
import "./music-tastes.css";

const TASTES_KEY = "harbor.music.tastes.v1";
export function readMusicTastes(): number[] {
  try {
    const stored: unknown = JSON.parse(readMusicPreference(TASTES_KEY) ?? "[]");
    return Array.isArray(stored)
      ? [...new Set(stored.filter((id): id is number => Number.isSafeInteger(id) && id > 0))]
      : [];
  } catch {
    return [];
  }
}

export function MusicTastes({
  selected,
  onSave,
  onBack,
}: {
  selected: number[];
  onSave: (ids: number[]) => void;
  onBack: () => void;
}) {
  const t = useT();
  const heading = useRef<HTMLHeadingElement>(null);
  const [draft, setDraft] = useState(selected);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  return (
    <section className="music-tastes">
      <button type="button" className="music-tastes-back" data-music-inner-back onClick={onBack}>
        <ChevronLeft className="dir-icon" size={18} />
        {t("music.watch.back")}
      </button>
      <header>
        <SlidersHorizontal size={26} />
        <h1 ref={heading} tabIndex={-1}>
          {t("music.taste.choose")}
        </h1>
        <p>{t("music.taste.body")}</p>
      </header>
      <MusicGenreBrowser mode="tastes" selected={draft} onSelect={genre =>
        setDraft(values => values.includes(genre.id) ? values.filter(id => id !== genre.id) : [...values, genre.id])
      } />
      <footer>
        <div><p>{t("music.taste.local")}</p><button type="button" className="music-home-text" disabled={!draft.length} onClick={() => setDraft([])}>{t("music.taste.clear")}</button></div>
        <button
          type="button"
          className="music-home-primary"
          onClick={() => {
            writeMusicPreference(TASTES_KEY, JSON.stringify(draft));
            onSave(draft);
          }}
        >
          {t("music.taste.save")}
        </button>
      </footer>
    </section>
  );
}

export function useMusicTasteRows(selected: number[]) {
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    setRows([]);
    setError(false);
    setLoading(selected.length > 0);
    if (!selected.length) return;
    (async () => {
      const all = await loadMusicDiscoveryGenres();
      // Rotate a bounded selection instead of requesting every selected genre on mount.
      const offset = Math.floor(Date.now() / 86_400_000) % selected.length;
      const picks = [...selected.slice(offset), ...selected.slice(0, offset)].slice(0, 6);
      const genres = picks.flatMap((id) => all.find((genre) => genre.id === id) ?? []);
      for (let at = 0; at < genres.length && live; at += 3) {
        const batch = await Promise.allSettled(
          genres.slice(at, at + 3).map(async (genre) => {
            const chart = await loadMusicDiscoveryChart(genre.id);
            return {
              id: `taste:${genre.id}`,
              title: genre.name,
              titleLiteral: true,
              layout: "trackGrid" as const,
              source: "deezer",
              items: chart.tracks.map((track) => ({ ...track, kind: "track" as const })),
            };
          }),
        );
        if (!live) return;
        if (batch.some((result) => result.status === "rejected")) setError(true);
        setRows((previous) => [
          ...previous,
          ...batch.flatMap((result) =>
            result.status === "fulfilled" && result.value.items.length ? [result.value] : [],
          ),
        ]);
      }
    })()
      .catch(() => {
        if (live) setError(true);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [selected, retry]);
  return { rows, error, loading, retry: () => setRetry((value) => value + 1) };
}
