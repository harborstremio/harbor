import '../feed/genre_spotlights.dart' show Spotlight, selectSpotlights;
import '../feed/genre_topics.dart' show Topic, kGenreTopics;
import 'tmdb.dart' show kGenreMovieToTv, kGenreTvToMovie, kMovieGenres;

/// A browse filter opened from a chip on the detail page or a tile — the native
/// port of the web `MetaFilter` union. Each kind resolves to a set of curated
/// discover / spotlight / topic rails via [filterRails].
sealed class MetaFilter {
  const MetaFilter(this.mediaType);

  /// `movie` or `tv`.
  final String mediaType;

  Map<String, dynamic> toArgs();

  /// The scroll/identity key, ported from the web `filterKey`.
  String get key;

  /// Rebuilds a filter from its serialized frame args, or null if unknown.
  static MetaFilter? fromArgs(Map<String, dynamic> a) {
    final kind = a['kind'] as String?;
    final mt = (a['mediaType'] as String?) ?? 'movie';
    final name = (a['name'] as String?) ?? '';
    switch (kind) {
      case 'year':
        return YearFilter(mt, (a['value'] as num).toInt());
      case 'runtime':
        return RuntimeFilter(mt, (a['value'] as num).toInt());
      case 'studio':
        return StudioFilter(mt, name, (a['id'] as num).toInt());
      case 'network':
        return NetworkFilter(mt, name, (a['id'] as num).toInt());
      case 'country':
        return CountryFilter(mt, name, (a['iso'] as String?) ?? '');
      case 'language':
        return LanguageFilter(mt, name, (a['iso'] as String?) ?? '');
      case 'genre':
        return GenreFilter(mt, name, (a['id'] as num).toInt());
      default:
        return null;
    }
  }

  /// The heading title shown for this filter.
  String get title;
}

class YearFilter extends MetaFilter {
  const YearFilter(super.mediaType, this.value);
  final int value;
  @override
  Map<String, dynamic> toArgs() => {
    'kind': 'year',
    'mediaType': mediaType,
    'value': value,
  };
  @override
  String get key => 'filter:year:$mediaType:$value';
  @override
  String get title => '$value';
}

class RuntimeFilter extends MetaFilter {
  const RuntimeFilter(super.mediaType, this.value);
  final int value;
  @override
  Map<String, dynamic> toArgs() => {
    'kind': 'runtime',
    'mediaType': mediaType,
    'value': value,
  };
  @override
  String get key => 'filter:runtime:$mediaType:$value';
  @override
  String get title => '$value min';
}

class StudioFilter extends MetaFilter {
  const StudioFilter(super.mediaType, this.name, this.id);
  final String name;
  final int id;
  @override
  Map<String, dynamic> toArgs() => {
    'kind': 'studio',
    'mediaType': mediaType,
    'name': name,
    'id': id,
  };
  @override
  String get key => 'filter:studio:$mediaType:$name';
  @override
  String get title => name;
}

class NetworkFilter extends MetaFilter {
  const NetworkFilter(super.mediaType, this.name, this.id);
  final String name;
  final int id;
  @override
  Map<String, dynamic> toArgs() => {
    'kind': 'network',
    'mediaType': mediaType,
    'name': name,
    'id': id,
  };
  @override
  String get key => 'filter:network:$mediaType:$name';
  @override
  String get title => name;
}

class CountryFilter extends MetaFilter {
  const CountryFilter(super.mediaType, this.name, this.iso);
  final String name;
  final String iso;
  @override
  Map<String, dynamic> toArgs() => {
    'kind': 'country',
    'mediaType': mediaType,
    'name': name,
    'iso': iso,
  };
  @override
  String get key => 'filter:country:$mediaType:$name';
  @override
  String get title => name;
}

class LanguageFilter extends MetaFilter {
  const LanguageFilter(super.mediaType, this.name, this.iso);
  final String name;
  final String iso;
  @override
  Map<String, dynamic> toArgs() => {
    'kind': 'language',
    'mediaType': mediaType,
    'name': name,
    'iso': iso,
  };
  @override
  String get key => 'filter:language:$mediaType:$name';
  @override
  String get title => name;
}

