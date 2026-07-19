/// The Anime4K upscaling modes, ported from `anime4k-modes.ts`. Each mode is a
/// different chain of Anime4K GLSL shaders applied by the mpv engine.
enum Anime4kMode { a, b, c, aa, bb, ca }

extension Anime4kModeId on Anime4kMode {
  /// The stable wire id stored in settings, matching the web `Anime4kMode`.
  String get id => switch (this) {
    Anime4kMode.a => 'A',
    Anime4kMode.b => 'B',
    Anime4kMode.c => 'C',
    Anime4kMode.aa => 'AA',
    Anime4kMode.bb => 'BB',
    Anime4kMode.ca => 'CA',
  };
}

/// Resolves a stored wire id back to its [Anime4kMode], or null if unknown.
Anime4kMode? anime4kModeFromId(String id) => switch (id) {
  'A' => Anime4kMode.a,
  'B' => Anime4kMode.b,
  'C' => Anime4kMode.c,
  'AA' => Anime4kMode.aa,
  'BB' => Anime4kMode.bb,
  'CA' => Anime4kMode.ca,
  _ => null,
};

/// Quality tier: `hq` uses the heavy VL shaders, `fast` the medium M shaders.
enum Anime4kTier { hq, fast }

/// A selectable mode with its label and blurb. Ported from `ANIME4K_MODES`.
typedef Anime4kModeInfo = ({Anime4kMode mode, String label, String sub});

const List<Anime4kModeInfo> kAnime4kModes = [
  (
    mode: Anime4kMode.a,
    label: 'Mode A',
    sub: 'Restore + upscale. The best all-rounder for most anime.',
  ),
  (
    mode: Anime4kMode.b,
    label: 'Mode B',
    sub: 'Softer restore. Kinder to compressed or noisy sources.',
  ),
  (
    mode: Anime4kMode.c,
    label: 'Mode C',
    sub: 'Denoise + upscale. Lightest, cleanest on already-sharp video.',
  ),
  (
    mode: Anime4kMode.aa,
    label: 'Mode A+A',
    sub: 'Double restore. Sharpest detail, for high-quality sources.',
  ),
  (
    mode: Anime4kMode.bb,
    label: 'Mode B+B',
    sub: 'Double soft restore. For heavy compression artifacts.',
  ),
  (
    mode: Anime4kMode.ca,
    label: 'Mode C+A',
    sub: 'Denoise then restore. Balanced cleanup and detail.',
  ),
];

const String _clamp = 'Anime4K_Clamp_Highlights.glsl';
const String _d2 = 'Anime4K_AutoDownscalePre_x2.glsl';
const String _d4 = 'Anime4K_AutoDownscalePre_x4.glsl';
const String _upscaleM = 'Anime4K_Upscale_CNN_x2_M.glsl';
const String _restoreM = 'Anime4K_Restore_CNN_M.glsl';
const String _restoreSoftM = 'Anime4K_Restore_CNN_Soft_M.glsl';

/// The ordered shader filenames for [mode] at [tier]. Ported from `chainFiles`.
List<String> anime4kChainFiles(Anime4kMode mode, Anime4kTier tier) {
  final big = tier == Anime4kTier.hq ? 'VL' : 'M';
  final restore = 'Anime4K_Restore_CNN_$big.glsl';
  final restoreSoft = 'Anime4K_Restore_CNN_Soft_$big.glsl';
  final upscale = 'Anime4K_Upscale_CNN_x2_$big.glsl';
  final denoise = 'Anime4K_Upscale_Denoise_CNN_x2_$big.glsl';
  return switch (mode) {
    Anime4kMode.a => [_clamp, restore, upscale, _d2, _d4, _upscaleM],
    Anime4kMode.b => [_clamp, restoreSoft, upscale, _d2, _d4, _upscaleM],
    Anime4kMode.c => [_clamp, denoise, _d2, _d4, _upscaleM],
    Anime4kMode.aa => [
      _clamp,
      restore,
      upscale,
      _restoreM,
      _d2,
      _d4,
      _upscaleM,
    ],
    Anime4kMode.bb => [
      _clamp,
      restoreSoft,
      upscale,
      _d2,
      _restoreSoftM,
      _d4,
      _upscaleM,
    ],
    Anime4kMode.ca => [_clamp, denoise, _d2, _d4, _restoreM, _upscaleM],
  };
}

/// The full shader paths for [mode]/[tier], resolved against the [folder] the
/// shaders were downloaded into. Empty for a blank folder. Ported from
/// `anime4kChain` (honours the folder's `/` or `\` separator).
List<String> anime4kChain(String folder, Anime4kMode mode, Anime4kTier tier) {
  if (folder.isEmpty) return const [];
  final sep = folder.contains('\\') ? '\\' : '/';
  final base = folder.replaceAll(RegExp(r'[\\/]+$'), '');
  return [for (final f in anime4kChainFiles(mode, tier)) '$base$sep$f'];
}

/// Where the Anime4K GLSL shaders are downloaded from. Ported from
/// `anime4k.rs` `BASE`.
const String kAnime4kBaseUrl =
    'https://raw.githubusercontent.com/bloc97/Anime4K/master/glsl';

/// The shaders to download: (repo path under [kAnime4kBaseUrl], local filename).
/// Ported from the `anime4k.rs` `FILES` manifest.
const List<(String, String)> kAnime4kShaderManifest = [
  ('Restore/Anime4K_Clamp_Highlights.glsl', 'Anime4K_Clamp_Highlights.glsl'),
  ('Restore/Anime4K_Restore_CNN_VL.glsl', 'Anime4K_Restore_CNN_VL.glsl'),
  ('Restore/Anime4K_Restore_CNN_M.glsl', 'Anime4K_Restore_CNN_M.glsl'),
  (
    'Restore/Anime4K_Restore_CNN_Soft_VL.glsl',
    'Anime4K_Restore_CNN_Soft_VL.glsl',
  ),
  (
    'Restore/Anime4K_Restore_CNN_Soft_M.glsl',
    'Anime4K_Restore_CNN_Soft_M.glsl',
  ),
  ('Upscale/Anime4K_Upscale_CNN_x2_VL.glsl', 'Anime4K_Upscale_CNN_x2_VL.glsl'),
  ('Upscale/Anime4K_Upscale_CNN_x2_M.glsl', 'Anime4K_Upscale_CNN_x2_M.glsl'),
  (
    'Upscale%2BDenoise/Anime4K_Upscale_Denoise_CNN_x2_VL.glsl',
    'Anime4K_Upscale_Denoise_CNN_x2_VL.glsl',
  ),
  (
    'Upscale%2BDenoise/Anime4K_Upscale_Denoise_CNN_x2_M.glsl',
    'Anime4K_Upscale_Denoise_CNN_x2_M.glsl',
  ),
  (
    'Upscale/Anime4K_AutoDownscalePre_x2.glsl',
    'Anime4K_AutoDownscalePre_x2.glsl',
  ),
  (
    'Upscale/Anime4K_AutoDownscalePre_x4.glsl',
    'Anime4K_AutoDownscalePre_x4.glsl',
  ),
];
