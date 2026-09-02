import { isAndroidTv } from "@/lib/platform";

const TMDB_SIZE = /\/t\/p\/(w\d+|h\d+|original)\//;
const METAHUB_SIZE = /\/(small|medium|large)\//;
const METAHUB_KIND = /metahub\.space\/(\w+)\//;

declare global {
  interface Window {
    __bpArtDpr?: number;
  }
}

const DPR_CAP_DEFAULT = 1.5;

// Read per call, never frozen at module load. This is the one knob for how
// sharp every card in Big Picture is against how much it decodes, and the whole
// point of it is that it can be moved over CDP on the device and judged by eye:
// set window.__bpArtDpr and the next tile to render asks for the new size.
export function bpArtDpr(): number {
  if (typeof window === "undefined") return DPR_CAP_DEFAULT;
  return window.__bpArtDpr ?? DPR_CAP_DEFAULT;
}

export type BpHeroShape = "wide" | "portrait";

export function bpHeroArt(
  url: string | undefined,
  shape: BpHeroShape = "wide",
): string | undefined {
  if (!url) return url;

  if (TMDB_SIZE.test(url)) {
    const want = Math.ceil((bpViewportHeight() * 16) / 9);
    const bucket = TMDB_BUCKETS.find((b) => b >= want) ?? TMDB_BUCKETS[TMDB_BUCKETS.length - 1];
    const size = shape === "portrait" ? "w780" : `w${bucket}`;
    return url.replace(TMDB_SIZE, `/t/p/${size}/`);
  }

  // Left at /large/ deliberately. Measured on device: metahub background medium
  // and large are the same 1920x1080 file and small is 480x270, so there is no
  // middle tier to step down to and a full-bleed backdrop needs the 1920.
  if (url.includes("metahub.space")) {
    return url.replace(METAHUB_SIZE, "/large/");
  }

  return url;
}

export type BpHeroSource = { url: string | undefined; portrait: boolean };
export type BpHeroCandidate = { src: string; portrait: boolean };

function heroRank(source: BpHeroSource): number {
  if (source.portrait) return 2;
  return source.url?.includes(TVDB_HOST) ? 1 : 0;
}

export function bpHeroCandidates(sources: readonly BpHeroSource[]): BpHeroCandidate[] {
  const taken = new Set<string>();
  const out: BpHeroCandidate[] = [];
  for (const { url, portrait } of [...sources].sort((a, b) => heroRank(a) - heroRank(b))) {
    const src = bpHeroArt(url, portrait ? "portrait" : "wide");
    if (!src || taken.has(src)) continue;
    taken.add(src);
    out.push({ src, portrait });
  }
  return out;
}

const TMDB_BUCKETS = [300, 500, 780, 1280];

const TVDB_HOST = "artworks.thetvdb.com";
const TVDB_ART = /artworks\.thetvdb\.com\/.+\.(jpg|jpeg|png|webp)$/i;
const TVDB_THUMB = /_t\.(jpg|jpeg|png|webp)$/i;
const TVDB_THUMB_W = 340;

// Natural widths, read off the device rather than assumed. The old two-way split
// on 500 could only ever answer /medium/ or /large/, and every Big Picture caller
// cleared 500, so a 132px poster tile pulled 780x1170 and decoded 6.8x the pixels
// it can draw.
const METAHUB_TIERS: Record<string, ReadonlyArray<readonly [number, string]>> = {
  poster: [
    [300, "small"],
    [500, "medium"],
    [780, "large"],
  ],
  background: [
    [480, "small"],
    [1920, "medium"],
  ],
};

// The two heaviest hosts in the whole app, measured on a Fire TV Stick 4K Max:
// cdn.myanimelist.net 23.0MB and s4.anilist.co 13.2MB, together more than every
// other host combined, and both fell straight through to `return url`.
//
// Neither exposes a width in the path, so these are named tiers rather than a
// bucket ladder. AniList serves one file per path segment and the segment names
// do NOT line up with the API field names: coverImage.extraLarge is the /large/
// path, coverImage.large is /medium/, coverImage.medium is /small/. The tier
// widths below are the PATH widths, which is what a url actually carries.
// MAL is the documented main_picture pair: `<id>l.jpg` is large and the same
// name without the l is medium, which is the url the API itself returns.
//
// If either of these is ever wrong for a particular title the card does not go
// blank: useBpArt retries the untransformed original before it gives up.
const ANILIST_COVER = /\/(?:anime|manga)\/cover\/(small|medium|large)\//;
const ANILIST_TIERS: ReadonlyArray<readonly [number, string]> = [
  [100, "small"],
  [230, "medium"],
  [500, "large"],
];

