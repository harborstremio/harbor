import 'dart:convert';

import 'jikan.dart' show animeFranchiseKey, stripFranchiseSuffix;

/// The anime award bodies Harbor recognizes.
enum AwardSourceId {
  crunchyroll('crunchyroll'),
  taaf('taaf'),
  jmaf('jmaf'),
  rAnime('r_anime'),
  animationKobe('animation_kobe');

  const AwardSourceId(this.wire);

  final String wire;

  static AwardSourceId? fromWire(String value) {
    for (final s in AwardSourceId.values) {
      if (s.wire == value) return s;
    }
    return null;
  }
}

/// A single win — a title taking a category at a body in a year.
class AwardWin {
  const AwardWin({
    required this.source,
    required this.year,
    required this.categoryKey,
    required this.categoryName,
    required this.title,
    required this.isAOTY,
  });

  final AwardSourceId source;
  final int year;
  final String categoryKey;
  final String categoryName;
  final String title;

  /// Whether this is the body's top "Anime of the Year"-equivalent category.
  final bool isAOTY;
}

/// An award body's identity and its badge prestige.
class AwardSourceMeta {
  const AwardSourceMeta({
    required this.id,
    required this.name,
    required this.shortName,
    required this.icon,
    required this.iconSmall,
    required this.prestige,
  });

  final AwardSourceId id;
  final String name;
  final String shortName;
  final String icon;
  final String iconSmall;
  final int prestige;
}

/// A category with its winners, sorted newest-first.
class AnimeAwardCategory {
  const AnimeAwardCategory({
    required this.key,
    required this.name,
    required this.isAOTY,
    required this.winners,
  });

  final String key;
  final String name;
  final bool isAOTY;
  final List<({int year, String title})> winners;
}

const Map<AwardSourceId, Set<String>> _aotyKeys = {
  AwardSourceId.crunchyroll: {'anime_of_the_year'},
  AwardSourceId.taaf: {'anime_of_the_year'},
  AwardSourceId.jmaf: {'grand_prize'},
  AwardSourceId.rAnime: {'anime_of_the_year'},
  AwardSourceId.animationKobe: {'best_film', 'best_tv'},
};

/// The body metadata, ported 1:1 from `SOURCE_META` (icon asset paths).
const Map<AwardSourceId, AwardSourceMeta> kAwardSourceMeta = {
  AwardSourceId.crunchyroll: AwardSourceMeta(
    id: AwardSourceId.crunchyroll,
    name: 'Crunchyroll Anime Awards',
    shortName: 'CR',
    icon: 'assets/awards/crunchyroll-awards-full.png',
    iconSmall: 'assets/awards/crunchyroll-awards.png',
    prestige: 100,
  ),
  AwardSourceId.taaf: AwardSourceMeta(
    id: AwardSourceId.taaf,
    name: 'Tokyo Anime Award Festival',
    shortName: 'TAAF',
    icon: 'assets/awards/taaf.png',
    iconSmall: 'assets/awards/taaf-icon.png',
    prestige: 95,
  ),
  AwardSourceId.jmaf: AwardSourceMeta(
    id: AwardSourceId.jmaf,
    name: 'Japan Media Arts Festival',
    shortName: 'JMAF',
    icon: 'assets/awards/japan-media-arts.webp',
    iconSmall: 'assets/awards/jmaf-icon.png',
    prestige: 90,
  ),
  AwardSourceId.rAnime: AwardSourceMeta(
    id: AwardSourceId.rAnime,
    name: 'r/anime Awards',
    shortName: 'r/anime',
    icon: 'assets/awards/r-anime-awards.png',
    iconSmall: 'assets/awards/r-anime-icon.png',
    prestige: 70,
  ),
  AwardSourceId.animationKobe: AwardSourceMeta(
    id: AwardSourceId.animationKobe,
    name: 'Animation Kobe',
    shortName: 'Kobe',
    icon: 'assets/awards/animation-kobe.svg',
    iconSmall: 'assets/awards/animation-kobe.svg',
    prestige: 60,
  ),
};

