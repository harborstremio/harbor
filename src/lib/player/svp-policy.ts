type SvpSettings = {
  playerSvp: boolean;
  svpVpyPath: string;
  svpScope: "all" | "anime" | "non-anime";
};

type MediaMeta = {
  id?: string;
  genres?: string[];
};

export function isAnimeMedia(meta: MediaMeta | undefined): boolean {
  if (!meta) return false;
  return (
    meta.id?.startsWith("kitsu:") === true ||
    meta.id?.startsWith("mal:") === true ||
    meta.id?.startsWith("anilist:") === true ||
    meta.id?.startsWith("anidb:") === true ||
    (meta.genres ?? []).some((genre) => {
      const normalized = genre.toLowerCase();
      return normalized === "anime" || normalized === "animation";
    })
  );
}

export function isSvpActiveForMedia(settings: SvpSettings, meta: MediaMeta | undefined): boolean {
  if (!settings.playerSvp || settings.svpVpyPath.length === 0) return false;
  if (settings.svpScope === "all") return true;
  const anime = isAnimeMedia(meta);
  return settings.svpScope === "anime" ? anime : !anime;
}
