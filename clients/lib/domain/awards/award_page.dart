import '../addons/models.dart';
import '../catalog/tmdb.dart';
import '../text/deburr.dart';
import 'awards_catalog.dart';
import 'awards_history.dart';
import 'wikidata_awards.dart';

/// A film winner to resolve against TMDB. Ported from `FilmSeed`.
typedef FilmSeed = ({String title, int year, String kind});

/// A person winner to resolve against TMDB. Ported from `PersonSeed`.
typedef PersonSeed = ({
  String name,
  String role,
  String? work,
  int year,
  int wins,
});

/// The un-enriched seeds for an award body's page. Ported from `buildSeeds`'
/// return shape.
typedef AwardSeeds = ({
  List<FilmSeed> films,
  List<PersonSeed> actors,
  List<PersonSeed> directors,
  List<PersonSeed> writers,
});

/// The category keys whose winners are the body's headline *films* (everything
/// else is a person category). Ported from `PRIMARY_FILM_KEYS`.
const Map<AwardType, List<String>> kPrimaryFilmKeys = {
  AwardType.oscar: ['best_picture'],
  AwardType.emmy: [
    'outstanding_drama_series',
    'outstanding_comedy_series',
    'outstanding_limited_series',
  ],
  AwardType.goldenGlobe: [
    'best_picture_drama',
    'best_picture_musical_comedy',
    'best_tv_drama',
    'best_tv_musical_comedy',
  ],
  AwardType.bafta: ['best_film'],
  AwardType.sag: [
    'outstanding_cast_motion_picture',
    'outstanding_drama_ensemble',
    'outstanding_comedy_ensemble',
  ],
  AwardType.criticsChoice: [
    'best_picture',
    'best_drama_series',
    'best_comedy_series',
  ],
  AwardType.cannes: ['palme_dor'],
  AwardType.venice: ['golden_lion'],
  AwardType.berlin: ['golden_bear'],
};

final RegExp _reActor = RegExp('actor|actress|performance');
final RegExp _reDirector = RegExp('director|directing');
final RegExp _reWriter = RegExp(r'screenplay|\bwrit');
final RegExp _reFilm = RegExp(
  'picture|film|feature|series|palme|lion|bear|grand prix|ensemble|cast',
);
final RegExp _reSeries = RegExp(
  r'\bseries\b|television|\btv\b',
  caseSensitive: false,
);

/// Classifies a category name into the kind of winner it yields.
String classifyRole(String name) {
  final n = name.toLowerCase();
  if (_reActor.hasMatch(n)) return 'actor';
  if (_reDirector.hasMatch(n)) return 'director';
  if (_reWriter.hasMatch(n)) return 'writer';
  if (_reFilm.hasMatch(n)) return 'film';
  return 'other';
}

bool _isSeries(String name) => _reSeries.hasMatch(name);

const Set<String> _nonPerson = {
  'various', 'various artists', 'abc', 'cbs', 'nbc', 'fx', 'hbo', 'hbo max',
  'max', 'showtime', 'amazon', 'amazon prime video', 'netflix', 'hulu', 'usa',
  'amc', 'apple tv', 'the novel', 'the play', 'the memoir', 'the book',
  'the novella', 'the short story', 'the television play', 'a story', 'novel',
  'p r', 'p n', //
};

final RegExp _reSourceWork = RegExp(
  r'^the (novel|play|memoir|book|novella|short story|television play|story)$',
  caseSensitive: false,
);
final RegExp _reBrothers = RegExp(r'\bbrothers\b', caseSensitive: false);
final RegExp _reSplit = RegExp(
  r'\s*&\s*|\s+and\s+|\s*,\s*',
  caseSensitive: false,
);

bool _isPersonName(String name) {
  final k = normLoose(name);
  if (k.isEmpty) return false;
  if (_nonPerson.contains(k)) return false;
  if (_reSourceWork.hasMatch(name.trim())) return false;
  if (_reBrothers.hasMatch(name)) return false;
  return true;
}

/// Splits a raw recipient string on `&`/`and`/comma and keeps the person names.
List<String> splitRecipients(String raw) => raw
    .split(_reSplit)
    .map((s) => s.trim())
    .where((s) => s.isNotEmpty && _isPersonName(s))
    .toList();

