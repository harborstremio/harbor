export function resolvePlaybackDownloadedFraction(input: {
  isP2pEngine: boolean;
  streamProgress: number;
  streamLen: number;
}): number {
  if (!input.isP2pEngine || input.streamLen <= 0) return 0;
  return Math.max(0, Math.min(1, input.streamProgress / input.streamLen));
}
