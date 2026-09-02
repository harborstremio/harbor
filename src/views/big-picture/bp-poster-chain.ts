import type { RefObject } from "react";
import { usePosterChain } from "@/components/poster";
import { useTitlePoster } from "@/lib/title-poster";
import type { Meta } from "@/lib/cinemeta";
import { useSettings } from "@/lib/settings";
import { useBpCardVisible } from "./bp-card-visible";
import type { BpTileShape } from "./bp-tile";

/**
 * Custom poster art, in desktop's own order.
 *
 * usePosterChain is four hooks, not one, and only two of them are about RPDB.
 * useTitlePoster is the poster the user pinned themselves on the desktop detail
 * page, and useLocalizedPoster is TMDB art in their image language. Neither
 * reads rpdbKey. Short-circuiting the whole chain on an unconfigured install
 * therefore threw away the user's own pinned poster on the default install,
 * which is the exact "custom card options are always shown" failure.
 *
 * What is gated instead is cost. useRpdbAltId resolves an imdb id per card
 * through TMDB whenever posterBaseUrl points at a host whose url needs one, and
 * a catalog page mounts every row at once, so the chain only sees the id once
 * the tile has been near the viewport. The pinned poster is a local store read
 * with no network at all, so it is answered immediately and wins the race.
 *
 * Poster shape only: these services return 2:3 art and a wide tile letterboxes it.
 */
export function useBpPosterChain(
  meta: Meta,
  shape: BpTileShape,
  ref?: RefObject<HTMLElement | null>,
): string | undefined {
  const { settings } = useSettings();
  const visible = useBpCardVisible(ref);
  const poster = shape !== "wide";
  const pinned = useTitlePoster(poster ? meta.id : undefined);
  const chain = usePosterChain(
    settings.rpdbKey,
    poster && visible ? meta.id : "",
    poster && visible ? meta.poster : undefined,
    meta.type === "series" ? "series" : "movie",
  );
  const src = pinned ?? chain.src;
  // The chain falls back to meta.poster itself. Handing that back as an
  // override would route the plain poster around bpCardArt and pull the
  // full-size original onto a 132px tile.
  return src && src !== meta.poster ? src : undefined;
}
