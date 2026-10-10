const HDR_SOURCE_GAMMAS = new Set(["pq", "hlg"]);

export function isRtxHdrBlocked(hdrToSdr: boolean, svpActive: boolean): boolean {
  return hdrToSdr || svpActive;
}

export function isRtxVsrBlocked(svpActive: boolean): boolean {
  return svpActive;
}

export function isRtxHdrEligibleSource(gamma: unknown, primaries: unknown): boolean {
  if (typeof gamma !== "string" || typeof primaries !== "string") return false;
  const normalizedGamma = gamma.trim().toLowerCase();
  const normalizedPrimaries = primaries.trim().toLowerCase();
  return (
    normalizedGamma.length > 0 &&
    normalizedPrimaries.length > 0 &&
    !HDR_SOURCE_GAMMAS.has(normalizedGamma) &&
    normalizedPrimaries !== "bt.2020"
  );
}

const VSR_MAX_OUTPUT_WIDTH = 3840;
const VSR_MAX_OUTPUT_HEIGHT = 2160;
const VSR_SCALE_CANDIDATES = [4, 3, 2, 1.5];

export function rtxVsrScaleForSource(width: unknown, height: unknown): number | null {
  if (typeof width !== "number" || typeof height !== "number") return null;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= 0 || height <= 0) return null;
  for (const factor of VSR_SCALE_CANDIDATES) {
    if (width * factor <= VSR_MAX_OUTPUT_WIDTH && height * factor <= VSR_MAX_OUTPUT_HEIGHT) {
      return factor;
    }
  }
  return null;
}
