import type { MetaType } from "@/lib/cinemeta";

/** A provider says what it carries, not what each row carries, so its answer is only a fallback
 * and anything that names its own kind overrides it. */
const META_TYPES: Readonly<Record<string, MetaType>> = {
  movie: "movie",
  documentary: "movie",
  nsfw: "movie",
  tvseries: "series",
  cartoon: "series",
  asiandrama: "series",
  anime: "anime",
  animemovie: "anime",
  ova: "anime",
  live: "tv",
};

export function metaType(raw: unknown, fallback: MetaType): MetaType {
  if (typeof raw !== "string") return fallback;
  return META_TYPES[raw.toLowerCase().replace(/[^a-z]/g, "")] ?? fallback;
}

export function providerMetaType(types: string[]): MetaType {
  for (const ty of types) {
    const hit = metaType(ty, "other");
    if (hit !== "other") return hit;
  }
  return "movie";
}
