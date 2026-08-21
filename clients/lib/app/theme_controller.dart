import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../design/themes.dart';
import '../design/tokens.dart';
import 'providers.dart';

/// Holds the active built-in theme preset id, backed by the persisted
/// `theme.preset` setting so a chosen theme survives restart. This is the
/// reactive source the UI themes off.
class ThemeIdController extends Notifier<String> {
  @override
  String build() {
    final id = ref.watch(settingsProvider).themePreset;
    if (id == 'custom') return 'custom';
    return isSelectablePresetId(id) ? id : kDefaultThemeId;
  }

  void setId(String id) {
    final theme = Map<String, dynamic>.from(
      ref.read(settingsProvider).getMap('theme'),
    )..['preset'] = id;
    ref.read(settingsProvider.notifier).setValue('theme', theme);
  }

  /// Activates a custom palette, persisting `preset: 'custom'` alongside the ten
  /// colours. Called for each edit in the custom-theme editor, so the whole app
  /// re-themes live (matching the web's `applyCustomColorsPreview`).
  void setCustomColors(Map<String, String> colors) {
    final theme =
        Map<String, dynamic>.from(ref.read(settingsProvider).getMap('theme'))
          ..['preset'] = 'custom'
          ..['customColors'] = colors;
    ref.read(settingsProvider.notifier).setValue('theme', theme);
  }

  /// Cycle through the pickable (non-hidden) presets — mirrors Harbor's theme
  /// cycle, which excludes hidden presets like `crunch`.
  void cycle() {
    final pickable = kThemePresets.where((p) => !p.hidden).toList();
    final i = pickable.indexWhere((p) => p.id == state);
    setId(pickable[(i + 1) % pickable.length].id);
  }
}

final themeIdProvider = NotifierProvider<ThemeIdController, String>(
  ThemeIdController.new,
);

final activePresetProvider = Provider<ThemePreset>(
  (ref) => themePresetById(ref.watch(themeIdProvider)),
);

/// The persisted custom palette (`theme.customColors`), or null when unset or
/// missing any of the ten roles — the theme then falls back to a preset.
final customColorsProvider = Provider<Map<String, String>?>((ref) {
  final raw = ref.watch(settingsProvider).getMap('theme')['customColors'];
  if (raw is! Map) return null;
  final out = <String, String>{};
  for (final key in kCustomColorKeys) {
    final v = raw[key];
    if (v is! String) return null;
    out[key] = v;
  }
  return out;
});

final tokensProvider = Provider<HarborTokens>((ref) {
  if (ref.watch(themeIdProvider) == 'custom') {
    final custom = ref.watch(customColorsProvider);
    if (custom != null) return HarborTokens.fromCustomColors(custom);
  }
  return ref.watch(activePresetProvider).tokens;
});

final themeDataProvider = Provider<ThemeData>(
  (ref) => buildHarborTheme(ref.watch(tokensProvider)),
);