class GenreFilter extends MetaFilter {
  const GenreFilter(super.mediaType, this.name, this.id);
  final String name;
  final int id;
  @override
  Map<String, dynamic> toArgs() => {
    'kind': 'genre',
    'mediaType': mediaType,
    'name': name,
    'id': id,
  };
  @override
  String get key => 'filter:genre:$mediaType:$name';
  @override
  String get title => name;
}

/// A rail in a filter view — a discover query, a person spotlight, or a keyword
/// topic. Ported from the web `AnyRail` union.
sealed class AnyRail {
  const AnyRail();
}

/// A curated discover rail — a title, a kicker, and the TMDB `discover` query
/// params. Ported from the web `StandardRail`.
class StandardRail extends AnyRail {
  const StandardRail({
    required this.id,
    required this.title,
    required this.kicker,
    required this.params,
    this.mediaType,
    this.noDedup = false,
  });

  final String id;
  final String title;
  final String kicker;
  final Map<String, String> params;

  /// Overrides the filter's media type (language rails mix movies and series).
  final String? mediaType;
  final bool noDedup;
}

/// A person-spotlight rail (a director's/actor's films in the genre). Ported
/// from the web `SpotlightRail`.
class SpotlightRail extends AnyRail {
  const SpotlightRail({
    required this.id,
    required this.spotlight,
    required this.genreId,
  });
  final String id;
  final Spotlight spotlight;
  final int genreId;
}

/// A keyword-topic rail within a genre. Ported from the web `TopicRail`.
class TopicRail extends AnyRail {
  const TopicRail({
    required this.id,
    required this.topic,
    required this.mediaType,
  });
  final String id;
  final Topic topic;
  final String mediaType;
}

/// The runtime bucket for a runtime filter, ported 1:1 from `runtimeRange`.
({int lo, int hi}) runtimeRange(int value) {
  if (value <= 80) return (lo: 60, hi: 90);
  if (value <= 110) return (lo: 80, hi: 120);
  if (value <= 140) return (lo: 110, hi: 150);
  if (value <= 180) return (lo: 140, hi: 200);
  return (lo: 180, hi: 360);
}

String _isoDate(DateTime d) => d.toUtc().toIso8601String().substring(0, 10);

