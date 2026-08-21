import '../catalog/streaming.dart' show kServices, providerIdsFor;
import '../catalog/tmdb.dart' show kGenreMovieToTv, kMovieGenres, kTvGenres;
import '../discover/affinity.dart' show Affinity;
import '../settings/settings.dart';
import 'daily_rows_anchors.dart' show anchors;
import 'daily_rows_people.dart' show peopleTemplates;
import 'daily_rows_select.dart'
    show normalizedAffinity, weightedPickWithoutReplacement;
import 'daily_rows_types.dart';
import 'feed_sections.dart' show genreToTmdbId;
import 'feed_seed.dart' show mixSeed;
import 'feed_tags.dart';

/// Original-language codes to their origin country, ported 1:1 from
/// `LANG_TO_COUNTRY`.
const Map<String, String> kLangToCountry = {
  'ja': 'JP',
  'ko': 'KR',
  'fr': 'FR',
  'it': 'IT',
  'de': 'DE',
  'sv': 'SE',
  'da': 'DK',
  'zh': 'CN',
  'hi': 'IN',
};

const int _recencyWindowMs = 540 * 86400000;

String _sinceDay(DateTime Function() clock) =>
    DateTime.fromMillisecondsSinceEpoch(
      clock().millisecondsSinceEpoch - _recencyWindowMs,
      isUtc: true,
    ).toIso8601String().substring(0, 10);

List<String> _genreNames(Affinity a, int base, int n) =>
    weightedPickWithoutReplacement(
      kMovieGenres.keys.toList(),
      (name) => 1 + lambda * normalizedAffinity(a.genres, name),
      rng(base, 'genre'),
      n,
    );

List<Decade> _decadePicks(Affinity a, int base, int n) =>
    weightedPickWithoutReplacement(
      kDecades,
      (d) =>
          1 +
          lambda *
              normalizedAffinity(
                a.decades,
                '${int.parse(d.from.substring(0, 4))}s',
              ),
      rng(base, 'decade'),
      n,
    );

List<FeedLanguage> _langPicks(Affinity a, int base, int n) =>
    weightedPickWithoutReplacement(
      kFeedLanguages,
      (l) => 1 + lambda * normalizedAffinity(a.languages, l.code),
      rng(base, 'lang'),
      n,
    );

ExpandedRow _row(
  String key,
  String title,
  Map<String, String> floorPrimary, {
  String? kicker,
  String mediaType = 'movie',
}) => ExpandedRow(
  key: key,
  title: title,
  kicker: kicker,
  mediaType: mediaType,
  endpoint: RowEndpoint.discover,
  floorPrimary: floorPrimary,
  floorRelaxed: relax(floorPrimary),
);

