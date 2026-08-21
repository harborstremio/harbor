/// The display-resolution tier for a [width]×[height] frame, or null when both
/// are unknown. Ported 1:1 from the web `realQualityLabel`
/// (`src/lib/player/resolution-label.ts`) — used in the player stats overlay and
/// transport so the true tier (4K / 1440p / …) is shown instead of raw pixels.
String? realQualityLabel(int width, int height) {
  final w = width;
  final h = height;
  if (w <= 0 && h <= 0) return null;
  if (h >= 2160 || w >= 3840) return '4K';
  if (h >= 1440 || w >= 2560) return '1440p';
  if (h >= 1080 || w >= 1920) return '1080p';
  if (h >= 720 || w >= 1280) return '720p';
  if (h >= 480 || w >= 854) return '480p';
  return 'SD';
}

/// Maps libmpv's `video-params/gamma` transfer-characteristics value to a short
/// HDR badge — `PQ` for the SMPTE-2084 (HDR10 / Dolby Vision) transfer, `HLG`
/// for Hybrid Log-Gamma — or an empty string for SDR transfers (bt.1886,
/// gamma2.2, srgb, …) so the stats overlay shows an HDR badge only for real HDR.
String hdrTransferLabel(String? mpvGamma) {
  final g = (mpvGamma ?? '').toLowerCase().trim();
  if (g == 'pq' || g == 'st2084' || g == 'smpte2084') return 'PQ';
  if (g == 'hlg' || g == 'arib-std-b67') return 'HLG';
  return '';
}
