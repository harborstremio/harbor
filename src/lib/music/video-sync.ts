export type MusicVideoSyncInput = {
  audioTime: number | null;
  videoTime: number;
  baseRate: number;
  pictureBusy?: boolean;
};

export type MusicVideoSyncCorrection = {
  kind: "hold" | "trim" | "seek";
  rate: number;
  seekTo: number | null;
};

export const MUSIC_VIDEO_DRIFT_IGNORE = 0.04;
export const MUSIC_VIDEO_DRIFT_SEEK = 0.3;
export const MUSIC_VIDEO_RATE_TRIM = 0.05;

function baseOf(rate: number): number {
  return Number.isFinite(rate) && rate > 0 ? rate : 1;
}

export function musicVideoSyncCorrection({
  audioTime,
  videoTime,
  baseRate,
  pictureBusy = false,
}: MusicVideoSyncInput): MusicVideoSyncCorrection {
  const rate = baseOf(baseRate);
  if (audioTime === null || !Number.isFinite(audioTime) || !Number.isFinite(videoTime))
    return { kind: "hold", rate, seekTo: null };
  const drift = audioTime - videoTime;
  const size = Math.abs(drift);
  if (size > MUSIC_VIDEO_DRIFT_SEEK)
    return pictureBusy
      ? { kind: "hold", rate, seekTo: null }
      : { kind: "seek", rate, seekTo: audioTime };
  if (size <= MUSIC_VIDEO_DRIFT_IGNORE) return { kind: "hold", rate, seekTo: null };
  return {
    kind: "trim",
    rate: rate * (1 + (drift > 0 ? MUSIC_VIDEO_RATE_TRIM : -MUSIC_VIDEO_RATE_TRIM)),
    seekTo: null,
  };
}
