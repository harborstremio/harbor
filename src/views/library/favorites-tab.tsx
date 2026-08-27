import { Heart } from "lucide-react";
import { useMemo } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { useMediaFavorites, type MediaEntry } from "@/lib/media-favorites";
import { useCharacterFavorites } from "@/lib/character-favorites";
import { useMangaFavorites } from "@/lib/manga-favorites";
import type { AnimeCharacter } from "@/lib/providers/anime-characters";
import { CharacterCard } from "@/views/detail/character-card";
import { MangaFavCard } from "./manga-fav-card";
import { Grid, WatchlistCard } from "./shared";

const ANIME_ID = /^(kitsu|mal|anilist|anidb|simkl):/;

function toMeta(e: MediaEntry): Meta {
  return {
    id: e.id,
    type: e.type,
    name: e.name,
    poster: e.poster,
    addonOrigin: e.addonOrigin,
    videos: e.videos,
  };
}

export function FavoritesTab() {
  const t = useT();
  const { items: mediaItems } = useMediaFavorites();
  const { items: charItems } = useCharacterFavorites();
  const { items: mangaItems } = useMangaFavorites();

  const { anime, movies, shows } = useMemo(() => {
    const all = [...mediaItems.values()].sort((a, b) => b.addedAt - a.addedAt);
    return {
      anime: all.filter((e) => ANIME_ID.test(e.id)),
      movies: all.filter((e) => !ANIME_ID.test(e.id) && e.type === "movie"),
      shows: all.filter((e) => !ANIME_ID.test(e.id) && e.type === "series"),
    };
  }, [mediaItems]);

  const characters = useMemo<AnimeCharacter[]>(
    () =>
      [...charItems.values()]
        .sort((a, b) => b.addedAt - a.addedAt)
        .map((e) => ({ id: Number(e.id), name: e.name, image: e.image })),
    [charItems],
  );

  const manga = useMemo(
    () => [...mangaItems.values()].sort((a, b) => b.addedAt - a.addedAt),
    [mangaItems],
  );

  if (
    characters.length === 0 &&
    anime.length === 0 &&
    manga.length === 0 &&
    movies.length === 0 &&
    shows.length === 0
  ) {
    return <EmptyFavorites />;
  }

  return (
    <div className="flex flex-col gap-9">
      {characters.length > 0 && (
        <Section title={t("Favorite Characters")} count={characters.length}>
          <Grid>
            {characters.map((c) => (
              <CharacterCard key={c.id} character={c} />
            ))}
          </Grid>
        </Section>
      )}
      {anime.length > 0 && (
        <Section title={t("Favorite Anime")} count={anime.length}>
          <Grid>
            {anime.map((e) => (
              <WatchlistCard key={e.id} meta={toMeta(e)} />
            ))}
          </Grid>
        </Section>
      )}
      {manga.length > 0 && (
        <Section title={t("Favorite Manga")} count={manga.length}>
          <Grid>
            {manga.map((e) => (
              <MangaFavCard key={e.id} entry={e} />
            ))}
          </Grid>
        </Section>
      )}
      {movies.length > 0 && (
        <Section title={t("Favorite Movies")} count={movies.length}>
          <Grid>
            {movies.map((e) => (
              <WatchlistCard key={e.id} meta={toMeta(e)} />
            ))}
          </Grid>
        </Section>
      )}
      {shows.length > 0 && (
        <Section title={t("Favorite Shows")} count={shows.length}>
          <Grid>
            {shows.map((e) => (
              <WatchlistCard key={e.id} meta={toMeta(e)} />
            ))}
          </Grid>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.24em] text-ink-subtle">
        {title} <span className="ms-1 text-ink-subtle/70">{count}</span>
      </h3>
      {children}
    </div>
  );
}

function EmptyFavorites() {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-edge-soft bg-canvas/30 px-8 py-16 text-center">
      <Heart size={28} strokeWidth={1.6} className="text-ink-subtle" />
      <h2 className="text-[16px] font-semibold text-ink">{t("No favorites yet")}</h2>
      <p className="max-w-md text-[13px] leading-relaxed text-ink-muted">
        {t("Tap the heart on any movie, show, manga, or character to save it here.")}
      </p>
    </div>
  );
}
