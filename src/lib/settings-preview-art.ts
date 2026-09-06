import { ANIME_PREVIEW, SETTINGS_FILMS } from "@/lib/sample-artwork";
import river from "@/assets/settings-preview/steamboat-river.webp";
import wheel from "@/assets/settings-preview/steamboat-willie.webp";
import deck from "@/assets/settings-preview/steamboat-deck.webp";

export type PreviewArt = {
  posters: string[];
  anime: string[];
  stills: string[];
};

const ARTWORK: PreviewArt = {
  posters: [...SETTINGS_FILMS, ...SETTINGS_FILMS].map((film) => film.poster),
  anime: Array.from({ length: 6 }, () => ANIME_PREVIEW),
  stills: [river, wheel, deck, river, wheel, deck],
};

export function useSettingsPreviewArt(): PreviewArt {
  return ARTWORK;
}
