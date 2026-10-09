import type { Meta } from "@/lib/cinemeta";

const ANIME_ID_PREFIXES = ["kitsu:", "mal:", "anilist:", "anidb:"];

export function metaIsAnime(meta: Pick<Meta, "id" | "genres">): boolean {
  const id = meta.id ?? "";
  if (ANIME_ID_PREFIXES.some((p) => id.startsWith(p))) return true;
  return (meta.genres ?? []).some((g) => {
    const l = g.toLowerCase();
    return l === "anime" || l === "animation";
  });
}
