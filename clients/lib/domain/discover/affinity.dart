import 'dart:math' as math;

/// A discover interaction kind, ported 1:1 from `EventKind`.
enum EventKind {
  open('open'),
  dwell('dwell'),
  play('play'),
  watchlist('watchlist'),
  watched('watched'),
  voteUp('vote_up'),
  voteDown('vote_down');

  const EventKind(this.wire);
  final String wire;
}

/// The [EventKind] for a stored wire string, or null.
EventKind? eventKindFromWire(String wire) {
  for (final k in EventKind.values) {
    if (k.wire == wire) return k;
  }
  return null;
}

/// The taste-relevant facts extracted from a title, ported 1:1 from
/// `ProfileSnapshot`.
class ProfileSnapshot {
  const ProfileSnapshot({
    this.cast = const [],
    this.directors = const [],
    this.creators = const [],
    this.genres = const [],
    this.keywords = const [],
    this.decade,
    this.language,
  });

  final List<int> cast;
  final List<int> directors;
  final List<int> creators;
  final List<String> genres;
  final List<int> keywords;
  final String? decade;
  final String? language;

  Map<String, dynamic> toJson() => {
    'cast': cast,
    'directors': directors,
    'creators': creators,
    'genres': genres,
    'keywords': keywords,
    if (decade != null) 'decade': decade,
    if (language != null) 'language': language,
  };

  static ProfileSnapshot fromJson(Map<String, dynamic> j) => ProfileSnapshot(
    cast: _ints(j['cast']),
    directors: _ints(j['directors']),
    creators: _ints(j['creators']),
    genres: _strs(j['genres']),
    keywords: _ints(j['keywords']),
    decade: j['decade'] is String ? j['decade'] as String : null,
    language: j['language'] is String ? j['language'] as String : null,
  );

  static List<int> _ints(Object? v) => v is List
      ? [
          for (final e in v)
            if (e is num) e.toInt(),
        ]
      : const [];
  static List<String> _strs(Object? v) =>
      v is List ? v.whereType<String>().toList() : const [];
}

/// One recorded discover interaction, ported 1:1 from `DiscoverEvent`.
class DiscoverEvent {
  const DiscoverEvent({
    required this.id,
    required this.kind,
    required this.ts,
    this.meta,
  });

  final String id;
  final EventKind kind;
  final int ts;
  final ProfileSnapshot? meta;

  Map<String, dynamic> toJson() => {
    'id': id,
    'kind': kind.wire,
    'ts': ts,
    if (meta != null) 'meta': meta!.toJson(),
  };

  static DiscoverEvent? fromJson(Object? j) {
    if (j is! Map) return null;
    final id = j['id'];
    final kind = j['kind'];
    final ts = j['ts'];
    if (id is! String || kind is! String || ts is! num) return null;
    final ek = eventKindFromWire(kind);
    if (ek == null) return null;
    return DiscoverEvent(
      id: id,
      kind: ek,
      ts: ts.toInt(),
      meta: j['meta'] is Map
          ? ProfileSnapshot.fromJson((j['meta'] as Map).cast<String, dynamic>())
          : null,
    );
  }
}

/// The learned taste profile — per-entity weights across cast, crew, genres,
/// keywords, decades and languages, plus bookkeeping. Ported 1:1 from `Affinity`.
class Affinity {
  Affinity({
    Map<int, double>? cast,
    Map<int, double>? directors,
    Map<int, double>? creators,
    Map<String, double>? genres,
    Map<int, double>? keywords,
    Map<String, double>? decades,
    Map<String, double>? languages,
    this.totalEvents = 0,
    this.lastUpdated = 0,
  }) : cast = cast ?? {},
       directors = directors ?? {},
       creators = creators ?? {},
       genres = genres ?? {},
       keywords = keywords ?? {},
       decades = decades ?? {},
       languages = languages ?? {};

  final Map<int, double> cast;
  final Map<int, double> directors;
  final Map<int, double> creators;
  final Map<String, double> genres;
  final Map<int, double> keywords;
  final Map<String, double> decades;
  final Map<String, double> languages;
  int totalEvents;
  int lastUpdated;
}

/// A blank affinity, ported 1:1 from `freshAffinity`.
Affinity freshAffinity() => Affinity();

const int _halfLifeMs = 90 * 24 * 60 * 60 * 1000;

