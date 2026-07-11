import type { ParsedStream, ScoreReason } from "../types";
import type { CorpusStats, ScoreOptions } from "./scoring-types";

const SHORT_FRESH_DAYS = 30;
const THEATER_WINDOW_DAYS = 150;

export function freshTheatricalAdjust(
  s: ParsedStream,
  opts: ScoreOptions,
  hasValidSize: boolean,
  corpus?: CorpusStats,
): ScoreReason {
  if (opts.mediaKind === "series") return { signal: "fresh-skip-series", delta: 0 };
  if (!opts.releaseDate) return { signal: "fresh-skip-no-date", delta: 0 };

  const t = Date.parse(opts.releaseDate);
  if (Number.isNaN(t)) return { signal: "fresh-skip-bad-date", delta: 0 };
  const days = (Date.now() - t) / 86_400_000;
  if (days >= THEATER_WINDOW_DAYS) return { signal: "fresh-skip-mature", delta: 0 };

  const isTheaterCapture = s.source === "CAM" || s.source === "TS" || s.source === "HDTS" || s.source === "TC";
  const isRemuxOrBluray = s.source === "BluRay" || s.remux === true;
  const claimsHighQuality =
    s.source === "WEB-DL" ||
    s.source === "WEBRip" ||
    isRemuxOrBluray ||
    s.resolution === "1080p" ||
    s.resolution === "4K";

  const theaterDominated =
    !!corpus &&
    corpus.trustedTrackedCount >= 4 &&
    corpus.theaterCaptureFraction >= 0.4 &&
    corpus.theaterCaptureFraction > corpus.webishFraction;

  if (!theaterDominated && days >= SHORT_FRESH_DAYS) {
    return { signal: "fresh-skip-mature", delta: 0 };
  }

  if (isTheaterCapture) {
    if (theaterDominated) {
      const sourceOffset = s.source === "CAM" ? 95 : s.source === "TS" || s.source === "HDTS" ? 75 : 65;
      return { signal: "fresh-theater-cinema-window", delta: sourceOffset };
    }
    if (days < 14) return { signal: "fresh-theater-mild-boost", delta: 25 };
    return { signal: "fresh-theater-neutral", delta: 0 };
  }

  if (!claimsHighQuality) return { signal: "fresh-low-quality-noise", delta: 0 };

  if (theaterDominated) {
    if (isRemuxOrBluray) return { signal: "fresh-fake-remux", delta: -200 };
    if (days < 0) return { signal: "fresh-fake-prerelease", delta: -160 };
    if (days < 14) return { signal: "fresh-fake-prebluray", delta: -90 };
    return { signal: "fresh-fake-soft", delta: -45 };
  }

  if (isRemuxOrBluray && days < 14) return { signal: "fresh-prebluray-suspect", delta: -55 };
  if (days < 0 && !hasValidSize) return { signal: "fresh-prerelease-soft", delta: -35 };
  return { signal: "fresh-soft-flag", delta: -10 };
}
