import 'dart:math' as math;

import '../addons/models.dart';
import '../catalog/tmdb.dart';

/// A person hit from TMDB multi-search, ported from `SearchPerson`.
class SearchPerson {
  const SearchPerson({
    required this.id,
    required this.name,
    required this.profile,
    required this.knownFor,
    required this.popularity,
  });
  final int id;
  final String name;
  final String? profile;
  final String knownFor;
  final double popularity;
}

/// The most-popular watchable hit, ported from `SearchResults.topMatch`.
class SearchTopMatch {
  const SearchTopMatch({
    required this.kind,
    required this.meta,
    required this.popularity,
    this.backdrop,
    this.overview,
    this.voteAverage,
  });
  final String kind; // movie | series
  final MetaPreview meta;
  final double popularity;
  final String? backdrop;
  final String? overview;
  final double? voteAverage;
}

/// A detected query intent (a bare year, or a genre name), ported from
/// `SearchIntent` / `detectIntent`.
class SearchIntent {
  const SearchIntent({
    required this.kind,
    required this.label,
    this.year,
    this.genre,
    this.mediaType,
  });
  final String kind; // year | genre
  final String label;
  final int? year;
  final String? genre;
  final String? mediaType; // movie | tv
}

/// The grouped search results, ported from `SearchResults` (the live-TV / anime /
/// addon groups land with those subsystems).
class SearchResults {
  const SearchResults({
    required this.query,
    this.topMatch,
    this.people = const [],
    this.movies = const [],
    this.series = const [],
    this.intent,
  });
  final String query;
  final SearchTopMatch? topMatch;
  final List<SearchPerson> people;
  final List<MetaPreview> movies;
  final List<MetaPreview> series;
  final SearchIntent? intent;

  bool get isEmpty =>
      topMatch == null && people.isEmpty && movies.isEmpty && series.isEmpty;
}

/// Runs a keyed TMDB multi-search, ported from the `search/multi` branch of
/// `searchAll`: movies + series (poster-bearing) mapped to metas, people with
/// their known-for, and the highest-popularity watchable as the top match.
/// Without a key it returns just the detected intent; an empty query is empty.
Future<SearchResults> searchTmdbMulti(TmdbClient client, String query) async {
  final q = query.trim();
  if (q.isEmpty) return const SearchResults(query: '');
  if (!client.hasKey) return SearchResults(query: q, intent: detectIntent(q));

  final data = await client.get('search/multi', {
    'query': q,
    'include_adult': 'false',
  });
  final results = ((data?['results'] as List?) ?? const [])
      .whereType<Map>()
      .toList();

  final movies = <MetaPreview>[];
  final series = <MetaPreview>[];
  final people = <SearchPerson>[];
  Map? topRaw;
  var topPop = -1.0;

  for (final r in results) {
    final mt = r['media_type'];
    final pop = (r['popularity'] as num?)?.toDouble() ?? 0;
    if (mt == 'movie' && r['poster_path'] != null) {
      movies.add(client.movieMeta(r.cast<String, dynamic>()));
      if (pop > topPop) {
        topRaw = r;
        topPop = pop;
      }
    } else if (mt == 'tv' && r['poster_path'] != null) {
      series.add(client.seriesMeta(r.cast<String, dynamic>()));
      if (pop > topPop) {
        topRaw = r;
        topPop = pop;
      }
    } else if (mt == 'person') {
      people.add(_person(r));
    }
  }

  // Multi-word queries with a person hit (or no watchables) get a fuzzy
  // dedicated-person search to catch misspelled names.
  if (q.split(RegExp(r'\s+')).length >= 2 &&
      (people.isNotEmpty || (movies.isEmpty && series.isEmpty))) {
    await _fuzzyPeopleFallback(client, q, people);
  }

  people.sort((a, b) => b.popularity.compareTo(a.popularity));

  SearchTopMatch? topMatch;
  if (topRaw != null) {
    final isMovie = topRaw['media_type'] == 'movie';
    final raw = topRaw.cast<String, dynamic>();
    topMatch = SearchTopMatch(
      kind: isMovie ? 'movie' : 'series',
      meta: isMovie ? client.movieMeta(raw) : client.seriesMeta(raw),
      popularity: topPop,
      backdrop: raw['backdrop_path'] != null
          ? '$tmdbImg/w1280${raw['backdrop_path']}'
          : null,
      overview: raw['overview'] as String?,
      voteAverage: (raw['vote_average'] as num?)?.toDouble(),
    );
  }

  return SearchResults(
    query: q,
    topMatch: topMatch,
    people: people.take(10).toList(),
    movies: movies.take(12).toList(),
    series: series.take(12).toList(),
    intent: detectIntent(q),
  );
}