/// The discover rails for [f], ported 1:1 from the non-genre branches of
/// `railsForFilter` (+ `languageRails`). [clock] drives the relative "recent"
/// windows.
List<AnyRail> filterRails(
  MetaFilter f, {
  DateTime Function() clock = DateTime.now,
}) {
  switch (f) {
    case YearFilter(:final value, :final mediaType):
      final y = '$value';
      final yf = mediaType == 'movie'
          ? 'primary_release_year'
          : 'first_air_date_year';
      return [
        StandardRail(
          id: 'trending',
          title: 'Most popular',
          kicker: 'What people watched most',
          params: {yf: y, 'sort_by': 'popularity.desc', 'vote_count.gte': '50'},
        ),
        StandardRail(
          id: 'top',
          title: 'Highest rated',
          kicker: 'Critics + audiences',
          params: {
            yf: y,
            'sort_by': 'vote_average.desc',
            'vote_count.gte': '300',
          },
        ),
        StandardRail(
          id: 'gems',
          title: 'Hidden gems',
          kicker: 'Loved, just not loud about it',
          params: {
            yf: y,
            'sort_by': 'vote_average.desc',
            'vote_count.gte': '60',
            'vote_count.lte': '1500',
            'vote_average.gte': '7',
          },
        ),
      ];
    case RuntimeFilter(:final value, :final mediaType):
      final r = runtimeRange(value);
      final recent = mediaType == 'movie'
          ? 'primary_release_date.gte'
          : 'first_air_date.gte';
      return [
        StandardRail(
          id: 'popular',
          title: 'Popular',
          kicker: 'What people are watching',
          params: {
            'with_runtime.gte': '${r.lo}',
            'with_runtime.lte': '${r.hi}',
            'sort_by': 'popularity.desc',
            'vote_count.gte': '200',
          },
        ),
        StandardRail(
          id: 'rated',
          title: 'Highest rated',
          kicker: 'Time well spent',
          params: {
            'with_runtime.gte': '${r.lo}',
            'with_runtime.lte': '${r.hi}',
            'sort_by': 'vote_average.desc',
            'vote_count.gte': '500',
          },
        ),
        StandardRail(
          id: 'recent',
          title: 'Recent picks',
          kicker: 'Last few years',
          params: {
            'with_runtime.gte': '${r.lo}',
            'with_runtime.lte': '${r.hi}',
            recent: '2020-01-01',
            'sort_by': 'popularity.desc',
            'vote_count.gte': '200',
          },
        ),
      ];
    case StudioFilter(:final name, :final id, :final mediaType):
      final s = '$id';
      final recent = mediaType == 'movie'
          ? 'primary_release_date.gte'
          : 'first_air_date.gte';
      return [
        StandardRail(
          id: 'popular',
          title: 'Most popular',
          kicker: 'Biggest hits from $name',
          params: {
            'with_companies': s,
            'sort_by': 'popularity.desc',
            'vote_count.gte': '100',
          },
        ),
        StandardRail(
          id: 'rated',
          title: 'Highest rated',
          kicker: 'Critic and audience favorites',
          params: {
            'with_companies': s,
            'sort_by': 'vote_average.desc',
            'vote_count.gte': '500',
          },
        ),
        StandardRail(
          id: 'recent',
          title: 'Recent releases',
          kicker: 'Fresh from the studio',
          params: {
            'with_companies': s,
            recent: '2020-01-01',
            'sort_by': 'popularity.desc',
            'vote_count.gte': '30',
          },
        ),
        StandardRail(
          id: 'gems',
          title: 'Hidden gems',
          kicker: 'Loved, just quieter',
          params: {
            'with_companies': s,
            'sort_by': 'vote_average.desc',
            'vote_count.gte': '80',
            'vote_count.lte': '1500',
            'vote_average.gte': '7',
          },
        ),
      ];
    case CountryFilter(:final name, :final iso):
      return [
        StandardRail(
          id: 'popular',
          title: 'Most popular',
          kicker: 'From $name',
          params: {
            'with_origin_country': iso,
            'sort_by': 'popularity.desc',
            'vote_count.gte': '100',
          },
        ),
        StandardRail(
          id: 'rated',
          title: 'Highest rated',
          kicker: 'Acclaimed across critics and audiences',
          params: {
            'with_origin_country': iso,
            'sort_by': 'vote_average.desc',
            'vote_count.gte': '500',
          },
        ),
        StandardRail(
          id: 'gems',
          title: 'Hidden gems',
          kicker: 'Smaller releases worth surfacing',
          params: {
            'with_origin_country': iso,
            'sort_by': 'vote_average.desc',
            'vote_count.gte': '60',
            'vote_count.lte': '1500',
            'vote_average.gte': '7',
          },
        ),
      ];
    case NetworkFilter(:final name, :final id):
      final n = '$id';
      final recent = _isoDate(clock().subtract(const Duration(days: 365)));
      return [
        StandardRail(
          id: 'popular',
          title: 'Most popular',
          kicker: 'On $name',
          params: {
            'with_networks': n,
            'sort_by': 'popularity.desc',
            'vote_count.gte': '50',
          },
        ),
        StandardRail(
          id: 'rated',
          title: 'Highest rated',
          kicker: "Network's best",
          params: {
            'with_networks': n,
            'sort_by': 'vote_average.desc',
            'vote_count.gte': '200',
          },
        ),
        StandardRail(
          id: 'recent',
          title: 'Currently airing',
          kicker: "What's new on the network",
          params: {
            'with_networks': n,
            'first_air_date.gte': recent,
            'sort_by': 'popularity.desc',
            'vote_count.gte': '10',
          },
        ),
      ];
    case LanguageFilter(:final name, :final iso):
      return _languageRails(iso, name, clock);
    case GenreFilter(:final name, :final id, :final mediaType):
      return _genreRails(name, id, mediaType, clock);
  }
}