/// Builds the film and people seeds for an award body from the bundled history:
/// primary-category winners become films (deduped by title, newest kept, capped
/// at 300); person categories accrue per-recipient win tallies (top 18 actors,
/// 14 directors, 14 writers). Ported from `buildSeeds`.
AwardSeeds buildAwardSeeds(AwardsHistory history, AwardType type) {
  final meta = kAwardCatalog[type];
  if (meta == null) {
    return (
      films: const [],
      actors: const [],
      directors: const [],
      writers: const [],
    );
  }
  final groups = history.readAwardHistory(type, meta.categories);
  final filmKeys = (kPrimaryFilmKeys[type] ?? const []).toSet();
  final filmByKey = <String, FilmSeed>{};
  final people = <String, Map<String, PersonSeed>>{
    'actor': {},
    'director': {},
    'writer': {},
  };

  for (final group in groups) {
    var role = filmKeys.contains(group.category.key)
        ? 'film'
        : classifyRole(group.category.name);
    if (role == 'film' && !filmKeys.contains(group.category.key)) {
      role = 'other';
    }
    final kind = _isSeries(group.category.name) ? 'series' : 'movie';
    for (final e in group.entries) {
      if (role == 'film') {
        final k = normLoose(e.workTitle);
        final prev = filmByKey[k];
        if (prev == null || e.year > prev.year) {
          filmByKey[k] = (title: e.workTitle, year: e.year, kind: kind);
        }
      } else if (role == 'actor' || role == 'director' || role == 'writer') {
        for (final name in e.recipients.expand(splitRecipients)) {
          final k = normLoose(name);
          if (k.isEmpty) continue;
          final map = people[role]!;
          final prev = map[k];
          if (prev == null) {
            map[k] = (
              name: name,
              role: group.category.name,
              work: e.workTitle,
              year: e.year,
              wins: 1,
            );
          } else {
            final newer = e.year > prev.year;
            map[k] = (
              name: prev.name,
              role: prev.role,
              work: newer ? e.workTitle : prev.work,
              year: newer ? e.year : prev.year,
              wins: prev.wins + 1,
            );
          }
        }
      }
    }
  }

  List<PersonSeed> top(Map<String, PersonSeed> m, int n) {
    final list = m.values.toList()
      ..sort((a, b) => b.wins != a.wins ? b.wins - a.wins : b.year - a.year);
    return list.take(n).toList();
  }

  final films = filmByKey.values.toList()..sort((a, b) => b.year - a.year);
  return (
    films: films.take(300).toList(),
    actors: top(people['actor']!, 18),
    directors: top(people['director']!, 14),
    writers: top(people['writer']!, 14),
  );
}

/// A resolved award person for the people rail. Ported from `AwardPerson`.
class AwardPerson {
  const AwardPerson({
    required this.id,
    required this.name,
    required this.photo,
    required this.role,
    required this.work,
    required this.wins,
  });

  final int id;
  final String name;
  final String? photo;
  final String role;
  final String? work;
  final int wins;
}

const Map<String, String> _roleDepartment = {
  'actor': 'Acting',
  'director': 'Directing',
  'writer': 'Writing',
};

/// Whether every token of the shorter name appears in the longer one — a loose
/// name match. Ported from `tokenMatch`.
bool tokenMatch(String a, String b) {
  final ta = a.split(' ').where((s) => s.isNotEmpty).toList();
  final tb = b.split(' ').where((s) => s.isNotEmpty).toList();
  if (ta.isEmpty || tb.isEmpty) return false;
  final shorter = ta.length <= tb.length ? ta : tb;
  final longer = (ta.length <= tb.length ? tb : ta).toSet();
  return shorter.every(longer.contains);
}

int _yearOf(Map r) {
  final d = (r['release_date'] ?? r['first_air_date'] ?? '').toString();
  return d.length >= 4 ? (int.tryParse(d.substring(0, 4)) ?? 0) : 0;
}

List<Map<String, dynamic>> _resultMaps(Object? data) => [
  for (final r in ((data is Map ? data['results'] : null) as List? ?? const []))
    if (r is Map) r.cast<String, dynamic>(),
];

