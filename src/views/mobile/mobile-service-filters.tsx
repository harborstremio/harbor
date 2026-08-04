export type ServiceMedia = "movie" | "tv";

export type Genre = {
  id: string;
  label: string;
  movie?: number;
  tv?: number;
};

export const GENRES: Genre[] = [
  { id: "all", label: "All" },
  { id: "action", label: "Action", movie: 28, tv: 10759 },
  { id: "comedy", label: "Comedy", movie: 35, tv: 35 },
  { id: "drama", label: "Drama", movie: 18, tv: 18 },
  { id: "scifi", label: "Sci-Fi & Fantasy", movie: 878, tv: 10765 },
  { id: "horror", label: "Horror", movie: 27, tv: 9648 },
  { id: "thriller", label: "Thriller", movie: 53 },
  { id: "romance", label: "Romance", movie: 10749 },
  { id: "docs", label: "Documentary", movie: 99, tv: 99 },
  { id: "anim", label: "Animation", movie: 16, tv: 16 },
  { id: "kids", label: "Kids & Family", movie: 10751, tv: 10751 },
  { id: "reality", label: "Reality", tv: 10764 },
];

export function genreAvailable(genre: Genre, media: ServiceMedia): boolean {
  if (genre.id === "all") return true;
  return media === "movie" ? genre.movie != null : genre.tv != null;
}

export function genreParam(genre: Genre, media: ServiceMedia): string | undefined {
  const id = media === "movie" ? genre.movie : genre.tv;
  return id != null ? String(id) : undefined;
}

export function MediaToggle({
  media,
  onChange,
  labels,
}: {
  media: ServiceMedia;
  onChange: (m: ServiceMedia) => void;
  labels?: { movie: string; tv: string };
}) {
  const lbl = labels ?? { movie: "Movies", tv: "Shows" };
  return (
    <div
      role="tablist"
      aria-label="Media type"
      className="inline-flex gap-1 rounded-full bg-elevated/60 p-1 ring-1 ring-edge-soft/60"
    >
      {(["movie", "tv"] as const).map((m) => {
        const active = media === m;
        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m)}
            className={`h-9 rounded-full px-6 text-[13.5px] font-semibold transition-[color,background-color,transform] active:scale-[0.97] ${
              active ? "bg-ink text-canvas" : "text-ink-muted"
            }`}
          >
            {m === "movie" ? lbl.movie : lbl.tv}
          </button>
        );
      })}
    </div>
  );
}

export function ServiceFilters({
  media,
  genre,
  onMediaChange,
  onGenreChange,
}: {
  media: ServiceMedia;
  genre: Genre;
  onMediaChange: (m: ServiceMedia) => void;
  onGenreChange: (g: Genre) => void;
}) {
  const genres = GENRES.filter((g) => genreAvailable(g, media));
  return (
    <div className="flex flex-col gap-3.5">
      <div className="px-4">
        <MediaToggle media={media} onChange={onMediaChange} />
      </div>
      <div
        role="tablist"
        aria-label="Genre"
        className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {genres.map((g) => {
          const active = g.id === genre.id;
          return (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onGenreChange(g)}
              className={`h-9 shrink-0 rounded-full px-4 text-[13px] font-medium transition-[color,background-color,transform] active:scale-[0.97] ${
                active
                  ? "bg-ink text-canvas"
                  : "bg-elevated/60 text-ink-muted ring-1 ring-edge-soft/60"
              }`}
            >
              {g.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
