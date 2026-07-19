import '../discover/affinity.dart';
import 'daily_rows_types.dart';

/// The favorite people (directors merged with creators) by affinity, strongest
/// first, ported 1:1 from `topPeople`.
List<int> _topPeople(Affinity affinity, int n) {
  final merged = <int, double>{...affinity.directors};
  affinity.creators.forEach((id, w) => merged[id] = (merged[id] ?? 0) + w);
  return [
    for (final e in topEntries(merged, n))
      if (e.value > 0) e.key,
  ];
}

List<int> _topPositive(Map<int, double> map, int n) => [
  for (final e in topEntries(map, n))
    if (e.value > 0) e.key,
];

/// The person- and keyword-driven catalog rows — a favorite director, a favorite
/// actor, and recurring themes — that only appear once the taste profile has
/// learned them. Ported 1:1 from `PEOPLE_TEMPLATES`. Pass [labels] (resolved
/// person names) to title the rows; without them the rows use generic titles.
List<CatalogEntry> peopleTemplates({Map<int, String> labels = const {}}) => [
  CatalogEntry(
    id: 'person_director',
    dimension: RowDimension.person,
    eligible: (affinity, _) => _topPeople(affinity, 1).isNotEmpty,
    expand: (affinity, _, _) => [
      for (final id in _topPeople(affinity, 2))
        () {
          final name = labels[id];
          final floorPrimary = {
            'with_people': '$id',
            'vote_average.gte': '6.5',
            'vote_count.gte': '200',
            'sort_by': 'vote_average.desc',
          };
          return ExpandedRow(
            key: 'person_director:$id',
            title: name != null
                ? 'More from $name'
                : 'More from a Favorite Director',
            kicker: 'A name you keep watching',
            mediaType: 'movie',
            endpoint: RowEndpoint.discover,
            floorPrimary: floorPrimary,
            floorRelaxed: relax(floorPrimary),
          );
        }(),
    ],
  ),
  CatalogEntry(
    id: 'person_cast',
    dimension: RowDimension.person,
    eligible: (affinity, _) => _topPositive(affinity.cast, 1).isNotEmpty,
    expand: (affinity, _, _) => [
      for (final id in _topPositive(affinity.cast, 2))
        () {
          final name = labels[id];
          final floorPrimary = {
            'with_cast': '$id',
            'vote_average.gte': '6.5',
            'vote_count.gte': '250',
            'sort_by': 'popularity.desc',
          };
          return ExpandedRow(
            key: 'person_cast:$id',
            title: name != null ? 'Starring $name' : 'Starring a Favorite',
            kicker: 'An actor you keep watching',
            mediaType: 'movie',
            endpoint: RowEndpoint.discover,
            floorPrimary: floorPrimary,
            floorRelaxed: relax(floorPrimary),
          );
        }(),
    ],
  ),
  CatalogEntry(
    id: 'keyword',
    dimension: RowDimension.keyword,
    eligible: (affinity, _) => _topPositive(affinity.keywords, 1).isNotEmpty,
    expand: (affinity, _, _) => [
      for (final id in _topPositive(affinity.keywords, 2))
        () {
          final floorPrimary = {
            'with_keywords': '$id',
            'with_runtime.gte': '70',
            'vote_average.gte': '6.6',
            'vote_count.gte': '200',
            'sort_by': 'vote_average.desc',
          };
          return ExpandedRow(
            key: 'keyword:$id',
            title: 'More stories like these',
            kicker: 'Themes you keep returning to',
            mediaType: 'movie',
            endpoint: RowEndpoint.discover,
            floorPrimary: floorPrimary,
            floorRelaxed: relax(floorPrimary),
          );
        }(),
    ],
  ),
];
