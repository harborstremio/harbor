import generalPoster from "@/assets/settings-preview/the-general-poster.webp";
import generalStill from "@/assets/settings-preview/the-general-still.webp";
import sherlockPoster from "@/assets/settings-preview/sherlock-jr-poster.webp";
import kidPoster from "@/assets/settings-preview/the-kid-poster.webp";
import safetyPoster from "@/assets/settings-preview/safety-last-poster.webp";
import namakuraStill from "@/assets/settings-preview/namakura-gatana.webp";

export type SampleArtwork = { poster: string; background: string; logo: string | null };

const ARTWORK: SampleArtwork = {
  poster: generalPoster,
  background: generalStill,
  logo: null,
};

export function useSampleArtwork(): SampleArtwork {
  return ARTWORK;
}

export const SETTINGS_SAMPLE_META = {
  id: "settings-preview-the-general",
  type: "movie" as const,
  name: "The General",
  poster: generalPoster,
  background: generalStill,
  releaseInfo: "1926",
  description: "Buster Keaton sets off to recover his stolen locomotive.",
};

export const ANIME_PREVIEW = namakuraStill;

export const SETTINGS_FILMS = [
  { id: "the-general", name: "The General", poster: generalPoster },
  { id: "sherlock-jr", name: "Sherlock Jr.", poster: sherlockPoster },
  { id: "the-kid", name: "The Kid", poster: kidPoster },
  { id: "safety-last", name: "Safety Last!", poster: safetyPoster },
];
