import '../addons/models.dart';
import '../language/language_names.dart';
import '../player/player_bridge.dart';
import 'models.dart';
import 'subtitle_search.dart';

/// The outcome of an auto-load pass: the ranked/filtered/capped available
/// subtitles (for the in-player menu) and which one, if any, was auto-selected
/// and loaded onto the bridge.
class SubtitleAutoloadResult {
  const SubtitleAutoloadResult({required this.available, this.selectedIndex});
  final List<SubResult> available;

  /// Index into [available] of the auto-selected sub, or null when none.
  final int? selectedIndex;
}

/// Subtitle auto-load & auto-select, ported from `use-track-autoload.ts`
/// (`docs/50` §6.2). Searches subtitles for the title, strips Japanese for
/// non-anime, applies the per-language caps (25 preferred / 6 other), and
/// auto-selects the best preferred-language match (unless subs are off by
/// default), loading it onto the [PlayerBridge].
class SubtitleAutoloader {
  SubtitleAutoloader(this._searcher);

  static const int _preferredCap = 25;
  static const int _otherCap = 6;

  final SubtitleSearcher _searcher;

  Future<SubtitleAutoloadResult> run({
    required PlayerBridge bridge,
    required SubSearchQuery query,
    List<InstalledAddon> addons = const [],
    SubProviders providers = const SubProviders(),
    List<String> preferredLangs = const ['English'],
    bool isAnime = false,
    bool subtitlesOffByDefault = false,
    SubStreamHints? hints,
  }) async {
    final results = await _searcher.search(
      query,
      providers: providers,
      addons: addons,
      preferredLangs: preferredLangs,
      hints: hints,
    );
    final filtered = isAnime
        ? results
        : results.where((r) => normalizeLang(r.lang) != 'ja').toList();
    final available = _applyCaps(filtered, preferredLangs);

    int? selectedIndex;
    if (!subtitlesOffByDefault) {
      for (var i = 0; i < available.length; i++) {
        if (langScore(available[i].lang, preferredLangs) > 0) {
          selectedIndex = i;
          break;
        }
      }
      if (selectedIndex != null) {
        final r = available[selectedIndex];
        await bridge.addSubtitle(
          r.url,
          lang: r.lang,
          title: r.title,
          select: true,
        );
      }
    }
    return SubtitleAutoloadResult(
      available: available,
      selectedIndex: selectedIndex,
    );
  }

  List<SubResult> _applyCaps(List<SubResult> subs, List<String> preferred) {
    final prefSet = preferred.map(normalizeLang).toSet();
    final counts = <String, int>{};
    final out = <SubResult>[];
    for (final r in subs) {
      final lang = normalizeLang(r.lang);
      final cap = prefSet.contains(lang) ? _preferredCap : _otherCap;
      final n = counts[lang] ?? 0;
      if (n >= cap) continue;
      counts[lang] = n + 1;
      out.add(r);
    }
    return out;
  }
}
