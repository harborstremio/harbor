const TMDB = /^(https?:\/\/image\.tmdb\.org\/t\/p\/)(w\d+|original)(\/.+)$/i;
const METAHUB = /^(https?:\/\/images\.metahub\.space\/[^/]+\/)(small|medium|large)(\/.+)$/i;
const TMDB_LADDER = [92, 154, 185, 300, 342, 500, 780, 1280] as const;

/** metahub serves its full-size art under "medium" as well as "large", so "small" is the only
 *  rung that actually decodes smaller. */
const METAHUB_SMALL_WIDTH = 480;

function pixelWidth(cssWidth: number): number {
  const ratio = typeof devicePixelRatio === "number" && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.ceil(cssWidth * ratio);
}

export function artAtWidth<T extends string | undefined | null>(url: T, cssWidth: number): T {
  if (!url) return url;
  const want = pixelWidth(cssWidth);
  const tmdb = TMDB.exec(url);
  if (tmdb) {
    const rung = TMDB_LADDER.find((step) => step >= want) ?? TMDB_LADDER[TMDB_LADDER.length - 1];
    return `${tmdb[1]}w${rung}${tmdb[3]}` as T;
  }
  const metahub = METAHUB.exec(url);
  if (metahub) {
    const size = want <= METAHUB_SMALL_WIDTH ? "small" : metahub[2];
    return `${metahub[1]}${size}${metahub[3]}` as T;
  }
  return url;
}