const MAL_LARGE = /(\/images\/(?:anime|manga)\/\d+\/\d+)l(\.\w+)$/;
const MAL_MEDIUM_W = 225;

// Both hosts jump by roughly a factor of two per tier, so rounding up is the
// same ruinous trade metahub already records below. A tier is taken when it
// covers four fifths of the want, which is the floor the metahub rule already
// ships at: 1.2 device pixels per css pixel against the 1.5 cap.
const TIER_SLACK = 0.8;

function pickTier(tiers: ReadonlyArray<readonly [number, string]>, want: number): string {
  for (const [w, name] of tiers) if (w >= want * TIER_SLACK) return name;
  return tiers[tiers.length - 1][1];
}

export type BpArtBox = { min: number; vw: number; max: number };

// The dial. Desktop and Steam Deck read Big Picture ~1.25x larger than the
// authored ten-foot floor; the Android television keeps the floor untouched. The
// css side lives in bp-tokens as --bp-up under [data-bp-root]:not([data-bp-tv])
// @media (min-height:800px). bpBoxUpscale below is the JS mirror of that gate, so
// keep this number in step with --bp-up in bp-tokens.
export const BP_UP = 1;

// The factor the art request runs at, gated the same two ways the stylesheet
// gates --bp-up: never on the Android TV WebView, and only from the 800px tall
// handheld up. The 607px television therefore returns 1.0 and every bucket on it
// is byte for byte unchanged, while the enlarged desktop and Deck cards ask for a
// bucket that matches the size bpBoxCss draws them at rather than reading soft.
export function bpBoxUpscale(): number {
  if (typeof window === "undefined") return 1;
  if (isAndroidTv()) return 1;
  return bpViewportHeight() >= 800 ? BP_UP : 1;
}

export function bpBoxCss(box: BpArtBox): string {
  return `clamp(${box.min}px, ${box.vw}vw, ${box.max}px)`;
}

let vwCache = 0;
let vhCache = 0;
let vwBound = false;

function bindViewport() {
  if (vwBound) return;
  vwBound = true;
  const clear = () => {
    vwCache = 0;
    vhCache = 0;
  };
  window.addEventListener("resize", clear);
  // Android WebView applies index-tv.html's viewport meta after the first
  // reads have already happened, and it does not reliably fire `resize` for
  // it, so a width taken during boot can pin this cache for the whole
  // session. CSS clamp() re-evaluates live and this does not, which is how
  // the two below can disagree despite reading one record: measured on a
  // Stick 4K Max, six episode stills DREW at 212px, the correct clamp result
  // for a 1140 viewport, while asking bpCardArt for a width in the 251 to 390
  // band, which is what BP_EPISODE_BOX.max returns off a pre-meta viewport.
  // The ladder answered w780 for art that needed w500.
  //
  // Both of these fire once. The boot read is discarded rather than trusted,
  // and the cost is a single extra innerWidth measurement per session against
  // the 390 to 782ms first read that gets paid either way.
  window.visualViewport?.addEventListener("resize", clear);
  window.addEventListener("load", clear, { once: true });
  requestAnimationFrame(clear);
}

// window.innerWidth is a forced style and layout flush, measured at 390 to 782ms
// for the first read after the tree is dirtied on a Fire TV Stick 4K Max. Every
// tile asks for its art width on every render, so this is cached and invalidated
// on resize instead of being paid once per tile per render pass.
export function bpViewportWidth(): number {
  if (typeof window === "undefined") return 1920;
  bindViewport();
  if (vwCache === 0) vwCache = window.innerWidth;
  return vwCache;
}

export function bpViewportHeight(): number {
  if (typeof window === "undefined") return 1080;
  bindViewport();
  if (vhCache === 0) vhCache = window.innerHeight;
  return vhCache;
}

