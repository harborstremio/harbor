import '../addons/adult_filter.dart';
import '../addons/models.dart';

/// The Jikan (MyAnimeList) anime model and its pure transforms — franchise
/// normalization, the Meta mapping, and franchise de-duplication. Ported from
/// the pure half of `lib/providers/jikan.ts`; the network layer (jikanQuery,
/// the ARM id resolver, the catalog cache) builds on top.

/// The MyAnimeList types treated as series (everything else is a movie).
const Set<String> kJikanSeriesTypes = {'TV', 'OVA', 'ONA', 'Special'};

/// The Jikan genre ids used for the by-genre rows, ported 1:1 from `GENRE`.
const Map<String, int> kJikanGenres = {
  'Action': 1,
  'Adventure': 2,
  'Comedy': 4,
  'Drama': 8,
  'Fantasy': 10,
  'Horror': 14,
  'Mystery': 7,
  'Romance': 22,
  'SciFi': 24,
  'SliceOfLife': 36,
  'Sports': 30,
  'Supernatural': 37,
  'Thriller': 41,
  'Mecha': 18,
  'Music': 19,
  'Psychological': 40,
};

/// One anime from a Jikan response.
class JikanAnime {
  const JikanAnime(this.json);

  final Map<String, dynamic> json;

  int get malId => (json['mal_id'] as num?)?.toInt() ?? 0;
  String? get title => json['title'] as String?;
  String? get titleEnglish => json['title_english'] as String?;
  String? get titleJapanese => json['title_japanese'] as String?;
  String? get type => json['type'] as String?;
  String? get rating => json['rating'] as String?;
  num? get score => json['score'] as num?;
  int? get members => (json['members'] as num?)?.toInt();
  int? get scoredBy => (json['scored_by'] as num?)?.toInt();
  int? get year => (json['year'] as num?)?.toInt();
  String? get synopsis => json['synopsis'] as String?;
  String? get airedFrom => (json['aired'] as Map?)?['from'] as String?;

  List<String> get genres => [
    for (final g in (json['genres'] as List? ?? const []))
      if (g is Map && g['name'] is String) g['name'] as String,
  ];

  String? get trailerYoutubeId =>
      (json['trailer'] as Map?)?['youtube_id'] as String?;

  String? get _bestPoster {
    final images = json['images'] as Map? ?? const {};
    final webp = images['webp'] as Map? ?? const {};
    final jpg = images['jpg'] as Map? ?? const {};
    return (webp['large_image_url'] ??
            jpg['large_image_url'] ??
            webp['image_url'] ??
            jpg['image_url'])
        as String?;
  }

  factory JikanAnime.fromJson(Map<String, dynamic> json) => JikanAnime(json);
}

/// The best available display title, English first. Ported from `bestTitle`.
String jikanBestTitle(JikanAnime a) => (a.titleEnglish?.isNotEmpty ?? false)
    ? a.titleEnglish!
    : (a.title?.isNotEmpty ?? false)
    ? a.title!
    : (a.titleJapanese?.isNotEmpty ?? false)
    ? a.titleJapanese!
    : 'Unknown';

final List<RegExp> _franchiseStrip = [
  RegExp(
    r'\s*[-:]?\s*(?:1st|2nd|3rd|4th|5th|6th|7th|8th|9th|10th|11th|12th|First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth|Final|Last)\s+(?:Season|Cour|Part)\b.*$',
    caseSensitive: false,
  ),
  RegExp(r'\s*[-:]?\s*Season\s+\d+\b.*$', caseSensitive: false),
  RegExp(r'\s+S\d+(?:\s|$).*', caseSensitive: false),
  RegExp(r'\s*[-:]?\s*(?:Part|Cour|Chapter)\s+\d+\b.*$', caseSensitive: false),
  RegExp(r'\s+(?:II|III|IV|V|VI|VII|VIII|IX|X)\s*$'),
];

final _trailingJunk = RegExp('''[\\s°'."’˚_:\\-]+\$''');

/// Strips a season/part/ordinal suffix so a franchise's entries collapse to one
/// base name. Ported 1:1 from `stripFranchiseSuffix`.
String stripFranchiseSuffix(String name) {
  var t = name;
  for (final rx in _franchiseStrip) {
    t = t.replaceAll(rx, '');
  }
  return t.replaceAll(_trailingJunk, '').trim();
}

/// The lower-cased franchise key. Ported from `animeFranchiseKey`.
String animeFranchiseKey(String name) =>
    stripFranchiseSuffix(name).toLowerCase();

