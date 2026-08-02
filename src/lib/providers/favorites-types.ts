import { searchArtists } from "./artists";
import { searchBooks } from "./books";
import { searchGames } from "./games";

export type FavoriteKind = "game" | "book" | "music";

export type FavoriteMedia = {
  kind: FavoriteKind;
  id: string;
  name: string;
  image: string | null;
  imageFallback?: string | null;
  sub: string | null;
  url: string | null;
  source: string;
};

export type FavoriteSearchResult =
  | { status: "ok"; items: FavoriteMedia[] }
  | { status: "empty" }
  | { status: "failed"; reason: string }
  | { status: "needs-key" };

export type FavoriteSearchOptions = { signal?: AbortSignal; limit?: number };

export function searchFavorites(
  kind: FavoriteKind,
  query: string,
  opts: FavoriteSearchOptions = {},
): Promise<FavoriteSearchResult> {
  if (kind === "game") return searchGames(query, opts);
  if (kind === "book") return searchBooks(query, opts);
  return searchArtists(query, opts);
}
