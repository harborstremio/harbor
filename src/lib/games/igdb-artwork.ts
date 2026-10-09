import type { GameSummary } from "./types";

export type IgdbArtwork = { imageId: string; kind: "cover" | "artwork" | "screenshot"; width?: number; height?: number };
export type LibraryArtwork = { binding: string; igdbId: number; cover?: IgdbArtwork; background?: IgdbArtwork };
const row = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const imageId = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
const dimension = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 100_000;

/** Keep original dimensions without trusting provider URLs or arbitrary image transforms. */
export function igdbImageRecord(value: unknown) {
  const v = row(value);
  return imageId(v.image_id) ? { image_id: v.image_id, ...(dimension(v.width) ? { width: v.width } : {}), ...(dimension(v.height) ? { height: v.height } : {}) } : undefined;
}
export function igdbArtworkCatalog(value: unknown): IgdbArtwork[] {
  const v = row(value), images: IgdbArtwork[] = [];
  for (const [kind, candidates] of [["cover", [v.cover]], ["artwork", v.artworks], ["screenshot", v.screenshots]] as const) {
    for (const candidate of Array.isArray(candidates) ? candidates.slice(0, 100) : []) {
      const image = igdbImageRecord(candidate);
      if (image && !images.some(previous => previous.kind === kind && previous.imageId === image.image_id)) images.push({ imageId: image.image_id, kind, ...(image.width ? { width: image.width } : {}), ...(image.height ? { height: image.height } : {}) });
    }
  }
  return images;
}
export function igdbArtworkUrl(image: IgdbArtwork, preview = false) {
  if (!imageId(image.imageId)) return "";
  const size = preview ? image.kind === "cover" ? "cover_big_2x" : "screenshot_med" : image.width && image.height && image.width <= 1920 && image.height <= 1080 ? "original" : "1080p";
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${image.imageId}.jpg`;
}
export function backgroundArtwork(images: IgdbArtwork[], screenshots = true) {
  const artwork = images.filter(image => image.kind === "artwork");
  return artwork.length ? artwork : screenshots ? images.filter(image => image.kind === "screenshot") : [];
}
export function randomArtwork(images: IgdbArtwork[], random = Math.random) {
  if (!images.length) return undefined;
  const value = random();
  return images[Math.max(0, Math.min(images.length - 1, Math.floor((Number.isFinite(value) ? value : 0) * images.length)))];
}
/** Bind to the reviewed edition, or the original library catalog identity. Never a title. */
export function artworkBinding(id: string, game?: Pick<GameSummary, "id" | "igdbId" | "steamId" | "catalogSteamId">, reviewedId?: number) {
  if (reviewedId) return `igdb:${reviewedId}`;
  if (id.startsWith("custom:") || id.startsWith("rom:")) return game ? `linked:${game.id}:${game.igdbId ?? ""}:${game.steamId ?? ""}` : "";
  return `${id}:${game?.catalogSteamId ?? ""}`;
}
export function parseLibraryArtwork(value: unknown): LibraryArtwork {
  const v = row(value);
  if (typeof v.binding !== "string" || !v.binding || v.binding.length > 4300 || /[\x00-\x1f]/.test(v.binding) || typeof v.igdbId !== "number" || !Number.isSafeInteger(v.igdbId) || v.igdbId <= 0) throw Error("library_prefs_read");
  const parse = (value: unknown, cover: boolean): IgdbArtwork | undefined => {
    if (value === undefined) return;
    const image = row(value);
    if (!imageId(image.imageId) || (cover ? image.kind !== "cover" : !["artwork", "screenshot"].includes(String(image.kind))) || image.width !== undefined && !dimension(image.width) || image.height !== undefined && !dimension(image.height)) throw Error("library_prefs_read");
    return { imageId: image.imageId, kind: image.kind as IgdbArtwork["kind"], ...(dimension(image.width) ? { width: image.width } : {}), ...(dimension(image.height) ? { height: image.height } : {}) };
  };
  const cover = parse(v.cover, true), background = parse(v.background, false);
  if (!cover && !background) throw Error("library_prefs_read");
  return { binding: v.binding, igdbId: v.igdbId, ...(cover ? { cover } : {}), ...(background ? { background } : {}) };
}
export function matchingLibraryArtwork(artwork: LibraryArtwork | undefined, binding: string) { return artwork?.binding === binding ? artwork : undefined; }
