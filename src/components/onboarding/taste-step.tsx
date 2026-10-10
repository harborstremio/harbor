import { useEffect, useState } from "react";
import { Poster } from "@/components/poster";
import { topMovies, topSeries, type Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { tmdbDiscover, tmdbTrending } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";

export const TASTE_MAX = 5;
const CAP = 40;

const GENRE_IDS = [
  "28",
  "35",
  "18",
  "878",
  "27",
  "53",
  "10749",
  "16",
  "14",
  "80",
  "37",
  "12",
  "9648",
  "99",
  "10752",
];
const GENRE_FALLBACK = ["Western", "Documentary", "Animation", "Crime", "Comedy"];

function mix(lists: Meta[][]): Meta[] {
  const seen = new Set<string>();
  const out: Meta[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest && out.length < CAP; i += 1) {
    for (const list of lists) {
      const m = list[i];
      if (m?.poster && !seen.has(m.id)) {
        seen.add(m.id);
        out.push(m);
        if (out.length >= CAP) break;
      }
    }
  }
  return out;
}

async function loadTitles(tmdbKey: string): Promise<Meta[]> {
  if (tmdbKey) {
    const [movies, series, ...byGenre] = await Promise.all([
      tmdbTrending(tmdbKey, "movie", "week").catch(() => [] as Meta[]),
      tmdbTrending(tmdbKey, "tv", "week").catch(() => [] as Meta[]),
      ...GENRE_IDS.map((id) =>
        tmdbDiscover(tmdbKey, "movie", {
          with_genres: id,
          sort_by: "popularity.desc",
          "vote_count.gte": "800",
          "vote_average.gte": "6.4",
        })
          .then((r) => r.slice(0, 2))
          .catch(() => [] as Meta[]),
      ),
    ]);
    const mixed = mix([movies, series, ...byGenre]);
    if (mixed.length >= 16) return mixed;
  }
  const [m, s, ...genreMovies] = await Promise.all([
    topMovies().catch(() => [] as Meta[]),
    topSeries().catch(() => [] as Meta[]),
    ...GENRE_FALLBACK.map((g) => topMovies(g).catch(() => [] as Meta[])),
  ]);
  return mix([m, s, ...genreMovies]);
}

export function TasteStep({
  selected,
  onToggle,
}: {
  selected: Meta[];
  onToggle: (m: Meta) => void;
}) {
  const t = useT();
  const { settings } = useSettings();
  const [items, setItems] = useState<Meta[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadTitles(settings.tmdbKey).then((list) => {
      if (!cancelled) setItems(list);
    });
    return () => {
      cancelled = true;
    };
  }, [settings.tmdbKey]);

  const selectedIds = new Set(selected.map((m) => m.id));
  const atMax = selected.length >= TASTE_MAX;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[23px] font-semibold tracking-tight text-ink">
          {t("Pick a few you love")}
        </h2>
        <p className="text-[13.5px] leading-relaxed text-ink-muted">
          {t(
            "Choose up to 5 movies or shows you already like. Harbor uses them to tune your featured picks and recommendations. Totally optional.",
          )}
        </p>
      </div>
      {items === null ? (
        <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-5">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-raised" />
          ))}
        </div>
      ) : (
        <div className="-mx-1 max-h-[46vh] overflow-y-auto px-1 py-0.5">
          <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-5">
            {items.map((m) => {
              const sel = selectedIds.has(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onToggle(m)}
                  disabled={!sel && atMax}
                  aria-pressed={sel}
                  className={`group relative block overflow-hidden rounded-xl transition duration-200 disabled:pointer-events-none ${
                    sel ? "" : atMax ? "opacity-40" : "active:scale-[0.98]"
                  }`}
                >
                  <Poster src={m.poster} seed={m.id} ratio="portrait" />
                  <span
                    className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 transition-opacity duration-200 ease-out ${
                      sel ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    <img
                      src="/thumbsup.png"
                      alt=""
                      draggable={false}
                      className={`h-[40%] w-[40%] object-contain drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] transition-transform duration-200 ease-out ${
                        sel ? "scale-100" : "scale-75 group-hover:scale-100"
                      }`}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