/// Resolves a film seed to a TMDB title, preferring the wanted media type, then
/// year proximity, then popularity. Ported from `searchTitle`.
Future<MetaPreview?> searchAwardTitle(TmdbClient client, FilmSeed seed) async {
  final data = await client.get('search/multi', {
    'query': seed.title,
    'include_adult': 'false',
  });
  final wantTv = seed.kind == 'series';
  final results = [
    for (final r in _resultMaps(data))
      if ((r['media_type'] == 'movie' || r['media_type'] == 'tv') &&
          r['poster_path'] is String)
        r,
  ];
  if (results.isEmpty) return null;
  results.sort((a, b) {
    final ka = a['media_type'] == (wantTv ? 'tv' : 'movie') ? 0 : 1;
    final kb = b['media_type'] == (wantTv ? 'tv' : 'movie') ? 0 : 1;
    if (ka != kb) return ka - kb;
    final da = (_yearOf(a) - seed.year).abs();
    final db = (_yearOf(b) - seed.year).abs();
    if (da != db) return da - db;
    final pa = (a['popularity'] as num?)?.toDouble() ?? 0;
    final pb = (b['popularity'] as num?)?.toDouble() ?? 0;
    return pb.compareTo(pa);
  });
  final r = results.first;
  return r['media_type'] == 'tv' ? client.seriesMeta(r) : client.movieMeta(r);
}

/// Resolves a person seed to a TMDB person, matching the name exactly (else by
/// token overlap) and scoring by known-for department and popularity. Ported
/// from `searchPerson`.
Future<AwardPerson?> searchAwardPerson(
  TmdbClient client,
  PersonSeed seed,
) async {
  final data = await client.get('search/person', {
    'query': seed.name,
    'include_adult': 'false',
  });
  final want = normLoose(seed.name);
  final dept = _roleDepartment[classifyRole(seed.role)] ?? 'Acting';
  final named = [
    for (final r in _resultMaps(data))
      if (r['id'] != null && r['name'] is String) r,
  ];
  final exact = named
      .where((r) => normLoose(r['name'] as String) == want)
      .toList();
  final matched = exact.isNotEmpty
      ? exact
      : named
            .where((r) => tokenMatch(normLoose(r['name'] as String), want))
            .toList();
  if (matched.isEmpty) return null;

  double score(Map<String, dynamic> r) {
    final d = r['known_for_department'];
    final deptMatch = (d == null || d == dept) ? 1e6 : 0.0;
    return deptMatch + ((r['popularity'] as num?)?.toDouble() ?? 0);
  }

  var best = matched.first;
  for (final c in matched) {
    if (score(c) > score(best)) best = c;
  }
  final profile = best['profile_path'];
  final id = best['id'];
  return AwardPerson(
    id: id is int ? id : (id as num).toInt(),
    name: (best['name'] ?? seed.name).toString(),
    photo: (profile is String && profile.isNotEmpty)
        ? '$tmdbImg/w342$profile'
        : null,
    role: seed.role,
    work: seed.work,
    wins: seed.wins,
  );
}

Future<List<R>> _mapLimit<T, R>(
  List<T> items,
  int limit,
  Future<R> Function(T) fn,
) async {
  final out = <R>[];
  for (var i = 0; i < items.length; i += limit) {
    final end = (i + limit).clamp(0, items.length);
    out.addAll(await Future.wait(items.sublist(i, end).map(fn)));
  }
  return out;
}

/// Resolves film seeds to unique posters (8 in flight). Ported from
/// `resolveFilms`.
Future<List<MetaPreview>> resolveAwardFilms(
  TmdbClient client,
  List<FilmSeed> seeds,
) async {
  final hits = await _mapLimit(seeds, 8, (s) => searchAwardTitle(client, s));
  final seen = <String>{};
  final out = <MetaPreview>[];
  for (final m in hits) {
    if (m == null || m.poster == null || seen.contains(m.id)) continue;
    seen.add(m.id);
    out.add(m);
  }
  return out;
}

/// The resolved people for an award page. Ported from `AwardPeople`.
typedef AwardPeople = ({
  List<AwardPerson> actors,
  List<AwardPerson> directors,
  List<AwardPerson> writers,
});

const AwardPeople kEmptyAwardPeople = (
  actors: <AwardPerson>[],
  directors: <AwardPerson>[],
  writers: <AwardPerson>[],
);

/// Resolves all three people rails for a body. Ported from `loadAwardPeople`.
Future<AwardPeople> resolveAllAwardPeople(
  TmdbClient client,
  AwardSeeds seeds,
) async {
  final resolved = await Future.wait([
    resolveAwardPeople(client, seeds.actors),
    resolveAwardPeople(client, seeds.directors),
    resolveAwardPeople(client, seeds.writers),
  ]);
  return (actors: resolved[0], directors: resolved[1], writers: resolved[2]);
}

