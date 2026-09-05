import { IMG } from "./tmdb-client";

export const POSTER_RUNG = "w500";
export const POSTER_THUMB_RUNG = "w342";
export const BACKDROP_RUNG = "w780";
export const LOGO_RUNG = "w500";
export const STILL_RUNG = "w300";

export function tmdbPosterUrl(path?: string | null): string | undefined {
  return path ? `${IMG}/${POSTER_RUNG}${path}` : undefined;
}

export function tmdbPosterThumbUrl(path?: string | null): string | undefined {
  return path ? `${IMG}/${POSTER_THUMB_RUNG}${path}` : undefined;
}

export function tmdbBackdropUrl(path?: string | null): string | undefined {
  return path ? `${IMG}/${BACKDROP_RUNG}${path}` : undefined;
}

export function tmdbLogoUrl(path?: string | null): string | undefined {
  return path ? `${IMG}/${LOGO_RUNG}${path}` : undefined;
}

export function tmdbStillUrl(path?: string | null): string | undefined {
  return path ? `${IMG}/${STILL_RUNG}${path}` : undefined;
}