/// The genre browse rails, ported 1:1 from the genre branch of `railsForFilter`:
/// trending + top, the day-rotated person spotlights, a recent rail, the
/// companion-medium rails, a documentaries rail, keyword topics, eight decade
/// rails, and the gems / international / Japanese / Korean tails. Documentary is
/// vote-count-relaxed to 20% (min 10).
List<AnyRail> _genreRails(
  String name,
  int id,
  String mediaType,
  DateTime Function() clock,
) {
  final g = '$id';
  final dateField = mediaType == 'movie'
      ? 'primary_release_date'
      : 'first_air_date';
  final fiveYearsAgo = _isoDate(
    clock().subtract(const Duration(days: 5 * 365)),
  );
  final docId = kMovieGenres['Documentary']!;
  final isDoc = id == docId;
  String vc(int n) {
    if (!isDoc) return '$n';
    final relaxed = (n * 0.2).round();
    return '${relaxed < 10 ? 10 : relaxed}';
  }

  final rails = <AnyRail>[
    StandardRail(
      id: 'trending',
      title: 'Trending in $name',
      kicker: "What's hot right now",
      params: {
        'with_genres': g,
        'sort_by': 'popularity.desc',
        'vote_count.gte': vc(50),
      },
    ),
    StandardRail(
      id: 'top',
      title: 'Top Rated $name',
      kicker: 'All-time bests',
      params: {
        'with_genres': g,
        'sort_by': 'vote_average.desc',
        'vote_count.gte': vc(400),
      },
    ),
  ];

  final spotlights = selectSpotlights(name, now: clock());
  for (var i = 0; i < spotlights.length; i++) {
    rails.add(
      SpotlightRail(
        id: 'spotlight-$i-${spotlights[i].name}',
        spotlight: spotlights[i],
        genreId: id,
      ),
    );
  }

  rails.add(
    StandardRail(
      id: 'recent',
      title: 'Recent $name',
      kicker: 'Last 5 years',
      params: {
        'with_genres': g,
        '$dateField.gte': fiveYearsAgo,
        'sort_by': 'popularity.desc',
        'vote_count.gte': vc(150),
      },
    ),
  );

  final companionId = mediaType == 'movie'
      ? kGenreMovieToTv[id]
      : kGenreTvToMovie[id];
  if (companionId != null) {
    final companionType = mediaType == 'movie' ? 'tv' : 'movie';
    final word = companionType == 'tv' ? 'Series' : 'Movies';
    final cg = '$companionId';
    final companionDate = companionType == 'movie'
        ? 'primary_release_date'
        : 'first_air_date';
    rails.addAll([
      StandardRail(
        id: 'companion-trending',
        mediaType: companionType,
        title: 'Trending $name $word',
        kicker: "What's hot right now",
        params: {
          'with_genres': cg,
          'sort_by': 'popularity.desc',
          'vote_count.gte': vc(40),
        },
      ),
      StandardRail(
        id: 'companion-top',
        mediaType: companionType,
        title: 'Top Rated $name $word',
        kicker: 'Critics + audiences',
        params: {
          'with_genres': cg,
          'sort_by': 'vote_average.desc',
          'vote_count.gte': vc(200),
        },
      ),
      StandardRail(
        id: 'companion-recent',
        mediaType: companionType,
        title: 'Recent $name $word',
        kicker: 'Last 5 years',
        params: {
          'with_genres': cg,
          '$companionDate.gte': fiveYearsAgo,
          'sort_by': 'popularity.desc',
          'vote_count.gte': vc(80),
        },
      ),
    ]);
  }

  if (mediaType == 'movie' && id != docId) {
    rails.add(
      StandardRail(
        id: 'documentaries',
        title: '$name Documentaries',
        kicker: 'True stories',
        params: {
          'with_genres': '$g,$docId',
          'sort_by': 'vote_average.desc',
          'vote_count.gte': '10',
        },
      ),
    );
  }

  for (final topic in kGenreTopics[name] ?? const <Topic>[]) {
    if (topic.mediaType != null && topic.mediaType != mediaType) continue;
    rails.add(
      TopicRail(id: 'topic-${topic.id}', topic: topic, mediaType: mediaType),
    );
  }

  const decades =
      <
        (
          String id,
          String label,
          String kicker,
          String gte,
          String lte,
          int votes,
        )
      >[
        (
          'decade-2010s',
          'The 2010s in',
          'Defining moments',
          '2010-01-01',
          '2019-12-31',
          300,
        ),
        (
          'decade-2000s',
          '2000s',
          'Millennium picks',
          '2000-01-01',
          '2009-12-31',
          250,
        ),
        (
          'decade-90s',
          '90s',
          'VHS-era classics',
          '1990-01-01',
          '1999-12-31',
          200,
        ),
        (
          'decade-80s',
          '80s',
          'Golden-era cuts',
          '1980-01-01',
          '1989-12-31',
          150,
        ),
        ('decade-70s', '70s', 'New Hollywood', '1970-01-01', '1979-12-31', 100),
        ('decade-60s', '60s', 'Golden Years', '1960-01-01', '1969-12-31', 50),
      ];
  for (final (railId, label, kicker, gte, lte, votes) in decades) {
    rails.add(
      StandardRail(
        id: railId,
        title: '$label $name',
        kicker: kicker,
        params: {
          'with_genres': g,
          '$dateField.gte': gte,
          '$dateField.lte': lte,
          'sort_by': 'vote_average.desc',
          'vote_count.gte': vc(votes),
        },
      ),
    );
  }
  rails.add(
    StandardRail(
      id: 'decade-50s',
      title: 'Best of the 50s $name',
      kicker: 'Classic Hollywood',
      params: {
        'with_genres': g,
        '$dateField.gte': '1950-01-01',
        '$dateField.lte': '1959-12-31',
        'sort_by': 'vote_average.desc',
        'vote_count.gte': vc(30),
      },
    ),
  );
  rails.add(
    StandardRail(
      id: 'decade-pre50',
      title: 'Pre-1950 $name',
      kicker: 'The originals',
      params: {
        'with_genres': g,
        '$dateField.lte': '1949-12-31',
        'sort_by': 'vote_average.desc',
        'vote_count.gte': vc(20),
      },
    ),
  );

  rails.add(
    StandardRail(
      id: 'gems',
      title: 'Hidden $name Gems',
      kicker: 'Quiet favorites',
      noDedup: true,
      params: {
        'with_genres': g,
        'sort_by': 'vote_average.desc',
        'vote_count.gte': vc(40),
        'vote_count.lte': '2500',
        'vote_average.gte': '6.5',
      },
    ),
  );
  rails.add(
    StandardRail(
      id: 'international',
      title: 'International $name',
      kicker: 'Beyond Hollywood',
      noDedup: true,
      params: {
        'with_genres': g,
        'with_original_language':
            'fr|ja|ko|es|it|de|zh|ru|hi|pt|sv|da|no|fi|pl|tr',
        'sort_by': 'vote_average.desc',
        'vote_count.gte': '30',
      },
    ),
  );
  rails.add(
    StandardRail(
      id: 'japanese',
      title: 'Japanese $name',
      kicker: 'From Japan',
      noDedup: true,
      params: {
        'with_genres': g,
        'with_original_language': 'ja',
        'sort_by': 'popularity.desc',
      },
    ),
  );
  rails.add(
    StandardRail(
      id: 'korean',
      title: 'Korean $name',
      kicker: 'From Korea',
      noDedup: true,
      params: {
        'with_genres': g,
        'with_original_language': 'ko',
        'sort_by': 'popularity.desc',
      },
    ),
  );

  return rails;
}

