export type GameSummary = {
  /** Artwork imported with an exact metadata match; personal/local artwork takes precedence. */
  importedArtwork?: import("./imported-artwork").ImportedArtwork;
  /** Validated public website destinations, kept separate from downloads and launch commands. */
  links?: import("./library-links").GameLink[];
  id: string;
  /** Local presentation preference owner; never an executable or store association. */
  libraryEntryId?: string;
  steamId?: number;
  igdbId?: number;
  /** Provider classification and rating volume used to rank equally relevant search matches. */
  gameType?: number;
  igdbRatingCount?: number;
  /** Exact native publisher catalog association, independent of Steam ownership/dispatch. */
  catalogSteamId?: number;
  name: string;
  capsule: string;
  portrait?: string;
  /** Steam adult-only or frequent sexual content; undefined means not checked. */
  adultContent?: boolean;
  releaseTimestamp?: number;
  comingSoon?: boolean;
  platforms: string[];
  price?: { amount: number; currency: string; discount: number };
  /** Present only when displaying a disk snapshot instead of a fresh provider result. */
  cachedAt?: number;
  /** Selected release provenance, separate from catalog/artwork identity. */
  sourceOrigin?: import('./source-origin').SourceOrigin;
  /** Published release-page metadata for games not indexed by Steam or IGDB. */
  sourceListing?: { page: string; sourceName: string; description: string; screenshots: string[] };
};

export type GameDetail = GameSummary & {
  steamId: number;
  description: string;
  about: string;
  /** Untrusted publisher markup; render only through the detail sanitizer. */
  aboutHtml?: string;
  hero: string;
  libraryHero?: string;
  logo: string;
  screenshots: string[];
  /** Exact full-image URL to provider thumbnail; old snapshots may not have these. */
  screenshotThumbnails?: Record<string, string>;
  trailers: { name: string; poster: string; url: string }[];
  genres: string[];
  features: string[];
  featureCategories?: { id: number; name: string }[];
  developers: string[];
  publishers: string[];
  release: string;
  comingSoon: boolean;
  controller?: string;
  requirements: { minimum: string; recommended: string };
  languages: string;
  achievements?: number;
  achievementHighlights?: { name: string; icon: string }[];
  recommendations?: number;
  metacritic?: { score: number; url: string };
};

export type GameShelf = {
  id: "top_sellers" | "new_releases" | "coming_soon" | "specials";
  games: GameSummary[];
};
export type GameDiscovery = { shelves: GameShelf[]; fetchedAt: number; source: "Steam"; enriched?: boolean; cachedAt?: number };

export type GameArtwork = { libraryHero?: string; portrait?: string; wideCapsule?: string };

export type GameCatalogPage = { games: GameSummary[]; total: number; nextOffset: number | null; cachedAt?: number };
