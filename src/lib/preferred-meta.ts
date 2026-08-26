import type { Meta } from "@/lib/cinemeta";

type MetaVideo = NonNullable<Meta["videos"]>[number];

export function mergePreferredMeta(base: Meta, preferred: Meta | null): Meta {
  if (!preferred) return base;
  return {
    ...base,
    name: preferred.name?.trim() || base.name,
    description: preferred.description?.trim() || base.description,
    poster: preferred.poster || base.poster,
    background: preferred.background || base.background,
    logo: preferred.logo || base.logo,
    videos: preferred.videos?.length ? preferred.videos : base.videos,
    addonOrigin: preferred.addonOrigin ?? base.addonOrigin,
  };
}

export function preferredEpisodeVideo(
  videos: Meta["videos"] | undefined,
  season: number,
  episode: number,
): MetaVideo | undefined {
  return videos?.find(
    (video) => video.season === season && (video.episode ?? video.number) === episode,
  );
}

export function preferredEpisodeName(video: MetaVideo | undefined): string | undefined {
  return video?.name?.trim() || video?.title?.trim() || undefined;
}

export function preferredEpisodeOverview(video: MetaVideo | undefined): string | undefined {
  return video?.overview?.trim() || video?.description?.trim() || undefined;
}