const _movieGenreRails = <(String, String)>[
  ('Action', '28'),
  ('Comedy', '35'),
  ('Drama', '18'),
  ('Thriller', '53'),
  ('Romance', '10749'),
  ('Horror', '27'),
  ('Crime', '80'),
  ('Sci-Fi', '878'),
  ('Adventure', '12'),
  ('Mystery', '9648'),
  ('Fantasy', '14'),
  ('Animation', '16'),
  ('Family', '10751'),
  ('Documentary', '99'),
  ('History', '36'),
  ('Music', '10402'),
  ('War', '10752'),
];

const _tvGenreRails = <(String, String)>[
  ('Drama', '18'),
  ('Comedy', '35'),
  ('Crime', '80'),
  ('Action & Adventure', '10759'),
  ('Mystery', '9648'),
  ('Sci-Fi & Fantasy', '10765'),
  ('Animation', '16'),
  ('Documentary', '99'),
  ('Family', '10751'),
  ('Reality', '10764'),
];

const _decades = <(String, String, String)>[
  ('2020s', '2020-01-01', '2029-12-31'),
  ('2010s', '2010-01-01', '2019-12-31'),
  ('2000s', '2000-01-01', '2009-12-31'),
  ('The 90s', '1990-01-01', '1999-12-31'),
  ('The 80s', '1980-01-01', '1989-12-31'),
];

