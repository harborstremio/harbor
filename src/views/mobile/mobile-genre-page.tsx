import { useCallback, useState } from "react";
import { ChevronLeft, Film } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import { topMovies, topSeries } from "@/lib/cinemeta";
import { tmdbDiscover } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { MobileDetail } from "./mobile-detail";
import { MediaToggle, type ServiceMedia } from "./mobile-service-filters";
import {
  MAX_PAGE,
  MobileCatalogGrid,
  TMDB_PAGE_SIZE,
  type CatalogFetch,
} from "./mobile-catalog-page";

const CINEMETA_PAGE = 100;
const CINEMETA_MAX_PAGE = 6;

const GENRE_TMDB: Record<string, { movie?: number; tv?: number }> = {
  Action: { movie: 28, tv: 10759 },
  Adventure: { movie: 12, tv: 10759 },
  Comedy: { movie: 35, tv: 35 },
  Crime: { movie: 80, tv: 80 },
  Drama: { movie: 18, tv: 18 },
  Fantasy: { movie: 14, tv: 10765 },
  Horror: { movie: 27 },
  Mystery: { movie: 9648, tv: 9648 },
  Romance: { movie: 10749 },
  "Sci-Fi": { movie: 878, tv: 10765 },
  Thriller: { movie: 53 },
  Animation: { movie: 16, tv: 16 },
  Documentary: { movie: 99, tv: 99 },
  Family: { movie: 10751, tv: 10751 },
  War: { movie: 10752, tv: 10768 },
  Western: { movie: 37, tv: 37 },
};

const GENRE_MOTION_CSS = `
.harbor-genre-page {
  animation: harbor-genre-page 320ms var(--ease-out) both;
}
@keyframes harbor-genre-page {
  from { opacity: 0; transform: translate3d(0, 14px, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .harbor-genre-page { animation: none; }
}
`;

export function MobileGenrePage({
  genre,
  onBack,
}: {
  genre: { label: string; genre: string };
  onBack: () => void;
}) {
  const { settings } = useSettings();
  const [media, setMedia] = useState<ServiceMedia>("movie");
  const [detailMeta, setDetailMeta] = useState<Meta | null>(null);

  const key = settings.tmdbKey;
  const tmdbId = media === "movie" ? GENRE_TMDB[genre.genre]?.movie : GENRE_TMDB[genre.genre]?.tv;
  const usesTmdb = !!(key && tmdbId != null);

  const fetchPage = useCallback<CatalogFetch>(
    (page) => {
      if (key && tmdbId != null) {
        return tmdbDiscover(key, media, {
          with_genres: String(tmdbId),
          sort_by: "popularity.desc",
          include_adult: "false",
          "vote_count.gte": "30",
          page: String(page),
        }).then((metas) => ({ metas, more: metas.length >= TMDB_PAGE_SIZE && page < MAX_PAGE }));
      }
      const skip = (page - 1) * CINEMETA_PAGE;
      const req = media === "movie" ? topMovies(genre.genre, skip) : topSeries(genre.genre, skip);
      return req.then((metas) => ({
        metas,
        more: metas.length >= CINEMETA_PAGE && page < CINEMETA_MAX_PAGE,
      }));
    },
    [key, tmdbId, media, genre.genre],
  );

  return (
    <div
      className="harbor-genre-page flex flex-col gap-6"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 40px)" }}
    >
      <style>{GENRE_MOTION_CSS}</style>
      <GenreHeader label={genre.label} onBack={onBack} />
      <div className="px-4">
        <MediaToggle
          media={media}
          onChange={setMedia}
          labels={{ movie: "Movies", tv: "TV Shows" }}
        />
      </div>
      <MobileCatalogGrid
        fetchPage={fetchPage}
        resetKey={`${genre.genre}:${media}:${usesTmdb ? "t" : "c"}`}
        enabled
        initialPages={usesTmdb ? 2 : 1}
        emptyState={<GenreEmpty label={genre.label} />}
        onOpenDetail={setDetailMeta}
      />

      {detailMeta && <MobileDetail meta={detailMeta} onClose={() => setDetailMeta(null)} />}
    </div>
  );
}

function GenreHeader({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-accent/12 to-transparent"
      />
      <div
        className="relative flex flex-col gap-4 px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="-ms-2 flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-transform active:scale-[0.96]"
        >
          <ChevronLeft size={24} strokeWidth={2.4} className="dir-icon" />
        </button>
        <div className="flex flex-col gap-2 pb-1">
          <span className="text-[11.5px] font-medium uppercase tracking-[0.2em] text-ink-subtle">
            Genre
          </span>
          <h1 className="font-display text-[28px] font-medium leading-none tracking-tight text-ink">
            {label}
          </h1>
          <p className="max-w-md text-[13.5px] leading-relaxed text-ink-muted">
            The best {label.toLowerCase()} movies and shows, updated constantly.
          </p>
        </div>
      </div>
    </div>
  );
}

function GenreEmpty({ label }: { label: string }) {
  return (
    <div className="flex min-h-[42vh] flex-col items-center justify-center gap-4 px-8 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-elevated/60 text-ink-subtle ring-1 ring-edge-soft/60">
        <Film size={26} strokeWidth={1.8} />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-[19px] font-medium text-ink">Nothing to show yet</h2>
        <p className="max-w-xs text-[13.5px] leading-relaxed text-ink-muted">
          No {label.toLowerCase()} titles to show right now. Try switching between Movies and TV
          Shows.
        </p>
      </div>
    </div>
  );
}
