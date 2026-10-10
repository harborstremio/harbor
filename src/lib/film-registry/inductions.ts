import raw from "@/data/film-registry/inductions.json";
import type { InductionFile } from "./types";

const file = raw as InductionFile;

export const REGISTRY_LIST_ID = "national-film-registry";
export const REGISTRY_LATEST_LIST_ID = "national-film-registry-latest";

export function inductionYear(imdbId: string | null | undefined): number | null {
  if (!imdbId) return null;
  const year = file.inductions[imdbId];
  return typeof year === "number" ? year : null;
}
