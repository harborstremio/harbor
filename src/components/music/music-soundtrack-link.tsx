import { useEffect, useState } from "react";
import { ArrowUpRight, Clapperboard } from "@/components/icons/music-icons";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { searchCinemeta } from "@/lib/search";
import { bestFilmMatch, soundtrackFilmTitle } from "@/lib/music/soundtrack";
import type { Meta } from "@/lib/cinemeta";
import "./music-soundtrack-link.css";

export function MusicSoundtrackLink({
  title,
  album,
  release,
}: {
  title?: string;
  album?: string;
  release?: string;
}) {
  const t = useT();
  const { openMeta } = useView();
  const film = soundtrackFilmTitle(title, album, release);
  const [found, setFound] = useState<{ film: string; meta: Meta | null } | null>(null);
  useEffect(() => {
    if (!film) return;
    let alive = true;
    void searchCinemeta(film)
      .then(({ movies }) => {
        if (alive) setFound({ film, meta: bestFilmMatch(movies, film) });
      })
      .catch(() => {
        if (alive) setFound({ film, meta: null });
      });
    return () => {
      alive = false;
    };
  }, [film]);
  const meta = film && found?.film === film ? found.meta : null;
  if (!meta) return null;
  return (
    <button type="button" className="music-soundtrack-link" onClick={() => openMeta(meta)}>
      {meta.poster ? (
        <img src={meta.poster} alt="" />
      ) : (
        <span className="music-soundtrack-glyph">
          <Clapperboard size={18} aria-hidden="true" />
        </span>
      )}
      <span>
        <small>{t("From the motion picture")}</small>
        <strong>{meta.name}</strong>
        {meta.releaseInfo && <small>{meta.releaseInfo}</small>}
      </span>
      <ArrowUpRight size={16} aria-hidden="true" />
    </button>
  );
}
