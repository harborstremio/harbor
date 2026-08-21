import '../settings/settings.dart';
import 'anime4k_modes.dart';

/// Anime detection for Anime4K's auto mode, ported 1:1 from `use-anime4k.ts`
/// `isAnimeSrc`. Deliberately broader than track-selection's [isAnimeContent]:
/// it also recognises `anilist:`/`anidb:` ids and the `animation` genre, so
/// keeping it separate preserves parity with the web's Anime4K gating.
bool anime4kIsAnime(String? id, List<String> genres) {
  if (RegExp(r'^(kitsu|mal|anilist|anidb):').hasMatch(id ?? '')) return true;
  return genres.any((g) {
    final lg = g.toLowerCase();
    return lg == 'anime' || lg == 'animation';
  });
}

/// The secondary→primary fallback used when the source is already at or above
/// display resolution (the extra restore pass buys nothing), ported from
/// `SECONDARY_TO_PRIMARY`.
Anime4kMode _primaryOf(Anime4kMode mode) => switch (mode) {
  Anime4kMode.aa => Anime4kMode.a,
  Anime4kMode.bb => Anime4kMode.b,
  Anime4kMode.ca => Anime4kMode.c,
  _ => mode,
};

/// Downgrades a double-pass mode to its primary when the source is not being
/// upscaled ([srcWidth] ≥ [displayWidth]), ported from `gatedMode`.
Anime4kMode _gatedMode(Anime4kMode mode, int srcWidth, int displayWidth) {
  if (srcWidth > 0 && displayWidth > 0 && srcWidth >= displayWidth) {
    return _primaryOf(mode);
  }
  return mode;
}

/// The effective tier, ported from `gatedTier`: the performance quality preset
/// forces the light `fast` shaders regardless of the saved tier.
Anime4kTier _gatedTier(Settings s) {
  if (s.getString('mpvQuality') == 'performance') return Anime4kTier.fast;
  return s.getString('playerAnime4kTier') == 'fast'
      ? Anime4kTier.fast
      : Anime4kTier.hq;
}

/// Whether auto mode should apply Anime4K to this source, ported from
/// `autoActive`: the feature is on, and either it targets all video or the
/// source is anime.
bool anime4kAutoActive(
  Settings s, {
  String? id,
  List<String> genres = const [],
}) {
  if (!s.getBool('playerAnime4k')) return false;
  return !s.getBool('playerAnime4kAnimeOnly') || anime4kIsAnime(id, genres);
}

/// The ordered shader-chain paths to hand mpv for [choice] (`auto`, `off`, or a
/// mode id), ported 1:1 from `anime4kShadersFor`. An empty list means "clear the
/// shaders". Returns empty whenever no pack is installed (the folder is blank).
List<String> anime4kShadersFor(
  Settings s, {
  required String choice,
  String? id,
  List<String> genres = const [],
  int srcWidth = 0,
  int displayWidth = 0,
}) {
  if (choice == 'off') return const [];
  final tier = _gatedTier(s);
  final folder = s.getString('playerAnime4kFolder');
  if (choice == 'auto') {
    if (!anime4kAutoActive(s, id: id, genres: genres)) return const [];
    final mode =
        anime4kModeFromId(s.getString('playerAnime4kMode')) ?? Anime4kMode.a;
    return anime4kChain(folder, _gatedMode(mode, srcWidth, displayWidth), tier);
  }
  final mode = anime4kModeFromId(choice);
  if (mode == null) return const [];
  return anime4kChain(folder, _gatedMode(mode, srcWidth, displayWidth), tier);
}

/// The current override choice (`auto`, `off`, or a mode id), defaulting a blank
/// setting to `auto`, ported from `use-anime4k.ts`.
String anime4kChoice(Settings s) {
  final o = s.getString('playerAnime4kOverride');
  return o.isEmpty ? 'auto' : o;
}

/// The mode the menu/indicator should surface, ported from `displayMode`: when
/// auto is on and active it resolves to the running mode id, otherwise the raw
/// choice (`auto`/`off`/mode id).
String anime4kDisplayChoice(
  Settings s, {
  String? id,
  List<String> genres = const [],
}) {
  final choice = anime4kChoice(s);
  if (choice == 'auto' && anime4kAutoActive(s, id: id, genres: genres)) {
    return s.getString('playerAnime4kMode');
  }
  return choice;
}