List<CatalogEntry> _parameterized(DateTime Function() clock) => [
  CatalogEntry(
    id: 'top_genre',
    dimension: RowDimension.genre,
    eligible: (_, _) => true,
    expand: (a, base, _) => [
      for (final name in _genreNames(a, base, 3))
        if (genreToTmdbId(name) case final gid?)
          _row(
            'top_genre:$name',
            'Top Rated $name',
            movieGenre(gid, {
              'vote_average.gte': '6.8',
              'vote_count.gte': '300',
              'sort_by': 'vote_average.desc',
            }),
          ),
    ],
  ),
  CatalogEntry(
    id: 'fresh_genre',
    dimension: RowDimension.genre,
    eligible: (_, _) => true,
    expand: (a, base, _) {
      final since = _sinceDay(clock);
      return [
        for (final name in _genreNames(a, mixSeed(base, 2), 2))
          if (genreToTmdbId(name) case final gid?)
            _row(
              'fresh_genre:$name',
              'New in $name',
              movieGenre(gid, {
                'primary_release_date.gte': since,
                'vote_count.gte': '80',
                'vote_average.gte': '6.3',
                'sort_by': 'popularity.desc',
              }),
            ),
      ];
    },
  ),
  CatalogEntry(
    id: 'genre_blend',
    dimension: RowDimension.genre,
    eligible: (a, _) => a.totalEvents > 0,
    expand: (a, base, _) {
      final names = _genreNames(a, mixSeed(base, 4), 4);
      final out = <ExpandedRow>[];
      for (var i = 0; i + 1 < names.length && out.length < 2; i += 2) {
        final ga = genreToTmdbId(names[i]);
        final gb = genreToTmdbId(names[i + 1]);
        if (ga == null || gb == null) continue;
        out.add(
          _row(
            'genre_blend:${names[i]}_${names[i + 1]}',
            '${names[i]} + ${names[i + 1]}',
            {
              'with_genres': '$ga,$gb',
              'with_runtime.gte': '70',
              'vote_average.gte': '6.6',
              'vote_count.gte': '200',
              'sort_by': 'vote_average.desc',
            },
          ),
        );
      }
      return out;
    },
  ),
  CatalogEntry(
    id: 'hidden_gem_decade',
    dimension: RowDimension.decade,
    eligible: (_, _) => true,
    expand: (a, base, _) => [
      for (final d in _decadePicks(a, base, 2))
        _row(
          'hidden_gem_decade:${d.label}',
          'Hidden Gems from the ${d.label}',
          {
            'primary_release_date.gte': d.from,
            'primary_release_date.lte': d.to,
            'vote_average.gte': '7.2',
            'vote_count.gte': '200',
            'vote_count.lte': '3000',
            'with_runtime.gte': '70',
            'sort_by': 'vote_average.desc',
          },
          kicker: 'Quietly great, ${d.label}',
        ),
    ],
  ),
  CatalogEntry(
    id: 'best_decade',
    dimension: RowDimension.decade,
    eligible: (_, _) => true,
    expand: (a, base, _) => [
      for (final d in _decadePicks(a, mixSeed(base, 7), 1))
        _row('best_decade:${d.label}', 'Best of the ${d.label}', {
          'primary_release_date.gte': d.from,
          'primary_release_date.lte': d.to,
          'vote_average.gte': '7.5',
          'vote_count.gte': '800',
          'sort_by': 'vote_average.desc',
        }),
    ],
  ),
  CatalogEntry(
    id: 'language',
    dimension: RowDimension.country,
    eligible: (_, _) => true,
    expand: (a, base, _) => [
      for (final l in _langPicks(a, base, 1))
        _row('language:${l.code}', l.label, {
          'with_original_language': l.code,
          'vote_average.gte': '7.0',
          'vote_count.gte': '150',
          'sort_by': 'vote_average.desc',
        }, kicker: 'Top rated abroad'),
    ],
  ),
  CatalogEntry(
    id: 'country',
    dimension: RowDimension.country,
    eligible: (_, _) => true,
    expand: (a, base, _) => [
      for (final l in _langPicks(a, mixSeed(base, 11), 2))
        if (kLangToCountry[l.code] case final iso?)
          _row(
            'country:$iso',
            '${l.label.replaceFirst(RegExp(r' Cinema$'), '')} Films',
            {
              'with_origin_country': iso,
              'vote_average.gte': '7.0',
              'vote_count.gte': '120',
              'sort_by': 'vote_average.desc',
            },
            kicker: 'From the region',
          ),
    ].take(1).toList(),
  ),
  CatalogEntry(
    id: 'runtime_short',
    dimension: RowDimension.runtime,
    eligible: (_, _) => true,
    expand: (a, base, _) => [
      for (final name in _genreNames(a, mixSeed(base, 3), 1))
        _row('runtime_short:$name', 'A Short Tonight: $name Under 90', {
          'with_runtime.lte': '90',
          'with_runtime.gte': '70',
          if (genreToTmdbId(name) case final gid?) 'with_genres': '$gid',
          'vote_average.gte': '7.0',
          'vote_count.gte': '250',
          'sort_by': 'vote_average.desc',
        }),
    ],
  ),
  CatalogEntry(
    id: 'tv_genre',
    dimension: RowDimension.genre,
    eligible: (_, _) => true,
    expand: (a, base, _) {
      final since = _sinceDay(clock);
      final names = _genreNames(a, mixSeed(base, 5), 6);
      final out = <ExpandedRow>[];
      final usedTv = <int>{};
      for (final name in names) {
        if (out.length >= 3) break;
        final gid = genreToTmdbId(name);
        final tvId = gid != null ? kGenreMovieToTv[gid] : kTvGenres[name];
        if (tvId == null || usedTv.contains(tvId)) continue;
        usedTv.add(tvId);
        final isFresh = out.length == 1;
        final floorPrimary = isFresh
            ? {
                'with_genres': '$tvId',
                'first_air_date.gte': since,
                'vote_count.gte': '60',
                'vote_average.gte': '6.8',
                'sort_by': 'popularity.desc',
              }
            : {
                'with_genres': '$tvId',
                'vote_average.gte': '7.5',
                'vote_count.gte': '200',
                'sort_by': 'vote_average.desc',
              };
        out.add(
          _row(
            'tv_genre:${isFresh ? 'new' : 'top'}:$name',
            isFresh ? 'New $name Series' : 'Top Rated $name Series',
            floorPrimary,
            kicker: isFresh ? 'Fresh on TV' : 'Critically acclaimed TV',
            mediaType: 'tv',
          ),
        );
      }
      return out;
    },
  ),
  CatalogEntry(
    id: 'provider',
    dimension: RowDimension.network,
    eligible: (_, settings) =>
        settings.tmdbKey.isNotEmpty && _enabledServices(settings).isNotEmpty,
    expand: (a, base, settings) {
      final enabled = _enabledServices(settings);
      if (enabled.isEmpty) return const [];
      final svc = weightedPickWithoutReplacement(
        enabled,
        (_) => 1,
        rng(base, 'provider'),
        1,
      ).first;
      final service = kServices[svc]!;
      final names = _genreNames(a, mixSeed(base, 13), 1);
      final gid = names.isNotEmpty ? genreToTmdbId(names.first) : null;
      return [
        _row('provider:$svc', 'On ${service.name}, picked for you', {
          'with_watch_providers': providerIdsFor(service),
          'watch_region': settings.region,
          if (gid != null) 'with_genres': '$gid',
          'vote_count.gte': '80',
          'sort_by': 'popularity.desc',
        }),
      ];
    },
  ),
];

List<String> _enabledServices(Settings settings) {
  final enabled = settings.getMap('streaming');
  return [
    for (final id in kServices.keys)
      if (enabled[id] == true) id,
  ];
}

/// The full daily-row catalog — the parameterized taste rows, the person and
/// keyword rows, and the pinned anchors. Ported 1:1 from `CATALOG`. Pass
/// [labels] to title the person rows and [clock] for the recency windows.
List<CatalogEntry> catalog({
  Map<int, String> labels = const {},
  DateTime Function() clock = DateTime.now,
}) => [
  ..._parameterized(clock),
  ...peopleTemplates(labels: labels),
  ...anchors(clock: clock),
];