/// Appends [extra] metas onto [primary], skipping ids already present (and
/// empty ids), then caps the result. Ported from `mergeMetas`.
List<MetaPreview> mergeMetas(
  List<MetaPreview> primary,
  List<MetaPreview> extra, {
  int cap = 20,
}) {
  final seen = primary.map((m) => m.id).toSet();
  final out = [...primary];
  for (final m in extra) {
    if (m.id.isEmpty || seen.contains(m.id)) continue;
    seen.add(m.id);
    out.add(m);
  }
  return out.length > cap ? out.sublist(0, cap) : out;
}

SearchPerson _person(Map r) {
  final known = ((r['known_for'] as List?) ?? const [])
      .whereType<Map>()
      .map((k) => (k['title'] ?? k['name'] ?? '').toString())
      .where((s) => s.isNotEmpty)
      .take(2)
      .join(', ');
  return SearchPerson(
    id: (r['id'] as num?)?.toInt() ?? 0,
    name: (r['name'] ?? '').toString(),
    profile: r['profile_path'] as String?,
    knownFor: known.isNotEmpty
        ? known
        : (r['known_for_department'] ?? 'Cast').toString(),
    popularity: (r['popularity'] as num?)?.toDouble() ?? 0,
  );
}

/// Adds people whose names are fuzzily close to the query via a dedicated
/// `search/person` on the longest ≥3-char token. Ported from
/// `fuzzyPeopleFallback`.
Future<void> _fuzzyPeopleFallback(
  TmdbClient client,
  String query,
  List<SearchPerson> people,
) async {
  // The longest token of length ≥3 (first one wins on ties, matching JS's
  // stable sort followed by [0]).
  String? token;
  for (final t in query.split(RegExp(r'\s+'))) {
    if (t.length < 3) continue;
    if (token == null || t.length > token.length) token = t;
  }
  if (token == null) return;

  Map<String, dynamic>? extra;
  try {
    extra = await client.get('search/person', {
      'query': token,
      'include_adult': 'false',
      'language': 'en-US',
    });
  } catch (_) {
    return;
  }
  final results = (extra?['results'] as List?)?.whereType<Map>();
  if (results == null) return;

  final seen = people.map((p) => p.id).toSet();
  for (final r in results) {
    final id = (r['id'] as num?)?.toInt() ?? 0;
    final name = (r['name'] ?? '').toString();
    if (seen.contains(id) || !_nameCloseTo(name, query)) continue;
    seen.add(id);
    people.add(_person(r));
  }
}

bool _nameCloseTo(String name, String query) {
  final n = name.toLowerCase().trim();
  final q = query.toLowerCase().trim();
  if (n.isEmpty || q.isEmpty) return false;
  if (n.contains(q) || q.contains(n)) return true;
  return _levenshtein(n, q) <= math.max(1, (q.length * 0.2).round());
}

int _levenshtein(String a, String b) {
  final m = a.length;
  final n = b.length;
  if (m == 0) return n;
  if (n == 0) return m;
  var prev = List<int>.generate(n + 1, (i) => i);
  var cur = List<int>.filled(n + 1, 0);
  for (var i = 1; i <= m; i++) {
    cur[0] = i;
    for (var j = 1; j <= n; j++) {
      final cost = a[i - 1] == b[j - 1] ? 0 : 1;
      final del = prev[j] + 1;
      final ins = cur[j - 1] + 1;
      final sub = prev[j - 1] + cost;
      cur[j] = math.min(del, math.min(ins, sub));
    }
    final tmp = prev;
    prev = cur;
    cur = tmp;
  }
  return prev[n];
}

/// Detects a bare-year or genre-name query intent. Ported from `detectIntent`.
SearchIntent? detectIntent(String query) {
  final q = query.trim();

  if (RegExp(r'^(19|20)\d{2}$').hasMatch(q)) {
    final year = int.parse(q);
    return SearchIntent(kind: 'year', year: year, label: 'Movies from $year');
  }

  final lower = q.toLowerCase();
  for (final name in kMovieGenres.keys) {
    if (lower == name.toLowerCase() ||
        lower == '${name.toLowerCase()} movies') {
      return SearchIntent(
        kind: 'genre',
        genre: name,
        mediaType: 'movie',
        label: '$name movies',
      );
    }
  }
  for (final name in kTvGenres.keys) {
    if (lower == name.toLowerCase() || lower == '${name.toLowerCase()} shows') {
      return SearchIntent(
        kind: 'genre',
        genre: name,
        mediaType: 'tv',
        label: '$name shows',
      );
    }
  }

  return null;
}
