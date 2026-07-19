import '../language/language_names.dart';
import 'player_models.dart';

/// Audio-track auto-selection, ported from the audio half of
/// `use-track-autoload.ts`: on load, pick the audio track whose language best
/// matches the user's preference (respecting block words), leaving forced tracks
/// and non-matching languages alone. Subtitles are handled separately by the
/// subtitle autoloader.

/// `resolveLangPreference`: [primary] when non-empty, else [fallback], else
/// `['English']`.
List<String> resolveLangPreference(
  List<String> primary,
  List<String> fallback,
) {
  if (primary.isNotEmpty) return primary;
  if (fallback.isNotEmpty) return fallback;
  return const ['English'];
}

/// `isJapanese`: whether a language tag denotes Japanese.
bool isJapaneseLang(String lang) {
  final l = lang.trim().toLowerCase();
  return l == 'ja' || l == 'jpn' || l == 'jp' || l == 'japanese';
}

/// Anime detection for track selection, ported from use-track-autoload: a
/// `kitsu:`/`mal:` id, or an "anime" genre.
bool isAnimeContent(String? id, List<String> genres) {
  if (id != null && (id.startsWith('kitsu:') || id.startsWith('mal:'))) {
    return true;
  }
  return genres.any((g) => g.toLowerCase() == 'anime');
}

/// The ordered audio-language preference: [preferredAudio] (falling back to
/// [preferredLanguages], then English) with Japanese stripped for non-anime,
/// matching `stripJaForNonAnime(resolveLangPreference(...))`.
List<String> audioLangPreference({
  required List<String> preferredAudio,
  required List<String> preferredLanguages,
  required bool isAnime,
}) {
  final base = resolveLangPreference(preferredAudio, preferredLanguages);
  if (isAnime) return base;
  return base.where((l) => !isJapaneseLang(l)).toList();
}

/// The normalized block words from `trackBlockWords` (trimmed, lower-cased,
/// non-empty).
List<String> normalizeBlockWords(List<String> raw) =>
    raw.map((w) => w.trim().toLowerCase()).where((w) => w.isNotEmpty).toList();

bool _trackMatchesWords(TrackInfo t, List<String> words) {
  final hay = '${t.title ?? ''} ${t.label}'.toLowerCase();
  return words.any(hay.contains);
}

/// Drops tracks matching any block word, but never everything: if every track
/// is blocked the originals are kept, matching `allow` in use-track-autoload.
List<TrackInfo> allowTracks(List<TrackInfo> tracks, List<String> words) {
  if (words.isEmpty) return tracks;
  final kept = tracks.where((t) => !_trackMatchesWords(t, words)).toList();
  return kept.isNotEmpty ? kept : tracks;
}

/// `pickBestTrack` for audio: skip forced tracks, require a language match,
/// prefer earlier languages then the container default. Null when none match.
TrackInfo? pickBestAudioTrack(List<TrackInfo> tracks, List<String> preferred) {
  TrackInfo? best;
  int? bestScore;
  for (final t in tracks) {
    if (t.forced) continue;
    final ls = langScore(t.lang ?? '', preferred);
    if (ls < 0) continue;
    final score = ls * 10 + (t.isDefault ? 1 : 0);
    if (bestScore == null || score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

/// The audio track to switch to on load, or null to keep the current one: the
/// best language match among the block-word-allowed tracks.
TrackInfo? autoSelectAudioTrack({
  required List<TrackInfo> tracks,
  required List<String> langs,
  required List<String> blockWords,
}) {
  if (tracks.isEmpty) return null;
  return pickBestAudioTrack(allowTracks(tracks, blockWords), langs);
}
