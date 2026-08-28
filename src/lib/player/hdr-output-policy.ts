export type HdrOutputPolicySettings = {
  playerHdrAuto?: boolean;
  playerHdrToSdr: boolean;
};

/**
 * Automatic output leaves color conversion to gpu-next/libplacebo. With the
 * D3D11 target colorspace hint it adapts HDR, Dolby Vision and SDR to the
 * active Windows display instead of forcing every HDR source into SDR.
 */
export function effectiveHdrToSdr(settings: HdrOutputPolicySettings): boolean {
  return settings.playerHdrAuto === true ? false : settings.playerHdrToSdr;
}
