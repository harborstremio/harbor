import '../addons/models.dart';
import 'tmdb.dart';

/// A resolved TMDB movie collection, ported 1:1 from `TmdbCollection` in
/// `src/lib/providers/tmdb/tmdb-collection.ts`.
class TmdbCollection {
  const TmdbCollection({
    required this.id,
    required this.name,
    required this.overview,
    required this.parts,
    required this.genreCounts,
    this.poster,
    this.backdrop,
  });

  final int id;
  final String name;
  final String overview;
  final String? poster;
  final String? backdrop;

  /// The member films, sorted by release date ascending.
  final List<MetaPreview> parts;

  /// Genre id → count across the member films, for category tagging.
  final Map<int, int> genreCounts;
}

/// A lightweight collection search hit (grid / feed).
class CollectionHit {
  const CollectionHit({required this.id, required this.name, this.backdrop});
  final int id;
  final String name;
  final String? backdrop;
}

/// A collection search feed page.
class CollectionFeed {
  const CollectionFeed({required this.hits, required this.totalPages});
  final List<CollectionHit> hits;
  final int totalPages;
}

/// Strips collection/franchise noise words + punctuation, ported from `normName`.
String normCollectionName(String s) => s
    .toLowerCase()
    .replaceAll(
      RegExp(r'\b(?:collection|trilogy|saga|series|anthology|the|007)\b'),
      ' ',
    )
    .replaceAll(RegExp(r'[^a-z0-9]+'), ' ')
    .trim();

/// True when two collection names match after normalization (equal, or the
/// shorter is a word-boundary prefix of the longer), ported from
/// `collectionNameMatches`.
bool collectionNameMatches(String a, String b) {
  final na = normCollectionName(a);
  final nb = normCollectionName(b);
  if (na.isEmpty || nb.isEmpty) return false;
  if (na == nb) return true;
  final short = na.length <= nb.length ? na : nb;
  final long = na.length <= nb.length ? nb : na;
  return long.startsWith('$short ');
}

String? _poster(Object? p) =>
    p is String && p.isNotEmpty ? '$tmdbImg/w342$p' : null;
String? _w780(Object? p) =>
    p is String && p.isNotEmpty ? '$tmdbImg/w780$p' : null;
String? _original(Object? p) =>
    p is String && p.isNotEmpty ? '$tmdbImg/original$p' : null;

/// Fetches a TMDB collection by id and maps its parts to release-sorted movie
/// metas + a genre histogram, ported from `run`/`tmdbCollection`.
Future<TmdbCollection?> fetchTmdbCollection(TmdbClient client, int id) async {
  if (!client.hasKey) return null;
  final raw = await client.get('collection/$id');
  if (raw == null) return null;
  final rawParts = (raw['parts'] as List?) ?? const [];
  final genreCounts = <int, int>{};
  for (final p in rawParts) {
    if (p is! Map) continue;
    for (final g in (p['genre_ids'] as List?) ?? const []) {
      if (g is num) genreCounts[g.toInt()] = (genreCounts[g.toInt()] ?? 0) + 1;
    }
  }
  final parts = <MetaPreview>[
    for (final p in rawParts)
      if (p is Map)
        MetaPreview({
          'id': 'tmdb:movie:${p['id']}',
          'type': 'movie',
          'name': (p['title'] ?? p['name'] ?? '').toString(),
          if (_poster(p['poster_path']) != null)
            'poster': _poster(p['poster_path']),
          if (_w780(p['backdrop_path']) != null)
            'background': _w780(p['backdrop_path']),
          if (p['overview'] != null) 'description': p['overview'],
          if (_year(p['release_date']) != null)
            'releaseInfo': _year(p['release_date']),
          if (p['release_date'] != null &&
              (p['release_date'] as String).isNotEmpty)
            'releaseDate': p['release_date'],
          if (_rating(p['vote_average']) != null)
            'imdbRating': _rating(p['vote_average']),
        }),
  ]..sort((a, b) => (a.releaseDate ?? 'zzz').compareTo(b.releaseDate ?? 'zzz'));
  return TmdbCollection(
    id: (raw['id'] as num?)?.toInt() ?? id,
    name: (raw['name'] ?? '').toString(),
    overview: (raw['overview'] ?? '').toString(),
    poster: _poster(raw['poster_path']),
    backdrop: _original(raw['backdrop_path']),
    parts: parts,
    genreCounts: genreCounts,
  );
}

/// Resolves a collection name to its TMDB id via `search/collection`, preferring
/// an exact normalized match, then a name-prefix match, then the first result.
Future<int?> tmdbSearchCollectionId(TmdbClient client, String query) async {
  if (!client.hasKey || query.isEmpty) return null;
  final raw = await client.get('search/collection', {'query': query});
  final results = (raw?['results'] as List?) ?? const [];
  if (results.isEmpty) return null;
  final want = normCollectionName(query);
  for (final r in results) {
    if (r is Map && normCollectionName((r['name'] ?? '').toString()) == want) {
      return (r['id'] as num?)?.toInt();
    }
  }
  for (final r in results) {
    if (r is Map &&
        collectionNameMatches((r['name'] ?? '').toString(), query)) {
      return (r['id'] as num?)?.toInt();
    }
  }
  final first = results.first;
  return first is Map ? (first['id'] as num?)?.toInt() : null;
}

/// Searches collections (grid), ported from `tmdbSearchCollections`: poster-less
/// backdrops allowed, total pages capped at 500.
Future<CollectionFeed> tmdbSearchCollections(
  TmdbClient client,
  String query, {
  int page = 1,
}) async {
  if (!client.hasKey || query.trim().isEmpty) {
    return const CollectionFeed(hits: [], totalPages: 0);
  }
  final raw = await client.get('search/collection', {
    'query': query,
    'page': '$page',
  });
  final results = (raw?['results'] as List?) ?? const [];
  final hits = <CollectionHit>[
    for (final r in results)
      if (r is Map && r['id'] is num && r['name'] != null)
        CollectionHit(
          id: (r['id'] as num).toInt(),
          name: r['name'].toString(),
          backdrop: _w780(r['backdrop_path']),
        ),
  ];
  final total = (raw?['total_pages'] as num?)?.toInt() ?? 0;
  return CollectionFeed(hits: hits, totalPages: total < 500 ? total : 500);
}

/// The default collections feed (a broad `collection` search), ported from
/// `tmdbCollectionsFeed`.
Future<CollectionFeed> tmdbCollectionsFeed(TmdbClient client, {int page = 1}) =>
    tmdbSearchCollections(client, 'collection', page: page);

String? _year(Object? s) {
  if (s is! String || s.isEmpty) return null;
  return s.length >= 4 ? s.substring(0, 4) : s;
}

String? _rating(Object? v) {
  final n = v is num ? v : (v is String ? num.tryParse(v) : null);
  return (n != null && n > 0) ? n.toStringAsFixed(1) : null;
}
