import { sourceOrigin } from './source-origin';
import { sourceUrl } from "./sources";
import { sourceDownloadTitle, sourceTitleKey } from "./source-title";
import type { GameSummary } from "./types";

export const isSourceListingId = (id: string) => /^source:[^:]+:.+$/.test(id) && id.length <= 500 && !/[\x00-\x1f\x7f]/.test(id);

/** Community release indices move when a feed updates; saved details need a stable key. */
export async function sourceListingId(sourceId: string, page: string, title: string): Promise<string> {
  const value = JSON.stringify([page, sourceTitleKey(sourceDownloadTitle(title))]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return "source:" + sourceId + ":" + [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

/** A portable source listing has no implied Steam, IGDB or installed-game identity. */
export function sourceListingGame(value: unknown): GameSummary | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>, listing = v.sourceListing as Record<string, unknown> | undefined;
  if (typeof v.id !== "string" || !isSourceListingId(v.id) || v.steamId !== undefined || v.igdbId !== undefined || !listing || typeof listing !== "object") return null;
  const page = sourceUrl(listing.page), capsule = v.capsule === "" ? "" : sourceUrl(v.capsule);
  if (!page || capsule === undefined || typeof v.name !== "string" || !v.name.trim() || typeof listing.sourceName !== "string") return null;
  return {
    ...(sourceOrigin(v.sourceOrigin) ? { sourceOrigin: sourceOrigin(v.sourceOrigin) } : {}),
    id: v.id, name: v.name.trim().slice(0, 500), capsule, portrait: sourceUrl(v.portrait),
    platforms: Array.isArray(v.platforms) ? v.platforms.filter((p): p is string => typeof p === "string").slice(0, 30).map(p => p.slice(0, 100)) : [],
    ...(typeof v.adultContent === "boolean" ? { adultContent: v.adultContent } : {}),
    sourceListing: { page, sourceName: listing.sourceName.slice(0, 120), description: typeof listing.description === "string" ? listing.description.slice(0, 600) : "",
      screenshots: Array.isArray(listing.screenshots) ? listing.screenshots.slice(0, 6).map(value => sourceUrl(value)).filter((url): url is string => !!url) : [] },
  };
}
