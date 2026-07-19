import '../language/language_names.dart';
import 'models.dart';

/// One display-language's subtitle results for the pre-play chooser. Ports the
/// web `SubtitleLangGroup`.
class SubtitleLangGroup {
  const SubtitleLangGroup({
    required this.langKey,
    required this.langDisplay,
    required this.items,
  });

  final String langKey;
  final String langDisplay;
  final List<SubResult> items;
}

/// The subtitle choices for the chooser: the results grouped by display
/// language plus the id of the best (top-ranked) result.
class SubtitleChoices {
  const SubtitleChoices({required this.groups, required this.bestId});

  final List<SubtitleLangGroup> groups;
  final String? bestId;

  static const empty = SubtitleChoices(groups: [], bestId: null);
}

/// Whether [lang] denotes Japanese by any common code or name. Ports the web
/// `isJapanese`.
bool isJapaneseLang(String lang) {
  final l = lang.trim().toLowerCase();
  return l == 'ja' || l == 'jpn' || l == 'jp' || l == 'japanese';
}

/// Whether a play source is anime — a `kitsu:`/`mal:` id or an "anime" genre.
/// Ports the web `isAnimeSrc`.
bool isAnimeSubtitleSource(String? id, List<String> genres) =>
    (id != null && (id.startsWith('kitsu:') || id.startsWith('mal:'))) ||
    genres.any((g) => g.toLowerCase() == 'anime');

/// The ordered preferred subtitle languages for a source: the user's subtitle
/// languages (falling back to their UI languages, then English), with Japanese
/// dropped for non-anime titles (so a Japanese track isn't auto-chosen for a
/// live-action film). Ports the web `preferredLangs` memo.
List<String> subtitlePreferredLangs({
  required List<String> preferredSubLangs,
  required List<String> preferredLanguages,
  required bool isAnime,
}) {
  final primary = preferredSubLangs.isNotEmpty
      ? preferredSubLangs
      : preferredLanguages;
  final base = primary.isNotEmpty ? primary : const ['English'];
  return isAnime
      ? base
      : [
          for (final l in base)
            if (!isJapaneseLang(l)) l,
        ];
}

/// Groups already-ranked [results] by display language — the first language a
/// result appears in leads, so rank order is preserved — and names the best
/// pick ([results].first, or null when empty). Ports the `groups`/`bestId`
/// derivation in the web `useSubtitleChoices`.
SubtitleChoices groupSubtitleChoices(List<SubResult> results) {
  final order = <String>[];
  final byLang = <String, List<SubResult>>{};
  for (final r in results) {
    final display = languageName(r.lang);
    if (!byLang.containsKey(display)) {
      byLang[display] = <SubResult>[];
      order.add(display);
    }
    byLang[display]!.add(r);
  }
  return SubtitleChoices(
    groups: [
      for (final d in order)
        SubtitleLangGroup(langKey: d, langDisplay: d, items: byLang[d]!),
    ],
    bestId: results.isEmpty ? null : results.first.id,
  );
}
