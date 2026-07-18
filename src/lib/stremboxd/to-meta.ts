import type { Meta } from "@/lib/cinemeta";
import type { StremboxdMeta } from "./types";

export function stremboxdMetaToMeta(m: StremboxdMeta): Meta {
  const releaseInfo = m.releaseInfo ?? (m.year != null ? String(m.year) : undefined);
  return {
    id: m.id,
    type: "movie",
    name: m.name,
    poster: m.poster,
    background: m.background,
    description: m.description,
    releaseInfo,
    imdbRating: m.imdbRating,
    genres: m.genres,
    runtime: m.runtime,
    trailers: m.trailers,
    links: m.links,
    behaviorHints: m.behaviorHints,
  };
}

export function letterboxdFilmUrl(meta: Meta): string | null {
  const link = meta.links?.find(
    (l) => l.category === "Letterboxd" || /letterboxd\.com\/film\//.test(l.url),
  );
  if (link) return link.url;
  if (/^tt\d+$/.test(meta.id)) return `https://letterboxd.com/imdb/${meta.id}/`;
  return null;
}