List<StandardRail> _languageRails(
  String iso,
  String name,
  DateTime Function() clock,
) {
  final recent = _isoDate(clock().subtract(const Duration(days: 730)));
  final rails = <StandardRail>[];
  void add(
    String id,
    String title,
    String kicker,
    String mediaType,
    Map<String, String> params, {
    bool noDedup = false,
  }) {
    rails.add(
      StandardRail(
        id: id,
        title: title,
        kicker: kicker,
        mediaType: mediaType,
        noDedup: noDedup,
        params: {'with_original_language': iso, ...params},
      ),
    );
  }

  add('pop-movies', 'Popular $name Movies', 'Most watched right now', 'movie', {
    'sort_by': 'popularity.desc',
    'vote_count.gte': '40',
  });
  add('pop-series', 'Popular $name Series', 'Trending shows', 'tv', {
    'sort_by': 'popularity.desc',
    'vote_count.gte': '25',
  });
  add(
    'top-movies',
    'Top Rated $name Movies',
    'Critic and audience favorites',
    'movie',
    {'sort_by': 'vote_average.desc', 'vote_count.gte': '120'},
  );
  add('top-series', 'Top Rated $name Series', 'Acclaimed shows', 'tv', {
    'sort_by': 'vote_average.desc',
    'vote_count.gte': '80',
  });
  add('new-movies', 'New $name Movies', 'Fresh releases', 'movie', {
    'primary_release_date.gte': recent,
    'sort_by': 'popularity.desc',
    'vote_count.gte': '10',
  });
  add('new-series', 'New $name Series', 'Just premiered', 'tv', {
    'first_air_date.gte': recent,
    'sort_by': 'popularity.desc',
    'vote_count.gte': '8',
  });
  for (final (label, gid) in _movieGenreRails) {
    add('mg-$gid', '$name $label', 'Movies', 'movie', {
      'with_genres': gid,
      'sort_by': 'popularity.desc',
      'vote_count.gte': '20',
    }, noDedup: true);
  }
  for (final (label, gid) in _tvGenreRails) {
    add('tg-$gid', '$name $label', 'Series', 'tv', {
      'with_genres': gid,
      'sort_by': 'popularity.desc',
      'vote_count.gte': '12',
    }, noDedup: true);
  }
  for (final (label, gte, lte) in _decades) {
    add('dec-$gte', '$name Movies: $label', 'By the decade', 'movie', {
      'primary_release_date.gte': gte,
      'primary_release_date.lte': lte,
      'sort_by': 'vote_average.desc',
      'vote_count.gte': '20',
    }, noDedup: true);
  }
  add('gems', 'Hidden $name Gems', 'Loved, lesser known', 'movie', {
    'sort_by': 'vote_average.desc',
    'vote_count.gte': '30',
    'vote_count.lte': '1500',
    'vote_average.gte': '6.5',
  }, noDedup: true);
  return rails;
}