const Map<EventKind, double> _kindWeight = {
  EventKind.open: 1.0,
  EventKind.play: 3.0,
  EventKind.dwell: 2.5,
  EventKind.watchlist: 4.0,
  EventKind.watched: 6.0,
  EventKind.voteUp: 5.0,
  EventKind.voteDown: -3.0,
};

const double _wCast = 1.0;
const double _wDirectors = 1.5;
const double _wCreators = 1.5;
const double _wGenres = 0.8;
const double _wKeywords = 1.2;
const double _wDecade = 0.4;
const double _wLanguage = 0.3;

void _bumpNum(Map<int, double> map, int id, double w) {
  map[id] = (map[id] ?? 0) + w;
}

void _bumpStr(Map<String, double> map, String k, double w) {
  if (k.isEmpty) return;
  map[k] = (map[k] ?? 0) + w;
}

/// Rebuilds the [Affinity] from an event log, weighting each event by its kind
/// and an exponential recency decay (90-day half-life). Ported 1:1 from
/// `buildAffinity`.
Affinity buildAffinity(List<DiscoverEvent> events, {int? now}) {
  final a = freshAffinity();
  final at = now ?? DateTime.now().millisecondsSinceEpoch;
  for (final e in events) {
    final meta = e.meta;
    if (meta == null) continue;
    final age = math.max(0, at - e.ts);
    final recency = math.exp(-math.ln2 * age / _halfLifeMs);
    final w = (_kindWeight[e.kind] ?? 1) * recency;
    if (w == 0) continue;
    for (final id in meta.cast) {
      _bumpNum(a.cast, id, w);
    }
    for (final id in meta.directors) {
      _bumpNum(a.directors, id, w * 1.2);
    }
    for (final id in meta.creators) {
      _bumpNum(a.creators, id, w * 1.2);
    }
    for (final g in meta.genres) {
      _bumpStr(a.genres, g, w);
    }
    for (final k in meta.keywords) {
      _bumpNum(a.keywords, k, w);
    }
    if (meta.decade != null) _bumpStr(a.decades, meta.decade!, w);
    if (meta.language != null) _bumpStr(a.languages, meta.language!, w);
    a.totalEvents++;
  }
  a.lastUpdated = at;
  return a;
}

double _avgWeightNum(List<int> ids, Map<int, double> map) {
  if (ids.isEmpty) return 0;
  var s = 0.0;
  for (final id in ids) {
    s += map[id] ?? 0;
  }
  return s / math.sqrt(ids.length);
}

double _avgWeightStr(List<String> ids, Map<String, double> map) {
  if (ids.isEmpty) return 0;
  var s = 0.0;
  for (final id in ids) {
    s += map[id] ?? 0;
  }
  return s / math.sqrt(ids.length);
}

double _sumWeightNum(List<int> ids, Map<int, double> map) {
  var s = 0.0;
  for (final id in ids) {
    s += map[id] ?? 0;
  }
  return s;
}

/// Scores a [profile] against the learned [affinity]. Ported 1:1 from `score`.
double score(ProfileSnapshot profile, Affinity affinity) {
  final cast = _avgWeightNum(profile.cast, affinity.cast);
  final directors = _sumWeightNum(profile.directors, affinity.directors);
  final creators = _sumWeightNum(profile.creators, affinity.creators);
  final genres = _avgWeightStr(profile.genres, affinity.genres);
  final keywords = _avgWeightNum(profile.keywords, affinity.keywords);
  final decade = profile.decade != null
      ? (affinity.decades[profile.decade] ?? 0)
      : 0;
  final lang = profile.language != null
      ? (affinity.languages[profile.language] ?? 0)
      : 0;
  return _wCast * cast +
      _wDirectors * directors +
      _wCreators * creators +
      _wGenres * genres +
      _wKeywords * keywords +
      _wDecade * decade +
      _wLanguage * lang;
}

/// The top [n] weighted entries, highest first. Ported 1:1 from `topEntries`.
List<MapEntry<K, double>> topEntries<K>(Map<K, double> weights, int n) {
  final entries = weights.entries.toList()
    ..sort((a, b) => b.value.compareTo(a.value));
  return entries.take(n).toList();
}

/// True when no events have shaped the affinity yet. Ported from `affinityIsEmpty`.
bool affinityIsEmpty(Affinity a) => a.totalEvents == 0;
