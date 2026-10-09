import { backgroundArtwork, igdbArtworkUrl, parseLibraryArtwork, randomArtwork, type IgdbArtwork, type LibraryArtwork } from "./igdb-artwork";
import type { GameSummary } from "./types";

export type ArtworkImportPolicy = { selection: "first" | "random" | "manual"; screenshots: boolean; coverIcon: boolean };
/** Stored with the metadata match, so its edition and artwork commit together. */
export type ImportedArtwork = { igdbId: number; cover?: IgdbArtwork; background: IgdbArtwork | null; icon?: IgdbArtwork };
export function artworkImportPolicy(settings: { gameArtworkSelection?: unknown; gameArtworkScreenshots?: unknown; gameArtworkCoverIcon?: unknown }): ArtworkImportPolicy {
  return { selection: settings.gameArtworkSelection === "random" || settings.gameArtworkSelection === "manual" ? settings.gameArtworkSelection : "first", screenshots: settings.gameArtworkScreenshots !== false, coverIcon: settings.gameArtworkCoverIcon === true };
}
export function parseImportedArtwork(value: unknown, igdbId: number | undefined): ImportedArtwork | undefined {
  if (value === undefined) return;
  const v = value as ImportedArtwork | null;
  if (!v || !Number.isSafeInteger(igdbId) || igdbId === undefined || igdbId <= 0 || v.igdbId !== igdbId || v.background === undefined) throw Error("library_prefs_read");
  const clean = v.cover !== undefined || v.background !== null ? parseLibraryArtwork({ binding: `igdb:${igdbId}`, igdbId, cover: v.cover, background: v.background ?? undefined }) : undefined;
  const icon = v.icon !== undefined ? parseLibraryArtwork({ binding: `igdb:${igdbId}`, igdbId, cover: v.icon }).cover : undefined;
  return { igdbId, ...(clean?.cover ? { cover: clean.cover } : {}), background: clean?.background ?? null, ...(icon ? { icon } : {}) };
}
export function prepareImportedArtwork(igdbId: number, images: IgdbArtwork[], policy: ArtworkImportPolicy, random = Math.random): ImportedArtwork {
  const backgrounds = backgroundArtwork(images, policy.screenshots), cover = images.find(image => image.kind === "cover");
  return parseImportedArtwork({ igdbId, cover, background: (policy.selection === "random" ? randomArtwork(backgrounds, random) : backgrounds[0]) ?? null, ...(policy.coverIcon && cover ? { icon: cover } : {}) }, igdbId)!;
}
export function reviewImportedArtwork(prepared: ImportedArtwork, choice: LibraryArtwork | null): ImportedArtwork {
  if (choice && (choice.igdbId !== prepared.igdbId || choice.binding !== `igdb:${prepared.igdbId}`)) throw Error("library_prefs_read");
  return parseImportedArtwork({ ...prepared, cover: choice?.cover ?? prepared.cover, background: choice?.background ?? prepared.background }, prepared.igdbId)!;
}
export function importedArtworkFor(game?: Pick<GameSummary, "igdbId" | "importedArtwork">) {
  return game?.importedArtwork?.igdbId === game?.igdbId ? game?.importedArtwork : undefined;
}
export function importedArtworkIcon(artwork?: ImportedArtwork) {
  return artwork?.icon ? igdbArtworkUrl(artwork.icon, true).replace("t_cover_big_2x/", "t_thumb_2x/") : undefined;
}
/** A deliberately absent IGDB background may still use real native/store artwork. */
export function libraryBackground(chosen: string | null | undefined, catalog: string, native: string) {
  return chosen === null ? native : chosen ?? catalog;
}
