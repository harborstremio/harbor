const HDR_SOURCE_GAMMAS = new Set(["pq", "hlg"]);

export function isRtxHdrBlocked(hdrToSdr: boolean, svpActive: boolean): boolean {
  return hdrToSdr || svpActive;
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
