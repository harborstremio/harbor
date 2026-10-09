import type { GameNews } from "./community";
import { gameImage } from "./steam-data";
import { isIgdbImage } from "./igdb-data";

export type NewsArtwork = { primary?: string; backup?: string };

/** CDN aliases, cache queries and resized copies still represent the same artwork. */
export function newsImageIdentity(value: string): string {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.port || (!gameImage(value) && !isIgdbImage(value))) return "";
    if (isIgdbImage(value)) return `igdb:${url.pathname.split("/").at(-1)}`;
    const path = url.pathname.replace(/^\/store_item_assets\/steam\/apps\//, "/steam/apps/")
      .replace(/\.\d+x\d+(?=\.[a-z]+$)/i, "");
    return `steam:${path}`;
  } catch { return ""; }
}

/** Allocate across the entire feed, before pagination, without fetching extra artwork. */
export function selectNewsArtwork(items: readonly Pick<GameNews, "image">[], screenshots: readonly string[], excluded: readonly string[] = []): NewsArtwork[] {
  const used = new Set(excluded.map(newsImageIdentity).filter(Boolean));
  const claim = (source: string): string | undefined => {
    const identity = newsImageIdentity(source);
    // Store capsules belong to product cards, even when an announcement embeds one.
    if (!identity || used.has(identity) || /\/steam\/apps\/\d+\/(?:.*\/)?(?:header|capsule|library_|portrait|page_bg)/i.test(identity)) return;
    used.add(identity);
    return source;
  };
  // Reserve post-specific images first, so a fallback cannot take another post's art.
  const artwork: NewsArtwork[] = items.map(item => ({ primary: claim(item.image) }));
  let cursor = 0;
  const nextScreenshot = () => {
    while (cursor < screenshots.length) {
      const source = claim(screenshots[cursor++]);
      if (source) return source;
    }
  };
  for (const item of artwork) item.primary ??= nextScreenshot();
  // Give every post a primary before reserving independent image-error fallbacks.
  for (const item of artwork) if (item.primary) item.backup = nextScreenshot();
  return artwork;
}
