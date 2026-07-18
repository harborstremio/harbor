import { useEffect, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { fetchGenreSample } from "@/lib/feed";
import { MOVIE_GENRES } from "@/lib/feed/tags";
import { useT } from "@/lib/i18n";
import { rpdbPoster } from "@/lib/providers/rpdb";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { Row } from "./row";
import { Poster } from "./poster";

const GENRE_PALETTE: Record<string, { from: string; to: string; ink: string }> = {
  Action: { from: "oklch(0.40 0.18 25)", to: "oklch(0.18 0.10 20)", ink: "oklch(0.96 0.02 25)" },
  Adventure: {
    from: "oklch(0.45 0.14 145)",
    to: "oklch(0.20 0.10 155)",
    ink: "oklch(0.96 0.02 145)",
  },
  Animation: {
    from: "oklch(0.50 0.16 200)",
    to: "oklch(0.20 0.10 195)",
    ink: "oklch(0.96 0.02 200)",
  },
  Comedy: { from: "oklch(0.55 0.16 75)", to: "oklch(0.22 0.08 60)", ink: "oklch(0.96 0.02 80)" },
  Crime: { from: "oklch(0.32 0.10 50)", to: "oklch(0.14 0.04 30)", ink: "oklch(0.95 0.04 60)" },
  Documentary: {
    from: "oklch(0.36 0.10 145)",
    to: "oklch(0.18 0.06 150)",
    ink: "oklch(0.96 0.02 145)",
  },
  Drama: { from: "oklch(0.36 0.12 240)", to: "oklch(0.18 0.06 230)", ink: "oklch(0.96 0.02 240)" },
  Family: { from: "oklch(0.50 0.13 100)", to: "oklch(0.20 0.08 110)", ink: "oklch(0.96 0.02 100)" },
  Fantasy: {
    from: "oklch(0.42 0.14 320)",
    to: "oklch(0.18 0.08 305)",
    ink: "oklch(0.96 0.02 320)",
  },
  History: { from: "oklch(0.42 0.10 70)", to: "oklch(0.16 0.05 55)", ink: "oklch(0.95 0.04 75)" },
  Horror: { from: "oklch(0.30 0.10 15)", to: "oklch(0.10 0.04 20)", ink: "oklch(0.94 0.02 20)" },
  Music: { from: "oklch(0.46 0.18 320)", to: "oklch(0.18 0.10 305)", ink: "oklch(0.96 0.02 320)" },
  Mystery: { from: "oklch(0.32 0.10 95)", to: "oklch(0.14 0.06 80)", ink: "oklch(0.95 0.04 90)" },
  Romance: { from: "oklch(0.45 0.15 0)", to: "oklch(0.20 0.08 350)", ink: "oklch(0.96 0.02 0)" },
  "Sci-Fi": {
    from: "oklch(0.38 0.16 285)",
    to: "oklch(0.18 0.10 280)",
    ink: "oklch(0.96 0.02 285)",
  },
  Thriller: {
    from: "oklch(0.32 0.10 200)",
    to: "oklch(0.14 0.04 220)",
    ink: "oklch(0.96 0.02 220)",
  },
  War: { from: "oklch(0.32 0.06 70)", to: "oklch(0.14 0.04 60)", ink: "oklch(0.95 0.02 75)" },
  Western: { from: "oklch(0.45 0.12 55)", to: "oklch(0.18 0.08 35)", ink: "oklch(0.96 0.04 60)" },
};

const TILES: string[] = [
  "Action",
  "Adventure",
  "Thriller",
  "Crime",
  "Drama",
  "Romance",
  "Mystery",
  "Sci-Fi",
  "Fantasy",
  "Horror",
  "Comedy",
  "Family",
  "Animation",
  "Western",
  "War",
  "History",
  "Documentary",
  "Music",
];

export function GenreTiles() {
  const t = useT();
  return (
    <Row title={t("Browse by Genre")} min={210} shape="tile" alwaysActive>
      {TILES.map((g) => (
        <GenreTile key={g} genre={g} />
      ))}
    </Row>
  );
}

function GenreTile({ genre }: { genre: string }) {
  const { settings } = useSettings();
  const { openFilter } = useView();
  const t = useT();
  const [backdrops, setBackdrops] = useState<Meta[]>([]);
  const palette = GENRE_PALETTE[genre] ?? GENRE_PALETTE.Drama;

  useEffect(() => {
    let cancelled = false;
    fetchGenreSample(settings.tmdbKey, genre)
      .then((list) => {
        if (cancelled) return;
        setBackdrops(list.filter((m) => m.background).slice(0, 3));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [genre, settings.tmdbKey]);

  const onOpen = () => {
    const id = MOVIE_GENRES[genre];
    if (id == null) return;
    openFilter({ kind: "genre", mediaType: "movie", name: genre, id });
  };

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative aspect-[5/4] w-full cursor-pointer overflow-hidden rounded-2xl border border-edge-soft text-start transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] hover:-translate-y-1"
      style={{
        background: `linear-gradient(150deg, ${palette.from}, ${palette.to})`,
      }}
    >
      <CollageBackdrop backdrops={backdrops} rpdbKey={settings.rpdbKey} />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `linear-gradient(150deg, ${palette.from} 0%, oklch(from ${palette.from} l c h / 0.55) 65%, oklch(from ${palette.to} l c h / 0.85) 100%)`,
          mixBlendMode: "multiply",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-2/5"
        style={{
          background: `linear-gradient(to bottom, transparent, ${palette.to})`,
        }}
      />
      <div className="absolute inset-x-5 bottom-5 flex items-end justify-between">
        <h3
          className="font-display text-[26px] font-medium leading-tight tracking-tight drop-shadow-[0_2px_18px_rgba(0,0,0,0.4)]"
          style={{ color: palette.ink }}
        >
          {t(genre)}
        </h3>
        <span
          className="dir-icon text-[18px] transition-transform duration-200 group-hover:translate-x-1 rtl:group-hover:-translate-x-1"
          style={{ color: palette.ink }}
          aria-hidden
        >
          ›
        </span>
      </div>
    </button>
  );
}

function CollageBackdrop({ backdrops, rpdbKey }: { backdrops: Meta[]; rpdbKey: string }) {
  if (backdrops.length === 0) return null;
  return (
    <div className="absolute inset-0 grid grid-cols-3">
      {backdrops.slice(0, 3).map((m, i) => (
        <div
          key={m.id}
          className="relative overflow-hidden"
          style={{ transform: `skewX(-8deg) translateX(${(i - 1) * 6}px)` }}
        >
          <Poster
            src={rpdbPoster(rpdbKey, m.id, m.background ?? m.poster)}
            seed={m.id}
            ratio="landscape"
            className="absolute inset-0 rounded-none [transform:skewX(8deg)_scale(1.4)]"
          />
        </div>
      ))}
    </div>
  );
}
