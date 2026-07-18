import type { ParsedStream, ScoreReason } from "../types";
import type { ScoreOptions } from "./scoring-types";

const CAM_MARKER_RX =
  /\b(?:cam|hdcam|hd[\s._-]?cam|tsrip|telesync|hdts|hd[\s._-]?ts|telecine|hd[\s._-]?tc|hc[\s._-]?hdrip|hc[\s._-]?cam|new[\s._-]?cam|cleancam|hqcam)\b/i;

const LOSSY_TRUSTED_GROUPS = new Set(["YTS", "YIFY", "YTSAG", "YTS-AG"]);

export function camInFilenamePenalty(s: ParsedStream): number {
  if (s.source === "CAM" || s.source === "TS" || s.source === "HDTS" || s.source === "TC") return 0;
  if (s.resolution !== "1080p" && s.resolution !== "4K") return 0;
  const haystack = [
    s.name,
    s.title,
    s.behaviorHints?.filename,
    s.behaviorHints?.fileName,
    s.description,
  ]
    .filter((v): v is string => typeof v === "string")
    .join(" \n ");
  if (!CAM_MARKER_RX.test(haystack)) return 0;
  return s.resolution === "4K" ? -200 : -100;
}

export function sizeMislabelPenalty(s: ParsedStream, expectedMin: number | null): number {
  if (!s.size || s.size <= 0) return 0;
  if (!expectedMin) return 0;
  if (s.source === "CAM" || s.source === "TS" || s.source === "HDTS" || s.source === "TC") return 0;
  if (s.releaseGroupNormalized && LOSSY_TRUSTED_GROUPS.has(s.releaseGroupNormalized.toUpperCase()))
    return 0;
  if (s.size >= expectedMin) return 0;
  const ratio = s.size / expectedMin;
  if (ratio < 0.25) return -120;
  if (ratio < 0.5) return -60;
  if (ratio < 0.75) return -20;
  return 0;
}

export function impossiblySmallMoviePenalty(s: ParsedStream, opts: ScoreOptions): ScoreReason {
  if (opts.mediaKind === "series") return { signal: "tiny-skip-series", delta: 0 };
  if (!s.size) return { signal: "tiny-skip-no-size", delta: 0 };
  if (!opts.releaseDate) return { signal: "tiny-skip-no-date", delta: 0 };

  const t = Date.parse(opts.releaseDate);
  if (Number.isNaN(t)) return { signal: "tiny-skip-bad-date", delta: 0 };
  const days = (Date.now() - t) / 86_400_000;
  if (days >= 90) return { signal: "tiny-skip-mature", delta: 0 };

  const isTheaterCapture =
    s.source === "CAM" || s.source === "TS" || s.source === "HDTS" || s.source === "TC";
  if (isTheaterCapture) return { signal: "tiny-skip-theater", delta: 0 };

  const sizeMB = s.size / (1024 * 1024);
  if (sizeMB < 250) {
    return { signal: `new-release-virus-${Math.round(sizeMB)}mb`, delta: -250 };
  }
  const runtimeFloor = opts.runtimeMinutes ? opts.runtimeMinutes * 5 : 0;
  const floor = Math.max(500, runtimeFloor);
  if (sizeMB < floor) {
    return { signal: `new-release-no-label-${Math.round(sizeMB)}mb`, delta: -200 };
  }
  return { signal: "tiny-ok", delta: 0 };
}

export function undersizedNewReleasePenalty(s: ParsedStream, opts: ScoreOptions): ScoreReason {
  if (opts.mediaKind === "series") return { signal: "undersized-skip-series", delta: 0 };
  if (!opts.releaseDate || !s.size) return { signal: "undersized-skip-no-data", delta: 0 };
  const t = Date.parse(opts.releaseDate);
  if (Number.isNaN(t)) return { signal: "undersized-skip-bad-date", delta: 0 };
  const days = (Date.now() - t) / 86_400_000;
  if (days >= 90) return { signal: "undersized-skip-mature", delta: 0 };

  const isTheaterCapture =
    s.source === "CAM" || s.source === "TS" || s.source === "HDTS" || s.source === "TC";
  if (isTheaterCapture) return { signal: "undersized-skip-theater", delta: 0 };

  const sizeGB = s.size / 1024 ** 3;
  if (s.resolution === "4K" && sizeGB < 6)
    return { signal: `4k-undersized-${sizeGB.toFixed(1)}gb`, delta: -250 };
  if (s.resolution === "1080p" && sizeGB < 1.5)
    return { signal: `1080p-undersized-${sizeGB.toFixed(1)}gb`, delta: -200 };
  if (s.resolution === "720p" && sizeGB < 0.6)
    return { signal: `720p-undersized-${sizeGB.toFixed(1)}gb`, delta: -80 };
  return { signal: "undersized-ok", delta: 0 };
}
