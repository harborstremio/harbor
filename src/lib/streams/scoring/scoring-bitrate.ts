import type { ParsedStream, ScoreReason } from "../types";
import type { ScoreOptions } from "./scoring-types";

export function bitrateBudgetPenalty(
  s: ParsedStream,
  opts: ScoreOptions,
  cached: boolean,
): ScoreReason {
  const budget = opts.bandwidthMbps;
  if (budget == null || budget <= 0) return { signal: "bitrate-ok", delta: 0 };
  const headroom = budget * 0.8;
  if (s.size && opts.runtimeMinutes && opts.runtimeMinutes > 0) {
    const required = (s.size * 8) / (opts.runtimeMinutes * 60) / 1_000_000;
    if (required > budget * 1.1) {
      const sev = required > budget * 1.5 ? -120 : -45;
      return {
        signal: `bitrate-exceeds-budget:${required.toFixed(0)}>${budget.toFixed(0)}Mbps`,
        delta: cached ? sev + 10 : sev,
      };
    }
    if (required > headroom) {
      return {
        signal: `bitrate-tight:${required.toFixed(0)}/${budget.toFixed(0)}Mbps`,
        delta: -12,
      };
    }
  }
  if (s.resolution === "4K" && budget < 25) {
    return { signal: "low-bandwidth-4k", delta: cached ? -30 : -60 };
  }
  if (s.resolution === "1080p" && budget < 8) {
    return { signal: "low-bandwidth-1080p", delta: cached ? -20 : -45 };
  }
  return { signal: "bitrate-ok", delta: 0 };
}

export function expectedMinSizeBytes(
  resolution: string | undefined,
  runtimeMin: number,
): number | null {
  if (!resolution) return null;
  if (runtimeMin <= 0) return null;
  const mbPerMin: Record<string, number> = {
    "4K": 60,
    "1080p": 18,
    "720p": 8,
    "480p": 3,
    SD: 2,
  };
  const rate = mbPerMin[resolution];
  if (!rate) return null;
  return rate * runtimeMin * 1024 * 1024;
}
