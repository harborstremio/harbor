const WIDE_ASPECT_RATIO = 16 / 9;
const MIN_WIDE_ARTWORK_WIDTH = 640;
const MIN_WIDE_ARTWORK_HEIGHT = 360;
const MIN_WIDE_ARTWORK_RATIO = 1.45;
const MAX_WIDE_ARTWORK_RATIO = 2.2;

export const POSTER_CARD_ANIMATION = {
  expansionMs: 760,
  wideFadeMs: 500,
  titleRestoreMs: 120,
  settleMs: 60,
} as const;

export type CardNavigationRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

type HorizontalBounds = Pick<CardNavigationRect, "left" | "right">;

function artworkIdentity(url?: string): string | undefined {
  const value = url?.trim();
  if (!value) return undefined;

  try {
    const parsed = new URL(value);
    const host = parsed.host.toLowerCase();
    const path = parsed.pathname.replace(/\\/g, "/");
    const normalizedPath =
      parsed.hostname.toLowerCase() === "image.tmdb.org"
        ? path.replace(/^\/t\/p\/[^/]+\//i, "/t/p/{size}/")
        : path;
    return `${parsed.protocol.toLowerCase()}//${host}${normalizedPath}`;
  } catch {
    return value.split(/[?#]/, 1)[0]?.replace(/\\/g, "/") || undefined;
  }
}

export function pickAlternativeWideArtwork(
  candidates: string[],
  current?: string,
): string | undefined {
  const currentIdentity = artworkIdentity(current);
  return candidates.find((candidate) => artworkIdentity(candidate) !== currentIdentity);
}

export function rewriteWideArtworkRung(url: string): string {
  return url.replace(/\/t\/p\/[^/]+\//, "/t/p/w1280/");
}

export function expandedCardWidth(posterHeight: number): number {
  return posterHeight * WIDE_ASPECT_RATIO;
}

export function scrollDeltaToRevealCard(
  card: HorizontalBounds,
  viewport: HorizontalBounds,
  gutter = 0,
): number {
  const left = viewport.left + Math.max(0, gutter);
  const right = viewport.right - Math.max(0, gutter);
  if (card.left < left && card.right > right) return 0;
  if (card.right > right) return card.right - right;
  if (card.left < left) return card.left - left;
  return 0;
}

export function isSuitableWideArtworkSize(width: number, height: number): boolean {
  const ratio = height > 0 ? width / height : 0;
  return (
    width >= MIN_WIDE_ARTWORK_WIDTH &&
    height >= MIN_WIDE_ARTWORK_HEIGHT &&
    ratio >= MIN_WIDE_ARTWORK_RATIO &&
    ratio <= MAX_WIDE_ARTWORK_RATIO
  );
}

export function stableCardNavigationRect(
  rect: CardNavigationRect,
  baseWidth?: number,
  rtl = false,
) {
  const width =
    typeof baseWidth === "number" && Number.isFinite(baseWidth) && baseWidth > 0
      ? baseWidth
      : rect.width;
  const left = rtl ? rect.right - width : rect.left;
  const right = rtl ? rect.right : rect.left + width;
  return {
    left,
    right,
    top: rect.top,
    bottom: rect.bottom,
    width,
    height: rect.height,
    cx: left + width / 2,
    cy: rect.top + rect.height / 2,
  };
}

export function normalizePosterCardSettings(settings: {
  posterBackdropExpansion?: unknown;
  posterFocusedCard?: unknown;
  posterDockMagnification?: unknown;
}): {
  posterBackdropExpansion: boolean;
  posterFocusedCard: boolean;
  posterDockMagnification: boolean;
} {
  return {
    posterBackdropExpansion: settings.posterBackdropExpansion === true,
    posterFocusedCard: settings.posterFocusedCard === true,
    posterDockMagnification: settings.posterDockMagnification === true,
  };
}
