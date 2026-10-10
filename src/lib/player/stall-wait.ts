export const STALL_WAIT_OPTIONS = [10, 20, 30, 45, 60] as const;

const MIN_SEC = 5;
const MAX_SEC = 120;
const FALLBACK_SEC = 10;

export function stallWaitSec(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return FALLBACK_SEC;
  return Math.min(MAX_SEC, Math.max(MIN_SEC, Math.round(value)));
}

export function stallWaitMs(value: number | undefined): number {
  return stallWaitSec(value) * 1000;
}

export function hasPlaybackStartedForStallCheck(params: {
  status: string;
  positionSec: number;
  videoWidth: number;
  videoHeight: number;
}): boolean {
  return (
    params.status === "paused" ||
    params.positionSec > 0 ||
    (params.videoWidth > 0 && params.videoHeight > 0)
  );
}
