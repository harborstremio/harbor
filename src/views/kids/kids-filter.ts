import type { Meta } from "@/lib/cinemeta";

import { releaseYear } from "@/lib/release-info";
export function dropUnreleased(metas: Meta[]): Meta[] {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yearNow = now.getUTCFullYear();
  return metas.filter((m) => {
    if (m.releaseDate) return m.releaseDate.slice(0, 10) <= today;
    const y = releaseYear(m.releaseInfo);
    return !Number.isFinite(y) || y <= yearNow;
  });
}

const UNSAFE_CINEMETA_GENRE = /^(action|biography|crime|history|horror|romance|thriller|war)$/i;

export function dropUnsafeGenres(metas: Meta[]): Meta[] {
  return metas.filter((meta) => !meta.adult);
}

export function dropUnsafeCinemetaKids(metas: Meta[]): Meta[] {
  return dropUnsafeGenres(metas).filter((meta) => {
    const genres = meta.genres ?? [];
    return (
      !genres.some((genre) => UNSAFE_CINEMETA_GENRE.test(genre.trim())) &&
      (genres.includes("Family") || (genres.includes("Animation") && genres.includes("Comedy")))
    );
  });
}
