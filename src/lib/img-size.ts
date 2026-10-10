const TMDB_TIERS = [92, 154, 185, 300, 342, 500, 780, 1280];

function tmdbSegment(targetPx: number): string {
  for (const t of TMDB_TIERS) if (t >= targetPx) return `w${t}`;
  return "original";
}

const GOOGLE_ART_MAX = 1200;
const DEEZER_ART_MAX = 1000;

export function upgradeArtworkUrl(url: string, targetPx: number): string {
  if (!url || targetPx <= 0) return url;
  if (/=w\d+-h\d+/.test(url)) {
    const size = Math.min(GOOGLE_ART_MAX, Math.max(targetPx, 1));
    return url.replace(/=w\d+-h\d+/, `=w${size}-h${size}`);
  }
  if (/\/\d+x\d+-/.test(url) && /dzcdn\.net/.test(url)) {
    const size = Math.min(DEEZER_ART_MAX, Math.max(targetPx, 1));
    return url.replace(/\/\d+x\d+-/, `/${size}x${size}-`);
  }
  return url;
}

/** metahub only publishes small/medium/large, and "medium" is its full-size art, so "small" is the
 *  one genuinely cheaper rung. Its width varies by title (480 and 780 both observed), so it is only
 *  chosen below the smallest width ever seen, which can never under-resolve a box. */
const METAHUB_SMALL_MIN_WIDTH = 480;
const METAHUB = /(https?:\/\/images\.metahub\.space\/[^/]+\/)(small|medium|large)(\/)/i;

export function sizeImageUrl(url: string, targetPx: number): string {
  if (!url || targetPx <= 0) return url;
  const seg = tmdbSegment(targetPx);
  const sized = url.replace(/(\/t\/p\/)(w\d+|original)(\/)/, `$1${seg}$3`);
  if (sized !== url) return sized;
  if (targetPx <= METAHUB_SMALL_MIN_WIDTH) {
    const shrunk = url.replace(METAHUB, "$1small$3");
    if (shrunk !== url) return shrunk;
  }
  return upgradeArtworkUrl(url, targetPx);
}

export type PosterQuality = "balanced" | "high" | "max";

export function qualityMultiplier(q: PosterQuality): number {
  if (q === "max") return 0;
  return q === "high" ? 1.5 : 1;
}
