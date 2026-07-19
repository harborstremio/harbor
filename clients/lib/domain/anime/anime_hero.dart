import '../addons/models.dart';
import '../catalog/show_hero.dart' show mulberry32;
import 'jikan.dart' show stripFranchiseSuffix;

/// Builds the Anime hero slide selection — ported 1:1 from the web
/// `buildHeroSelection`. Picks up to 12 background-bearing anime metas, weighted
/// across award winners → AniList-trending → MAL top-airing/airing/popular, then
/// tops up from the whole background pool, deduped by id and shuffled by [seed]
/// (stable within a day so the slides don't reshuffle on every rebuild).
///
/// [rowMetas] returns a ready row's metas by spec key (empty when not ready);
/// [allKeys] is every spec key (for the "all backgrounds" top-up sweep); [keep]
/// is `!animeFiltered`; [isWinner] flags an award winner. The TMDB backdrop/logo
/// hydration (web `resolveHeroSlides`) is deliberately skipped — anime metas
/// already carry a `background`, so the hero renders from those (the same
/// graceful path the web takes without a TMDB key).
List<MetaPreview> buildAnimeHeroSelection({
  required List<MetaPreview> Function(String key) rowMetas,
  required Iterable<String> allKeys,
  required int seed,
  required bool Function(MetaPreview) keep,
  required bool Function(MetaPreview) isWinner,
  required List<MetaPreview> anilistTrending,
  int cap = 8,
}) {
  final rng = mulberry32(seed);
  List<T> shuffle<T>(List<T> arr) {
    final a = [...arr];
    for (var i = a.length - 1; i > 0; i--) {
      final j = (rng() * (i + 1)).floor();
      final tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  bool hasBg(MetaPreview m) => (m.background ?? '').isNotEmpty && keep(m);
  List<MetaPreview> withBg(String key) =>
      [for (final m in rowMetas(key)) if (hasBg(m)) m];

  final allWithBg = <String, MetaPreview>{};
  for (final key in allKeys) {
    for (final m in rowMetas(key)) {
      if (hasBg(m) && !allWithBg.containsKey(m.id)) allWithBg[m.id] = m;
    }
  }
  final anilistWithBg = [for (final m in anilistTrending) if (hasBg(m)) m];

  final winners = shuffle(
    [...allWithBg.values, ...anilistWithBg].where(isWinner).toList(),
  );
  final trending = shuffle(withBg('top-airing'));
  final popular = shuffle(withBg('popular'));
  final airing = shuffle(withBg('airing'));
  final anilistTrend = shuffle(anilistWithBg);

  final out = <MetaPreview>[];
  final seen = <String>{};
  void take(List<MetaPreview> list, int n) {
    var taken = 0;
    for (final m in list) {
      if (taken >= n || out.length >= 12) break;
      if (!seen.add(m.id)) continue;
      out.add(_cleanName(m));
      taken++;
    }
  }

  take(winners, 2);
  take(anilistTrend, 2);
  take(trending, 2);
  take(airing, 2);
  take(popular, 1);
  take(anilistTrend, 3);
  take(trending, 3);
  take(airing, 3);
  take(shuffle([...allWithBg.values, ...anilistTrend]), 12);
  final ordered = shuffle(out);
  return ordered.length > cap ? ordered.sublist(0, cap) : ordered;
}

MetaPreview _cleanName(MetaPreview m) {
  final cleaned = stripFranchiseSuffix(m.name);
  return cleaned == m.name ? m : MetaPreview({...m.json, 'name': cleaned});
}
