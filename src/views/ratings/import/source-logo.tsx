import { ImdbIcon } from "@/components/icons/imdb-icon";
import anilistLogo from "@/assets/anilist.png";
import malLogo from "@/assets/mal.png";
import simklLogo from "@/assets/simkl.png";
import traktLogo from "@/assets/trakt.svg";
import letterboxdLogo from "@/assets/addon-logos/letterboxd.png";
import mdblistLogo from "@/assets/addon-logos/mdblist.png";
import tmdbLogo from "@/assets/addon-logos/tmdb.png";
import type { ImportSourceId } from "@/lib/ratings/import/types";

const ART: Partial<Record<ImportSourceId, string>> = {
  trakt: traktLogo,
  simkl: simklLogo,
  anilist: anilistLogo,
  mal: malLogo,
  letterboxd: letterboxdLogo,
  tmdb: tmdbLogo,
  mdblist: mdblistLogo,
};

export function SourceLogo({ id, size = 22 }: { id: ImportSourceId; size?: number }) {
  if (id === "imdb") return <ImdbIcon className="h-[18px] w-auto" />;
  const src = ART[id];
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      style={{ width: size, height: size }}
      className="object-contain"
    />
  );
}
