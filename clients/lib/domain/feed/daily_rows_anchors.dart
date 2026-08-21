import '../catalog/tmdb.dart' show kMovieGenres;
import 'daily_rows_types.dart';

/// The pinned anchor row ids, ported 1:1 from the anchor constants.
const String kAnchorTrending = 'trending';
const String kAnchorTopRated = 'critically_loved';
const String kAnchorAwards = 'award_winning';

/// The pool a rotating closing anchor is drawn from, ported from
/// `ROTATING_ANCHORS`.
const List<String> kRotatingAnchors = [
  'documentaries',
  'hidden_gems_anchor',
  'cult',
];

Map<String, String> _recentWindow(
  Map<String, String> floor,
  DateTime Function() clock,
) {
  String fmt(int t) => DateTime.fromMillisecondsSinceEpoch(
    t,
    isUtc: true,
  ).toIso8601String().substring(0, 10);
  final now = clock().millisecondsSinceEpoch;
  return {
    'primary_release_date.gte': fmt(now - 90 * 86400000),
    'primary_release_date.lte': fmt(now),
    ...floor,
  };
}

CatalogEntry _anchor(
  String id,
  String title,
  String kicker,
  RowEndpoint endpoint,
  Map<String, String> floor,
  DateTime Function() clock,
) => CatalogEntry(
  id: id,
  dimension: RowDimension.anchor,
  eligible: (_, _) => true,
  expand: (_, _, _) {
    final floorPrimary = id == 'recently_released'
        ? _recentWindow(floor, clock)
        : floor;
    return [
      ExpandedRow(
        key: '$id:_',
        title: title,
        kicker: kicker,
        mediaType: 'movie',
        endpoint: endpoint,
        floorPrimary: floorPrimary,
        floorRelaxed: endpoint == RowEndpoint.trending
            ? floorPrimary
            : relax(floorPrimary),
      ),
    ];
  },
);

/// The anchor catalog entries — the always-eligible rows that get pinned into
/// the daily feed. Ported 1:1 from `ANCHORS`. Inject [clock] for the recently-
/// released window in tests.
List<CatalogEntry> anchors({DateTime Function() clock = DateTime.now}) => [
  _anchor(
    'trending',
    'Trending This Week',
    'What people are watching',
    RowEndpoint.trending,
    {'sort_by': 'popularity.desc'},
    clock,
  ),
  _anchor(
    'award_winning',
    'Award Winning',
    'Best Picture winners',
    RowEndpoint.awards,
    {},
    clock,
  ),
  _anchor(
    'critically_loved',
    'Top Rated',
    'Critically acclaimed, all time',
    RowEndpoint.discover,
    {
      'vote_average.gte': '8.0',
      'vote_count.gte': '1000',
      'with_runtime.gte': '70',
      'sort_by': 'vote_average.desc',
    },
    clock,
  ),
  _anchor(
    'hidden_gems_anchor',
    'Highly Rated, Quietly Loved',
    'High score, low fanfare',
    RowEndpoint.discover,
    {
      'vote_average.gte': '7.2',
      'vote_count.gte': '300',
      'vote_count.lte': '3500',
      'with_runtime.gte': '70',
      'sort_by': 'vote_average.desc',
    },
    clock,
  ),
  _anchor(
    'cult',
    'Cult Classics',
    'Beloved, slightly forgotten',
    RowEndpoint.discover,
    {
      'primary_release_date.lte': '1999-12-31',
      'vote_average.gte': '7.4',
      'vote_count.gte': '300',
      'vote_count.lte': '5000',
      'sort_by': 'vote_average.desc',
    },
    clock,
  ),
  _anchor(
    'animated',
    'Animated, For Grown-Ups',
    "Beyond the kids' shelf",
    RowEndpoint.discover,
    {
      'with_genres': '${kMovieGenres['Animation']}',
      'vote_average.gte': '7.4',
      'vote_count.gte': '500',
      'sort_by': 'vote_average.desc',
    },
    clock,
  ),
  _anchor(
    'documentaries',
    'Documentaries Worth Your Night',
    'Highly rated, real life',
    RowEndpoint.discover,
    {
      'with_genres': '${kMovieGenres['Documentary']}',
      'vote_average.gte': '7.5',
      'vote_count.gte': '200',
      'sort_by': 'vote_average.desc',
    },
    clock,
  ),
  _anchor(
    'recently_released',
    'Recently Released',
    'Last 90 days',
    RowEndpoint.discover,
    {
      'vote_count.gte': '50',
      'with_runtime.gte': '70',
      'sort_by': 'popularity.desc',
    },
    clock,
  ),
];
