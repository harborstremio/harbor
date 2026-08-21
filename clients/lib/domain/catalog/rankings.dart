import 'tmdb.dart';

/// One of a ranked person's best-known titles, ported from `KnownForEntry`.
class KnownForEntry {
  const KnownForEntry({
    required this.id,
    required this.title,
    required this.mediaType,
    required this.posterPath,
    required this.releaseInfo,
  });
  final int id;
  final String title;
  final String mediaType; // movie | tv
  final String? posterPath;
  final String? releaseInfo;
}

/// A person in a department's top-100 popularity list, ported from
/// `PersonEntry`.
class PersonEntry {
  const PersonEntry({
    required this.id,
    required this.rank,
    required this.name,
    required this.profilePath,
    required this.popularity,
    required this.department,
    required this.knownFor,
  });
  final int id;
  final int rank;
  final String name;
  final String? profilePath;
  final double popularity;
  final String department;
  final List<KnownForEntry> knownFor;
}

/// The four department top-100 lists, ported from `RankMaps`.
class RankMaps {
  const RankMaps({
    required this.actors,
    required this.directors,
    required this.producers,
    required this.writers,
  });
  final List<PersonEntry> actors;
  final List<PersonEntry> directors;
  final List<PersonEntry> producers;
  final List<PersonEntry> writers;

  /// The top list for a department, ported from `list`/`topList`.
  List<PersonEntry> listFor(String dept) {
    if (dept == 'Directing') return directors;
    if (dept == 'Production') return producers;
    if (dept == 'Writing') return writers;
    return actors;
  }

  /// The 1-based rank of [id] within [dept]'s top 100, or null. Ported from
  /// `rank`.
  int? rankOf(int id, {String dept = 'Acting'}) {
    for (final p in listFor(dept)) {
      if (p.id == id) return p.rank;
    }
    return null;
  }
}

const int _pages = 5;
const int _top = 100;

List<KnownForEntry> _normalizeKnownFor(List<dynamic>? arr) {
  if (arr == null) return const [];
  final out = <KnownForEntry>[];
  for (final raw in arr.whereType<Map>()) {
    final mt = raw['media_type'];
    if (mt != 'movie' && mt != 'tv') continue;
    final title = (raw['title'] ?? '').toString();
    final name = (raw['name'] ?? '').toString();
    final t = title.isNotEmpty ? title : name;
    if (t.isEmpty) continue;
    final date = (raw['release_date'] ?? raw['first_air_date'] ?? '')
        .toString();
    final year = date.length >= 4 ? date.substring(0, 4) : date;
    out.add(
      KnownForEntry(
        id: (raw['id'] as num?)?.toInt() ?? 0,
        title: t,
        mediaType: mt as String,
        posterPath: raw['poster_path'] as String?,
        releaseInfo: year.isEmpty ? null : year,
      ),
    );
  }
  return out;
}

/// Fetches the first [_pages] pages of `person/popular` and buckets people into
/// the four department top-100 lists by first appearance. Ported from
/// `fetchPopular`. Returns null without a key.
Future<RankMaps?> fetchPopularRankings(TmdbClient client) async {
  if (!client.hasKey) return null;

  final pages = await Future.wait([
    for (var p = 1; p <= _pages; p++)
      client.get('person/popular', {'page': '$p'}),
  ]);

  final all = <Map<String, dynamic>>[
    for (final page in pages)
      ...((page?['results'] as List?) ?? const []).whereType<Map>().map(
        (e) => e.cast<String, dynamic>(),
      ),
  ];

  final buckets = <String, List<PersonEntry>>{
    'Acting': [],
    'Directing': [],
    'Production': [],
    'Writing': [],
  };
  final seen = <int>{};

  for (final p in all) {
    final dept = p['known_for_department'];
    if (dept is! String || !buckets.containsKey(dept)) continue;
    final id = (p['id'] as num?)?.toInt() ?? 0;
    if (seen.contains(id)) continue;
    final bucket = buckets[dept]!;
    if (bucket.length >= _top) continue;
    seen.add(id);
    bucket.add(
      PersonEntry(
        id: id,
        rank: bucket.length + 1,
        name: (p['name'] ?? '').toString(),
        profilePath: p['profile_path'] as String?,
        popularity: (p['popularity'] as num?)?.toDouble() ?? 0,
        department: dept,
        knownFor: _normalizeKnownFor(p['known_for'] as List?),
      ),
    );
  }

  return RankMaps(
    actors: buckets['Acting']!,
    directors: buckets['Directing']!,
    producers: buckets['Production']!,
    writers: buckets['Writing']!,
  );
}