// The CSS width and the number handed to bpCardArt come from one record, because
// the failure mode is silent: edit the clamp, forget the request, and the tile
// asks for a size it stopped drawing.
export function bpBoxPx(box: BpArtBox): number {
  const base = Math.min(box.max, Math.max(box.min, (box.vw / 100) * bpViewportWidth()));
  return base * bpBoxUpscale();
}

export const BP_TILE_BOX: Record<"poster" | "wide", BpArtBox> = {
  poster: { min: 177, vw: 13, max: 220 },
  wide: { min: 230, vw: 19, max: 380 },
};

export const BP_FLUID_BOX: Record<"wide", BpArtBox> = {
  wide: { min: 240, vw: 20, max: 400 },
};

export function bpTileArtWidth(shape: "poster" | "wide"): number {
  return bpBoxPx(BP_TILE_BOX[shape]);
}

// A wide continue watching card renders far larger than a poster tile, so a
// single bucket for every card either upscales the big ones or wastes bytes.
export function bpCardArt(url: string | undefined, targetWidth: number): string | undefined {
  if (!url) return url;

  const dpr =
    typeof window === "undefined" ? 1 : Math.min(bpArtDpr(), window.devicePixelRatio || 1);
  const want = targetWidth * dpr;

  if (TMDB_SIZE.test(url)) {
    const bucket = TMDB_BUCKETS.find((b) => b >= want);
    return url.replace(TMDB_SIZE, `/t/p/${bucket ? `w${bucket}` : "original"}/`);
  }
  // thetvdb serves exactly two sizes and neither is expressed in the path, so
  // the TMDB ladder above and the metahub tiers below both pass these straight
  // through. Measured on device: a v4 series poster is 680x1000, its _t sibling
  // is 340x500, and the library page was painting the 680 into a 132px tile.
  if (TVDB_ART.test(url) && !TVDB_THUMB.test(url)) {
    if (want > TVDB_THUMB_W * 1.2) return url;
    const dot = url.lastIndexOf(".");
    return `${url.slice(0, dot)}_t${url.slice(dot)}`;
  }
  if (url.includes("metahub.space")) {
    const tiers = METAHUB_TIERS[METAHUB_KIND.exec(url)?.[1] ?? ""];
    if (!tiers) return url.replace(METAHUB_SIZE, want > 500 ? "/large/" : "/medium/");
    // Rounding up is right when the tiers are close together and ruinous when
    // they are not. Metahub backgrounds are 480 then 1920 with nothing between,
    // a four times jump, so a continue-watching card wanting 536 missed small by
    // 56 pixels and took 1920x1080: 7.91MB decoded for a card painted 268 wide,
    // and those cards load eagerly. Sixteen of them is most of the 167MB of
    // decoded art measured on a Fire TV Stick 4K Max.
    //
    // So a tier that is close enough below the want beats one far above it. The
    // threshold is deliberately generous. The case that matters is a want of
    // 536 against a 480 tier, which is 89.5 percent, so anything tighter than
    // twenty percent does not fire at all. At twenty percent short the source
    // is still about 1.8 device pixels per css pixel, which nobody can see,
    // and the alternative is always at least twice the decoded bytes.
    const idx = tiers.findIndex(([w]) => w >= want);
    const under = idx > 0 ? tiers[idx - 1] : null;
    const over = idx >= 0 ? tiers[idx] : null;
    const tier =
      under && over && under[0] >= want * 0.8 && over[0] > under[0] * 2
        ? under[1]
        : (over?.[1] ?? tiers[tiers.length - 1][1]);
    return url.replace(METAHUB_SIZE, `/${tier}/`);
  }
  const anilist = ANILIST_COVER.exec(url);
  if (anilist) {
    const tier = pickTier(ANILIST_TIERS, want);
    return tier === anilist[1] ? url : url.replace(`/cover/${anilist[1]}/`, `/cover/${tier}/`);
  }
  if (want < MAL_MEDIUM_W / TIER_SLACK && MAL_LARGE.test(url)) {
    return url.replace(MAL_LARGE, "$1$2");
  }
  return url;
}
