import type { ParsedStream } from "../types";
import { TRACKING_MIN_SEEDERS, type CorpusStats, type ScoreOptions } from "./scoring-types";

export function computeCorpusStats(streams: ParsedStream[], opts: ScoreOptions): CorpusStats {
  const days = (() => {
    if (!opts.releaseDate) return null;
    const t = Date.parse(opts.releaseDate);
    if (Number.isNaN(t)) return null;
    return (Date.now() - t) / 86_400_000;
  })();

  const isTracked = (s: ParsedStream) =>
    opts.activeDebrids.some((slug) => s.cached[slug] === true) ||
    s.url != null ||
    (s.seeders != null && s.seeders >= TRACKING_MIN_SEEDERS);
  const isTheater = (s: ParsedStream) =>
    s.source === "CAM" || s.source === "TS" || s.source === "HDTS" || s.source === "TC";
  const isWebish = (s: ParsedStream) =>
    s.source === "WEB-DL" || s.source === "WEBRip" || s.source === "BluRay" || s.source === "BDRip";

  const tracked = streams.filter(isTracked);
  const trustedTrackedCount = tracked.length;
  const theater = tracked.filter(isTheater).length;
  const webish = tracked.filter(isWebish).length;

  const total = trustedTrackedCount || 1;
  return {
    daysSinceRelease: days,
    trustedTrackedFraction: trustedTrackedCount / Math.max(streams.length, 1),
    theaterCaptureFraction: theater / total,
    webishFraction: webish / total,
    trustedTrackedCount,
  };
}
