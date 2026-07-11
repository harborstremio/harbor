import { tmdbDiscover } from "@/lib/providers/tmdb/tmdb-catalogs";
import { useCallback, useEffect, useRef, useState } from "react";

const CYCLE_MS = 7000;
const IMAGE_OPACITY = 0.45;

export function GenreBackdrop({
  genreId,
  mediaType,
  tmdbKey,
}: {
  genreId?: number;
  mediaType: "movie" | "tv";
  tmdbKey: string | null;
}) {
  const [slots, setSlots] = useState<[string | null, string | null]>([null, null]);
  const [top, setTop] = useState(0);
  const topRef = useRef(0);
  const curUrlRef = useRef<string | null>(null);
  const urlsRef = useRef<string[]>([]);
  const posRef = useRef(0);

  const show = useCallback((url: string) => {
    if (url === curUrlRef.current) return;
    const hidden = topRef.current === 0 ? 1 : 0;
    curUrlRef.current = url;
    setSlots((s) => {
      const n: [string | null, string | null] = [s[0], s[1]];
      n[hidden] = url;
      return n;
    });
    topRef.current = hidden;
    setTop(hidden);
  }, []);

  useEffect(() => {
    if (!tmdbKey || !genreId) {
      urlsRef.current = [];
      return;
    }
    let cancel = false;
    tmdbDiscover(tmdbKey, mediaType, {
      with_genres: String(genreId),
      sort_by: "popularity.desc",
      "vote_count.gte": "150",
      page: "1",
    })
      .then((metas) => {
        if (cancel) return;
        const urls = metas
          .map((m) => m.background)
          .filter((b): b is string => !!b)
          .slice(0, 6);
        if (urls.length === 0) return;
        urlsRef.current = urls;
        posRef.current = 0;
        show(urls[0]);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [tmdbKey, genreId, mediaType, show]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const urls = urlsRef.current;
      if (urls.length < 2) return;
      posRef.current = (posRef.current + 1) % urls.length;
      show(urls[posRef.current]);
    }, CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [show]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: slots[i] ? `url(${slots[i]})` : undefined,
            opacity: top === i && slots[i] ? IMAGE_OPACITY : 0,
            transition: "opacity 1300ms ease-out",
          }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/30 via-neutral-950/72 to-neutral-950" />
    </div>
  );
}
