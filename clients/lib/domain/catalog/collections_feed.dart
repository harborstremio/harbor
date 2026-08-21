import 'dart:math' as math;

import 'tmdb.dart';
import 'tmdb_collection.dart';

const int _pagesPerPull = 4;
const int _minMatchesPerPull = 6;

const Map<String, int> _genreIds = {
  'Action': 28,
  'Adventure': 12,
  'Sci-Fi': 878,
  'Fantasy': 14,
  'Animation': 16,
  'Horror': 27,
  'Comedy': 35,
  'Crime': 80,
};

final RegExp _heroRx = RegExp(
  r'(marvel|dc\b|batman|superman|spider|x-men|avengers|hulk|thor|'
  r'captain america|justice league|super.?hero)',
  caseSensitive: false,
);

/// Strips a trailing "Collection" suffix from a TMDB collection name, ported
/// 1:1 from `stripSuffix`.
String stripCollectionSuffix(String name) {
  final stripped = name
      .replaceFirst(
        RegExp(r'\s*[-:]?\s*(?:the\s+)?collection$', caseSensitive: false),
        '',
      )
      .trim();
  return stripped.isEmpty ? name : stripped;
}

/// Whether a collection belongs to a browse category, ported 1:1 from
/// `matchesCategory` (genre-count heuristics per category).
bool matchesCategory(TmdbCollection col, String category) {
  if (col.parts.length < 2) return false;
  final total = col.parts.length;
  int cnt(int id) => col.genreCounts[id] ?? 0;
  if (category == 'Sagas') return total >= 4;
  if (category == 'Superheroes') {
    return cnt(28) + cnt(878) + cnt(14) >= (total / 2).ceil() &&
        _heroRx.hasMatch('${col.name} ${col.overview}');
  }
  final gid = _genreIds[category];
  if (gid == null) return false;
  return cnt(gid) >= math.max(2, (total * 0.4).ceil());
}

/// One matched collection in a category feed, ported from `CategoryHit`.
class CategoryHit {
  const CategoryHit({
    required this.id,
    required this.name,
    required this.backdrop,
    required this.count,
  });
  final int id;
  final String name;
  final String? backdrop;
  final int count;
}

/// The result of one category-feed pull: the freshly matched collections, the
/// advanced page cursor, and whether the source is exhausted.
class CategoryPull {
  const CategoryPull({
    required this.hits,
    required this.nextPage,
    required this.exhausted,
  });
  final List<CategoryHit> hits;
  final int nextPage;
  final bool exhausted;
}

/// Pulls up to [_pagesPerPull] collection-search pages (stopping early once
/// [_minMatchesPerPull] matches are found), resolving each hit's detail and
/// keeping those that match [category]. Ported from the `useCategoryFeed` pull
/// loop; [seen] and the returned cursor let the caller page through the feed.
Future<CategoryPull> categoryFeedPull(
  TmdbClient client, {
  required String category,
  required int fromPage,
  required Set<int> seen,
  required Set<String> excludeNames,
}) async {
  final found = <CategoryHit>[];
  var page = fromPage;
  var exhausted = false;

  for (var i = 0; i < _pagesPerPull && found.length < _minMatchesPerPull; i++) {
    final next = page + 1;
    CollectionFeed feed;
    try {
      feed = await tmdbSearchCollections(client, 'collection', page: next);
    } catch (_) {
      feed = const CollectionFeed(hits: [], totalPages: 0);
    }
    page = next;
    if (feed.hits.isEmpty || next >= feed.totalPages) {
      exhausted = true;
      break;
    }
    final cols = await Future.wait(
      feed.hits.map((h) async {
        if (seen.contains(h.id)) return null;
        try {
          return await fetchTmdbCollection(client, h.id);
        } catch (_) {
          return null;
        }
      }),
    );
    for (final c in cols) {
      if (c == null || seen.contains(c.id)) continue;
      seen.add(c.id);
      final display = stripCollectionSuffix(c.name);
      if (excludeNames.contains(display.toLowerCase())) continue;
      if (!matchesCategory(c, category)) continue;
      found.add(
        CategoryHit(
          id: c.id,
          name: display,
          backdrop: c.backdrop,
          count: c.parts.length,
        ),
      );
    }
  }

  return CategoryPull(hits: found, nextPage: page, exhausted: exhausted);
}