/// Parses an award year from a value that may be a number or a date string
/// (first four chars). Ported 1:1 from `parseAwardYear`.
int? parseAwardYear(Object? value) {
  if (value == null) return null;
  if (value is num) return value.isFinite ? value.toInt() : null;
  final s = '$value';
  return int.tryParse(s.substring(0, s.length < 4 ? s.length : 4));
}

/// Builds the Jikan→data franchise-key synonym map from the cached award-meta
/// names, so an anime whose Jikan name differs from the award data's title still
/// matches. Ported from `rebuildSynonymMap`; [cacheJson] is the persisted cache.
Map<String, String> buildAnimeAwardSynonyms(String? cacheJson) {
  final out = <String, String>{};
  if (cacheJson == null) return out;
  try {
    final parsed = jsonDecode(cacheJson);
    if (parsed is! Map) return out;
    for (final entry in parsed.entries) {
      final dataFk = entry.key;
      final meta = entry.value;
      final name = meta is Map ? meta['name'] : null;
      if (dataFk is! String || name is! String || name.isEmpty) continue;
      final jikanFk = animeFranchiseKey(stripFranchiseSuffix(name));
      if (jikanFk.isEmpty || jikanFk == dataFk) continue;
      out.putIfAbsent(jikanFk, () => dataFk);
    }
  } catch (_) {
    return out;
  }
  return out;
}

/// The bundled anime-awards index: franchise key → wins, plus per-source reads.
/// Ported from the pure half of `lib/anime-awards.ts`. Build with [fromData]
/// over the five parsed award datasets.
class AnimeAwards {
  const AnimeAwards._(this._index, this._data, this._synonyms);

  final Map<String, List<AwardWin>> _index;
  final Map<AwardSourceId, Map<String, dynamic>> _data;
  final Map<String, String> _synonyms;

  factory AnimeAwards.fromData(
    Map<AwardSourceId, Map<String, dynamic>> data, {
    Map<String, String> synonyms = const {},
  }) {
    final index = <String, List<AwardWin>>{};
    for (final entry in data.entries) {
      final source = entry.key;
      final aoty = _aotyKeys[source] ?? const {};
      final cats = (entry.value['categories'] as Map?) ?? const {};
      for (final c in cats.entries) {
        final categoryKey = '${c.key}';
        final bucket = (c.value as Map?) ?? const {};
        final name = bucket['name'] as String? ?? categoryKey;
        for (final w in (bucket['winners'] as List? ?? const [])) {
          if (w is! Map) continue;
          final year = (w['year'] as num?)?.toInt();
          final title = w['title'] as String?;
          if (year == null || title == null) continue;
          final fk = animeFranchiseKey(stripFranchiseSuffix(title));
          (index[fk] ??= []).add(
            AwardWin(
              source: source,
              year: year,
              categoryKey: categoryKey,
              categoryName: name,
              title: title,
              isAOTY: aoty.contains(categoryKey),
            ),
          );
        }
      }
    }
    for (final list in index.values) {
      list.sort(_compareWinsForBadge);
    }
    return AnimeAwards._(index, data, synonyms);
  }

  static int _compareWinsForBadge(AwardWin a, AwardWin b) {
    if (a.isAOTY != b.isAOTY) return a.isAOTY ? -1 : 1;
    if (a.year != b.year) return b.year - a.year;
    return kAwardSourceMeta[b.source]!.prestige -
        kAwardSourceMeta[a.source]!.prestige;
  }

  static List<AwardWin> _gate(List<AwardWin> wins, int? releaseYear) {
    if (releaseYear == null) return wins;
    final plausible = wins.any((w) => w.year >= releaseYear - 1);
    return plausible ? wins : const [];
  }

