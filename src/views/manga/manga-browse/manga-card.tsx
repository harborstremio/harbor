import { Star } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Poster } from "@/components/poster";
import type { MangaSummary } from "@/lib/manga/api";
import { useIsMangaFavorite, useMangaFavorites } from "@/lib/manga-favorites";
import { CollectionBadges } from "../collection-badge";

export function MangaCard({ manga, onOpen }: { manga: MangaSummary; onOpen: (id: string) => void }) {
  const t = useT();
  const fav = useMangaFavorites();
  const isFav = useIsMangaFavorite(manga.id);
  return (
    <button
      type="button"
      onClick={() => onOpen(manga.id)}
      className="group flex w-full min-w-0 flex-col gap-2.5 text-start"
    >
      <div className="relative w-full transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] group-hover:will-change-transform group-hover:[transform:translate3d(0,-0.5rem,0)] motion-reduce:transition-none motion-reduce:group-hover:[transform:none]">
        <Poster
          src={manga.cover}
          seed={manga.id}
          ratio="portrait"
          lazy
          className="harbor-card-ring rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] transition-[box-shadow] duration-300 group-hover:shadow-[0_24px_48px_-14px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.08)]"
        />
        <span
          role="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            fav.toggle({ id: manga.id, title: manga.title, cover: manga.cover });
          }}
          className="absolute start-1.5 top-1.5 rounded-full bg-canvas/70 p-1.5 backdrop-blur-sm transition-transform hover:scale-110 motion-reduce:transition-none motion-reduce:hover:scale-100"
        >
          <Star
            size={15}
            strokeWidth={2.2}
            className={isFav ? "fill-amber-400 text-amber-400" : "text-ink"}
          />
        </span>
        {manga.lastChapter && (
          <span className="pointer-events-none absolute end-1.5 bottom-1.5 rounded-md bg-canvas/90 px-1.5 py-0.5 text-[10.5px] font-bold text-ink ring-1 ring-edge-soft/60 backdrop-blur-sm">
            {t("Ch {n}", { n: manga.lastChapter })}
          </span>
        )}
        <div className="absolute start-1.5 bottom-1.5 flex items-center gap-1">
          <CollectionBadges title={manga.title} size={28} side="top" awardsOnly />
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="line-clamp-2 min-h-9 text-[13px] font-medium leading-snug text-ink">
          {manga.title}
        </p>
        {manga.year != null && <p className="text-[12px] text-ink-subtle">{manga.year}</p>}
      </div>
    </button>
  );
}
