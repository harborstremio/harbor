import type { Meta } from "@/lib/cinemeta";

/** Matches profile and shared-list navigation, including provider anime IDs. */
export function profileMediaMeta(
  id: string,
  kind?: string,
  hint?: { name?: string; poster?: string },
): Meta {
  const animeId = /^(kitsu|mal|anilist|anidb):/i.test(id);
  return {
    id,
    type:
      kind === "manga"
        ? "manga"
        : kind === "series" || kind === "tv" || kind === "anime" || animeId
          ? "series"
          : "movie",
    name: hint?.name ?? "",
    poster: hint?.poster,
  };
}