/// Resolves person seeds to unique people (8 in flight). Ported from
/// `resolvePeople`.
Future<List<AwardPerson>> resolveAwardPeople(
  TmdbClient client,
  List<PersonSeed> seeds,
) async {
  final hits = await _mapLimit(seeds, 8, (s) => searchAwardPerson(client, s));
  final seen = <int>{};
  final out = <AwardPerson>[];
  for (final p in hits) {
    if (p == null || seen.contains(p.id)) continue;
    seen.add(p.id);
    out.add(p);
  }
  return out;
}

final RegExp _tvCategory = RegExp(
  r'series|television|\btv\b|daytime|talk|host|reality|variety|game show|'
  r'soap|drama series|comedy series|limited series|miniseries|anthology',
  caseSensitive: false,
);

/// Whether a category name reads as television (so a work should resolve to a
/// series first). Ported from `TV_CATEGORY_RX`.
bool isTvCategory(String name) => _tvCategory.hasMatch(name);

/// A resolved work reference for the list mode.
typedef AwardWorkHit = ({int id, String type});

String _normTight(String s) => s
    .toLowerCase()
    .replaceAll('&', 'and')
    .replaceAll(RegExp(r'[^a-z0-9]+'), '');

Future<List<({int id, String title, int? year})>> _searchWorks(
  TmdbClient client,
  String title,
  String type,
) async {
  final data = await client.get('search/$type', {
    'query': title,
    'include_adult': 'false',
  });
  final out = <({int id, String title, int? year})>[];
  for (final r in _resultMaps(data).take(6)) {
    final id = r['id'];
    if (id is! num || id <= 0) continue;
    final name =
        (type == 'movie'
                ? (r['title'] ?? r['original_title'])
                : (r['name'] ?? r['original_name']))
            ?.toString() ??
        '';
    final date = (type == 'movie' ? r['release_date'] : r['first_air_date'])
        ?.toString();
    final year = (date != null && date.length >= 4)
        ? int.tryParse(date.substring(0, 4))
        : null;
    out.add((id: id.toInt(), title: name, year: year));
  }
  return out;
}

/// Resolves a list-mode winner's title to its TMDB work, scoring exact/substring
/// name matches, year proximity, and the wanted media type. Ported from
/// `resolveAwardWork` (its own tighter `normTitle` — `&`→and, no accents).
Future<AwardWorkHit?> resolveAwardWork(
  TmdbClient client,
  String title,
  int year,
  bool preferTv,
) async {
  final results = await Future.wait([
    _searchWorks(client, title, 'movie'),
    _searchWorks(client, title, 'tv'),
  ]);
  final want = _normTight(title);
  final candidates = <({int id, String title, int? year, String type})>[
    for (final r in results[1])
      (id: r.id, title: r.title, year: r.year, type: 'tv'),
    for (final r in results[0])
      (id: r.id, title: r.title, year: r.year, type: 'movie'),
  ];
  ({int id, String title, int? year, String type})? best;
  var bestScore = 0.0;
  for (final c in candidates) {
    final nt = _normTight(c.title);
    if (nt.isEmpty) continue;
    var score = 0.0;
    if (nt == want) {
      score += 100;
    } else if (nt.contains(want) || want.contains(nt)) {
      score += 45;
    } else {
      continue;
    }
    if (c.year != null) {
      final proximity = 18 - (c.year! - year).abs() * 3;
      score += proximity > 0 ? proximity.toDouble() : 0;
    }
    if (preferTv ? c.type == 'tv' : c.type == 'movie') score += 25;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best == null ? null : (id: best.id, type: best.type);
}

/// Lazily resolves an award body's films in pages, de-duplicating across pages
/// and stopping once enough are resolved. Ported from the web `loadAwardFilms`
/// state machine (as a reusable object the view drives on scroll).
class AwardFilmPager {
  AwardFilmPager(this.seeds);

  final List<FilmSeed> seeds;
  final List<MetaPreview> _resolved = [];
  final Set<String> _ids = {};
  int _next = 0;

  int get total => seeds.length;
  List<MetaPreview> get resolved => List.unmodifiable(_resolved);
  bool get done => _next >= seeds.length;

  /// Resolves further pages (12 seeds each) until at least [targetCount] films
  /// are available or the seeds are exhausted.
  Future<void> loadUntil(TmdbClient client, int targetCount) async {
    while (_resolved.length < targetCount && _next < seeds.length) {
      final end = (_next + 12).clamp(0, seeds.length);
      final batch = seeds.sublist(_next, end);
      _next = end;
      for (final m in await resolveAwardFilms(client, batch)) {
        if (_ids.add(m.id)) _resolved.add(m);
      }
    }
  }
}
