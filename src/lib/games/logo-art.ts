/** Compact marks may be emblems; verified stacked wordmarks already contain the title. */
export function gameLogoShape(width: number, height: number, steamId?: number): "compact" | "wide" {
  if (width <= 0 || height <= 0) return "compact";
  // Both GTA V editions use the full stacked name, not an icon beside a separate title.
  if (steamId === 271590 || steamId === 3240220) return "wide";
  return width / height > 1.4 ? "wide" : "compact";
}

/** Publisher variants verified for dark game artwork; never flatten multicolor marks. */
export function gameLogoSource(steamId: number, fallback = `https://cdn.akamai.steamstatic.com/steam/apps/${steamId}/logo.png`): string {
  // Valve's current Counter-Strike home hero uses this light wordmark.
  if (steamId === 730) return "https://cdn.akamai.steamstatic.com/apps/csgo/images/csgo_react/global/logo_counterstrike2_white.svg";
  // The older Steam file still includes the Early Access label.
  if (steamId === 1145350) return "/games/publisher/hades-ii-logo.png";
  // The legacy Steam logo.png is still the Zombies promotion; use Reissad's base-game mark.
  if (steamId === 2406770) return "https://d3tyjtqxpxwenc.cloudfront.net/GHagV4/bodycam_logo_01f869ac7c.png";
  // Paradox's light horizontal wordmark replaces Steam's black stacked variant.
  if (steamId === 1158310) return "https://images.ctfassets.net/u73tyf0fa8v1/67FY9wbcTACfxPumJhR6EG/85b09c0d313a413a54460314493f8fc0/ck3-logo__3_2.png?fm=webp&q=90&w=1080";
  // Arena's current library logo is solid black; retain Steam's red-and-silver mark.
  if (steamId === 2141910) return "https://cdn.akamai.steamstatic.com/steam/apps/2141910/logo.png";
  // Steam's legacy logo promotes 1999; the official site retains the base-game wordmark.
  if (steamId === 230410) return "https://www-static.warframe.com/images/warframe-logo-blue-white.svg";
  return fallback;
}

/** Only transparent, nearly black neutral marks need a white display variant. */
export function darkMonochromeLogo(pixels: Uint8ClampedArray): boolean {
  let visible = 0, dark = 0, transparent = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 20) { transparent++; continue; }
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    visible++;
    if (Math.max(r, g, b) <= 85 && Math.max(r, g, b) - Math.min(r, g, b) <= 18) dark++;
  }
  return visible > 0 && transparent > pixels.length / 4 * .01 && dark / visible >= .98;
}

export type GameLogoArt = { src: string; white?: boolean; width: number; height: number; viewBox: string; shape: "compact" | "wide" };

// Trimming a logo decodes it and walks every pixel looking for the alpha bounds. The answer
// only depends on the image, but rows mount and unmount constantly while scrolling, so the
// same marks were being measured again on every remount. Keep the in-flight promise too, so
// a row that appears twice in one frame does the work once.
const decoded = new Map<string, Promise<GameLogoArt | undefined>>();
const DECODE_CACHE_MAX = 400;

/** Steam logos often contain large transparent margins. Fit the mark, not that empty canvas. */
export function decodeGameLogo(src?: string, steamId?: number): Promise<GameLogoArt | undefined> {
  if (!src) return Promise.resolve(undefined);
  const key = `${src}|${steamId ?? ""}`;
  let pending = decoded.get(key);
  if (!pending) {
    pending = measureGameLogo(src, steamId);
    decoded.set(key, pending);
    void pending.catch(() => decoded.delete(key));
    if (decoded.size > DECODE_CACHE_MAX) decoded.delete(decoded.keys().next().value!);
  }
  return pending;
}

async function measureGameLogo(src: string, steamId?: number): Promise<GameLogoArt | undefined> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = src;
  try { await image.decode(); } catch {
    image.removeAttribute("crossorigin"); image.src = src;
    try { await image.decode(); } catch { return; }
  }
  const width = image.naturalWidth, height = image.naturalHeight;
  let white = false;
  let shape = gameLogoShape(width, height, steamId);
  let viewBox = `0 0 ${width} ${height}`;
  try {
    const scale = Math.min(1, 320 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context) {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      white = darkMonochromeLogo(pixels);
      let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        if (pixels[(y * canvas.width + x) * 4 + 3] < 20) continue;
        left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
      if (right >= left && bottom >= top) {
        left = Math.max(0, left - 2); top = Math.max(0, top - 2);
        right = Math.min(canvas.width, right + 3); bottom = Math.min(canvas.height, bottom + 3);
        viewBox = `${left / scale} ${top / scale} ${(right - left) / scale} ${(bottom - top) / scale}`;
        shape = gameLogoShape(right - left, bottom - top, steamId);
      }
    }
  } catch { /* Providers without CORS still display their original logo. */ }
  return { src, width, height, viewBox, shape, white };
}

