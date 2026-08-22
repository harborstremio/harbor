import type { Addon } from "../addons.ts";
import type { Meta } from "../cinemeta.ts";
import type { AnimeKitsuMeta } from "../providers/anime-kitsu-addon.ts";

export type AutoDownloadMetaRef = {
  id: string;
  type: string;
  title: string;
  poster?: string;
  addonBase?: string;
  addonType?: string;
};

export type AutoDownloadMetaDeps = {
  fetchCinemeta: (type: "series", id: string) => Promise<Meta | null>;
  fetchAnime: (id: string) => Promise<AnimeKitsuMeta | null>;
  fetchAddon: (base: string, type: string, id: string) => Promise<Meta | null>;
  addonAccepts: (addon: Addon, resource: string, type: string, id: string) => boolean;
};

const defaultDeps: AutoDownloadMetaDeps = {
  fetchCinemeta: async (type, id) => {
    const { meta } = await import("@/lib/cinemeta");
    return meta(type, id);
  },
  fetchAnime: async (id) => {
    const { animeKitsuMeta } = await import("@/lib/providers/anime-kitsu-addon");
    return animeKitsuMeta(id);
  },
  fetchAddon: async (base, type, id) => {
    const { fetchAddonMeta } = await import("@/lib/addons");
    return fetchAddonMeta(base, type, id);
  },
  addonAccepts: (addon, resource, type, id) => {
    const manifest = addon.manifest;
    const resources = manifest.resources ?? [];
    const specific = resources.filter(
      (entry): entry is { name: string; types?: string[]; idPrefixes?: string[] } =>
        typeof entry === "object" && entry.name === resource,
    );
    if (specific.length > 0) {
      return specific.some(
        (entry) =>
          (entry.types?.includes(type) ?? false) &&
          (!entry.idPrefixes ||
            entry.idPrefixes.length === 0 ||
            entry.idPrefixes.some((prefix) => id.startsWith(prefix))),
      );
    }
    return (
      resources.includes(resource) &&
      (manifest.types?.includes(type) ?? false) &&
      (!manifest.idPrefixes ||
        manifest.idPrefixes.length === 0 ||
        manifest.idPrefixes.some((prefix) => id.startsWith(prefix)))
    );
  },
};

function isAnimeId(id: string): boolean {
  return /^(kitsu|mal|anilist|anidb):/.test(id);
}

function candidateTypes(series: AutoDownloadMetaRef): string[] {
  const types = [
    series.addonType,
    series.type === "anime" ? "series" : series.type,
    "series",
  ].filter((type): type is string => !!type);
  return [...new Set(types)];
}

function hasEpisodes(meta: Meta | null): meta is Meta {
  return (meta?.videos?.length ?? 0) > 0;
}

function withAddonOrigin(meta: Meta, addon: Addon): Meta {
  if (meta.addonOrigin?.base) return meta;
  return {
    ...meta,
    addonOrigin: {
      id: addon.manifest.id,
      name: addon.manifest.name || addon.manifest.id,
      logo: addon.manifest.logo,
      base: addon.transportUrl.replace(/\/manifest\.json$/, ""),
    },
  };
}

function animeAsMeta(meta: AnimeKitsuMeta): Meta {
  return {
    id: meta.id,
    type: meta.type,
    name: meta.name,
    poster: meta.poster,
    background: meta.background,
    logo: meta.logo,
    description: meta.description,
    releaseInfo: meta.releaseInfo,
    imdbRating: meta.imdbRating,
    videos: meta.videos.map((video) => ({
      id: video.id,
      title: video.title,
      season: video.season,
      episode: video.episode,
      released: video.released,
      ...(video.thumbnail ? { thumbnail: video.thumbnail } : {}),
      ...(video.overview ? { overview: video.overview } : {}),
    })),
  };
}

export async function resolveAutoDownloadMeta(
  series: AutoDownloadMetaRef,
  addons: Addon[],
  deps: AutoDownloadMetaDeps = defaultDeps,
): Promise<Meta | null> {
  const types = candidateTypes(series);

  if (series.addonBase) {
    for (const type of types) {
      const meta = await deps.fetchAddon(series.addonBase, type, series.id).catch(() => null);
      if (hasEpisodes(meta)) {
        return {
          ...meta,
          addonOrigin: {
            id: meta.addonOrigin?.id ?? "saved-addon",
            name: meta.addonOrigin?.name ?? "Saved addon",
            logo: meta.addonOrigin?.logo,
            base: series.addonBase,
          },
        };
      }
    }
  }

  if (isAnimeId(series.id)) {
    const anime = await deps.fetchAnime(series.id).catch(() => null);
    if (anime?.type === "series" && anime.videos.length > 0) return animeAsMeta(anime);
  }

  if (series.type === "series" || series.type === "anime" || isAnimeId(series.id)) {
    const cinemeta = await deps.fetchCinemeta("series", series.id).catch(() => null);
    if (hasEpisodes(cinemeta)) return cinemeta;
  }

  const seen = new Set<string>();
  for (const addon of addons) {
    const base = addon.transportUrl.replace(/\/manifest\.json$/, "");
    if (!base || seen.has(base)) continue;
    seen.add(base);
    for (const type of types) {
      if (!deps.addonAccepts(addon, "meta", type, series.id)) continue;
      const meta = await deps.fetchAddon(base, type, series.id).catch(() => null);
      if (hasEpisodes(meta)) return withAddonOrigin(meta, addon);
    }
  }

  return null;
}
