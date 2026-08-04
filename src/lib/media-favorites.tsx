import { createMediaListStore } from "./media-list-store";

export type { MediaEntry, MediaInput, MediaListStore } from "./media-list-store";

const store = createMediaListStore("harbor.favorites.v1.");

export const MediaFavoritesProvider = store.Provider;
export const useMediaFavorites = store.useStore;
export const useIsFavorite = store.useIn;
export const removeMediaFavorites = store.removeData;
export const setMediaFavorite = store.setExternal;
export const mediaFavoriteHas = store.hasExternal;