String _franchiseKey(JikanAnime a) =>
    animeFranchiseKey(a.titleEnglish ?? a.title ?? a.titleJapanese ?? '');

int _franchiseAge(JikanAnime a) {
  if (a.year != null) return a.year!;
  final m = RegExp(r'^(\d{4})').firstMatch(a.airedFrom ?? '');
  if (m != null) return int.parse(m.group(1)!);
  return 9999;
}

/// The earliest (then lowest-id) entry of a franchise group. Ported from
/// `pickFranchiseAnchor`.
JikanAnime pickFranchiseAnchor(List<JikanAnime> group) {
  final sorted = [...group]
    ..sort((x, y) {
      final da = _franchiseAge(x);
      final db = _franchiseAge(y);
      if (da != db) return da - db;
      return x.malId - y.malId;
    });
  return sorted.first;
}

/// Whether the anime is adult (Rx rating, Hentai/Erotica genre, or an adult
/// title). Ported from `isAdultJikan`.
bool isAdultJikan(JikanAnime a) {
  if (a.rating?.startsWith('Rx') ?? false) return true;
  if (a.genres.any((g) => g == 'Hentai' || g == 'Erotica')) return true;
  return isAdultText([a.titleEnglish, a.title, a.titleJapanese]);
}

/// The stable id for an anime, preferring its Kitsu mapping when known, else its
/// MyAnimeList id — mirroring the `arm?.kitsu ? kitsu : mal` choice.
String jikanMetaId(JikanAnime a, {int? kitsuId}) =>
    kitsuId != null ? 'kitsu:$kitsuId' : 'mal:${a.malId}';

/// Maps a Jikan anime to a catalog meta. Ported 1:1 from `toMeta`.
MetaPreview jikanToMeta(JikanAnime a, {required String id}) {
  final isSeries = a.type == null || kJikanSeriesTypes.contains(a.type);
  final releaseInfo = a.year != null
      ? '${a.year}'
      : (a.airedFrom != null && a.airedFrom!.length >= 4
            ? a.airedFrom!.substring(0, 4)
            : null);
  final poster = a._bestPoster;
  final score = a.score;
  final ytId = a.trailerYoutubeId;
  return MetaPreview({
    'id': id,
    'type': isSeries ? 'series' : 'movie',
    'name': jikanBestTitle(a),
    'poster': ?poster,
    'background': ?poster,
    'description': ?a.synopsis,
    'releaseInfo': ?releaseInfo,
    if (score != null) 'imdbRating': double.parse(score.toStringAsFixed(1)),
    'genres': a.genres,
    if (ytId != null && ytId.isNotEmpty)
      'trailerStreams': [
        {'ytId': ytId},
      ],
  });
}

final _sequelRx = RegExp(
  r'\b(?:1st|2nd|3rd|4th|5th|6th|7th|8th|9th|10th|11th|12th|Final|Last|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth)\s+(?:Season|Cour|Part)\b'
  r'|\bSeason\s+\d+\b|\bS\d+\b|\b(?:Part|Cour)\s+\d+\b'
  r'|\s(?:II|III|IV|V|VI|VII|VIII|IX|X)$',
  caseSensitive: false,
);

/// Whether the title reads as a sequel/later-season entry. Ported from
/// `isSequelTitle`; used to keep the "underrated gems" row to franchise starts.
bool isSequelTitle(JikanAnime a) {
  for (final t in [a.titleEnglish, a.title, a.titleJapanese]) {
    if (t != null && t.isNotEmpty && _sequelRx.hasMatch(t)) return true;
  }
  return false;
}

/// Collapses a Jikan result list to one entry per franchise, keeping the
/// earliest anchor and the list's original order. Ported from the grouping in
/// `metasFromJikan`.
List<JikanAnime> dedupeFranchises(List<JikanAnime> items) {
  final groups = <String, List<JikanAnime>>{};
  for (final a in items) {
    (groups[_franchiseKey(a)] ??= []).add(a);
  }
  final anchors = {
    for (final entry in groups.entries)
      entry.key: pickFranchiseAnchor(entry.value),
  };
  final seen = <String>{};
  final out = <JikanAnime>[];
  for (final a in items) {
    final fk = _franchiseKey(a);
    if (!seen.add(fk)) continue;
    final anchor = anchors[fk];
    if (anchor != null) out.add(anchor);
  }
  return out;
}
