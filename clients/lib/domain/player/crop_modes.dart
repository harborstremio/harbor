/// A picture-shape preset for the advanced (mpv) engine, ported from
/// `use-video-fill.ts` (`MODES`). Each mode resolves to the mpv panscan, aspect
/// override, and stretch the player applies.
class CropMode {
  const CropMode({
    required this.id,
    required this.label,
    required this.panscan,
    required this.aspect,
    this.stretch = false,
  });

  final String id;
  final String label;

  /// mpv `panscan` (0 keeps black bars, 1 crops to fill).
  final double panscan;

  /// mpv `video-aspect-override` ratio, or null to use the source aspect
  /// (the web `"-1"`).
  final double? aspect;

  /// When true, disables `keepaspect` so the picture stretches to the window.
  final bool stretch;
}

/// The crop modes in cycle order, ported verbatim from `use-video-fill.ts`.
const kCropModes = <CropMode>[
  CropMode(id: 'fit', label: 'Fit', panscan: 0, aspect: null),
  CropMode(id: 'fill', label: 'Fill', panscan: 1, aspect: null),
  CropMode(
    id: 'stretch',
    label: 'Stretch',
    panscan: 0,
    aspect: null,
    stretch: true,
  ),
  CropMode(id: 'zoom', label: 'Zoom', panscan: 0, aspect: null),
  CropMode(id: '16:9', label: '16:9', panscan: 0, aspect: 16 / 9),
  CropMode(id: '4:3', label: '4:3', panscan: 0, aspect: 4 / 3),
  CropMode(id: '21:9', label: '21:9', panscan: 0, aspect: 21 / 9),
  CropMode(id: '1.85:1', label: '1.85:1', panscan: 0, aspect: 1.85),
  CropMode(id: 'original', label: '2.39:1', panscan: 0, aspect: 2.39),
];

/// The presets offered in settings — every mode except the live-only `zoom`
/// (matching the web `CROP_PRESETS`).
List<CropMode> get cropPresets =>
    kCropModes.where((m) => m.id != 'zoom').toList(growable: false);

/// The mode for [id], falling back to the first (`fit`) when unknown — mirrors
/// `modeIndex`.
CropMode cropModeById(String id) =>
    kCropModes.firstWhere((m) => m.id == id, orElse: () => kCropModes.first);