  /// Every win for [animeName] (direct, else via a synonym), gated so a wildly
  /// off release year doesn't produce a false badge. Ported from
  /// `findAnyAwardWins`.
  List<AwardWin> findAnyAwardWins(String animeName, {int? releaseYear}) {
    if (animeName.isEmpty) return const [];
    final fk = animeFranchiseKey(stripFranchiseSuffix(animeName));
    final direct = _index[fk];
    if (direct != null && direct.isNotEmpty) return _gate(direct, releaseYear);
    final synFk = _synonyms[fk];
    if (synFk != null) {
      final via = _index[synFk];
      if (via != null && via.isNotEmpty) return _gate(via, releaseYear);
    }
    return const [];
  }

  /// The single most prestigious win for the badge, or null.
  AwardWin? findTopAward(String animeName, {int? releaseYear}) {
    final wins = findAnyAwardWins(animeName, releaseYear: releaseYear);
    return wins.isEmpty ? null : wins.first;
  }

  /// The wins grouped by body, bodies ordered by prestige. Ported from
  /// `groupWinsBySource`.
  List<({AwardSourceId source, List<AwardWin> wins})> groupWinsBySource(
    String animeName, {
    int? releaseYear,
  }) {
    final wins = findAnyAwardWins(animeName, releaseYear: releaseYear);
    if (wins.isEmpty) return const [];
    final map = <AwardSourceId, List<AwardWin>>{};
    for (final w in wins) {
      (map[w.source] ??= []).add(w);
    }
    for (final arr in map.values) {
      arr.sort((a, b) {
        if (a.isAOTY != b.isAOTY) return a.isAOTY ? -1 : 1;
        if (a.year != b.year) return b.year - a.year;
        return a.categoryName.compareTo(b.categoryName);
      });
    }
    final out = [for (final e in map.entries) (source: e.key, wins: e.value)];
    out.sort(
      (a, b) =>
          kAwardSourceMeta[b.source]!.prestige -
          kAwardSourceMeta[a.source]!.prestige,
    );
    return out;
  }

  /// One representative (top) win per winning franchise. Ported from
  /// `uniqueWinnerFranchisesAcrossSources`.
  Map<String, AwardWin> uniqueWinnerFranchisesAcrossSources() => {
    for (final e in _index.entries) e.key: e.value.first,
  };

  /// A body's categories (AOTY first, then alphabetical) and its years.
  /// Ported from `readAnimeAwardSource`.
  ({AwardSourceMeta meta, List<AnimeAwardCategory> categories, List<int> years})
  readSource(AwardSourceId source) {
    final aoty = _aotyKeys[source] ?? const {};
    final cats = (_data[source]?['categories'] as Map?) ?? const {};
    final categories = <AnimeAwardCategory>[];
    final yearSet = <int>{};
    for (final c in cats.entries) {
      final bucket = (c.value as Map?) ?? const {};
      final winners = [
        for (final w in (bucket['winners'] as List? ?? const []))
          if (w is Map && w['year'] is num && w['title'] is String)
            (year: (w['year'] as num).toInt(), title: w['title'] as String),
      ]..sort((a, b) => b.year - a.year);
      for (final w in winners) {
        yearSet.add(w.year);
      }
      categories.add(
        AnimeAwardCategory(
          key: '${c.key}',
          name: bucket['name'] as String? ?? '${c.key}',
          isAOTY: aoty.contains('${c.key}'),
          winners: winners,
        ),
      );
    }
    categories.sort((a, b) {
      if (a.isAOTY != b.isAOTY) return a.isAOTY ? -1 : 1;
      return a.name.compareTo(b.name);
    });
    final years = yearSet.toList()..sort((a, b) => b - a);
    return (
      meta: kAwardSourceMeta[source]!,
      categories: categories,
      years: years,
    );
  }

  /// All recognized award bodies.
  static List<AwardSourceId> allSources() => AwardSourceId.values;
}
