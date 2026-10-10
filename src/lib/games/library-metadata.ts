import { parseImportedArtwork } from "./imported-artwork";
import type { GameSummary } from "./types";

export type LibraryMetadataMatch = Pick<GameSummary, "name" | "capsule" | "portrait" | "platforms" | "releaseTimestamp" | "importedArtwork"> & { igdbId: number };
const text = (value: unknown, max: number): value is string => typeof value === "string" && !!value.trim() && value.length <= max && !/[\x00-\x1f\x7f]/.test(value);
const art = (value: unknown): value is string => value === "" || typeof value === "string" && /^https:\/\/images\.igdb\.com\/igdb\/image\/upload\/t_[a-z0-9_]+\/[a-zA-Z0-9_-]{1,80}\.jpg$/.test(value);

/** A reviewed metadata record never stores launch IDs, executable paths or source authority. */
export function libraryMetadataMatch(value: unknown): LibraryMetadataMatch {
  const v = value as LibraryMetadataMatch | null;
  if (!v || !Number.isSafeInteger(v.igdbId) || v.igdbId <= 0 || !text(v.name,500) || !art(v.capsule) || v.portrait !== undefined && !art(v.portrait)
    || !Array.isArray(v.platforms) || v.platforms.length > 100 || v.platforms.some(platform=>!text(platform,200))
    || v.releaseTimestamp !== undefined && (!Number.isSafeInteger(v.releaseTimestamp) || v.releaseTimestamp <= 0)) throw Error("library_prefs_read");
  const importedArtwork=parseImportedArtwork(v.importedArtwork,v.igdbId);
  return {...(importedArtwork?{importedArtwork}:{}),igdbId:v.igdbId,name:v.name,capsule:v.capsule,...(v.portrait?{portrait:v.portrait}:{}),platforms:[...v.platforms],...(v.releaseTimestamp?{releaseTimestamp:v.releaseTimestamp}:{})};
}

export function metadataMatchTarget(match: LibraryMetadataMatch): GameSummary {
  return {...match,id:`igdb:${match.igdbId}`};
}

/** Presentation changes leave all original identity fields intact. */
export function libraryMetadataPresentation(game: GameSummary, match?: LibraryMetadataMatch, entryId = game.id): GameSummary {
  return match ? {...game,name:match.name,capsule:match.capsule,portrait:match.portrait,platforms:match.platforms,releaseTimestamp:match.releaseTimestamp,importedArtwork:match.importedArtwork,libraryEntryId:entryId} : game;
}
