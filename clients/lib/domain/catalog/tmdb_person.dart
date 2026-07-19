import 'dart:math' as math;

import '../addons/models.dart';
import 'tmdb.dart';

/// One film/TV credit for a person, ported from `PersonCredit`.
class PersonCredit {
  const PersonCredit({
    required this.id,
    required this.mediaType,
    required this.title,
    required this.popularity,
    required this.voteCount,
    required this.voteAverage,
    this.poster,
    this.background,
    this.releaseInfo,
    this.releaseDate,
    this.imdbRating,
    this.description,
    this.character,
    this.job,
    this.department,
    this.episodeCount,
    this.order,
    this.genreIds = const [],
  });

  final int id;
  final String mediaType; // movie | tv
  final String title;
  final double popularity;
  final int voteCount;
  final double voteAverage;
  final String? poster;
  final String? background;
  final String? releaseInfo;
  final String? releaseDate;
  final String? imdbRating;
  final String? description;
  final String? character;
  final String? job;
  final String? department;
  final int? episodeCount;
  final int? order;
  final List<int> genreIds;
}

/// A person's full detail + combined credits, ported from `PersonDetail`.
class PersonDetail {
  const PersonDetail({
    required this.id,
    required this.name,
    required this.biography,
    required this.knownForDepartment,
    required this.cast,
    required this.crew,
    this.birthday,
    this.deathday,
    this.placeOfBirth,
    this.profilePath,
    this.imdbId,
    this.homepage,
  });

  final int id;
  final String name;
  final String biography;
  final String knownForDepartment;
  final List<PersonCredit> cast;
  final List<PersonCredit> crew;
  final String? birthday;
  final String? deathday;
  final String? placeOfBirth;
  final String? profilePath;
  final String? imdbId;
  final String? homepage;
}

/// Fetches a person with their combined credits + external ids. Ported from
/// `fetchPerson`. Returns null without a key or when the id is unknown.
Future<PersonDetail?> fetchPerson(TmdbClient client, int personId) async {
  if (!client.hasKey) return null;
  final raw = await client.get('person/$personId', {
    'append_to_response': 'combined_credits,external_ids',
  });
  if (raw == null) return null;

  final combined = (raw['combined_credits'] as Map?)?.cast<String, dynamic>();
  List<PersonCredit> credits(String key) =>
      ((combined?[key] as List?) ?? const [])
          .whereType<Map>()
          .map((c) => _toCredit(c.cast<String, dynamic>()))
          .toList();

  final external = (raw['external_ids'] as Map?)?.cast<String, dynamic>();
  return PersonDetail(
    id: (raw['id'] as num?)?.toInt() ?? personId,
    name: (raw['name'] ?? '').toString(),
    biography: (raw['biography'] ?? '').toString(),
    birthday: raw['birthday'] as String?,
    deathday: raw['deathday'] as String?,
    placeOfBirth: raw['place_of_birth'] as String?,
    knownForDepartment: (raw['known_for_department'] ?? '').toString(),
    profilePath: raw['profile_path'] as String?,
    imdbId: external?['imdb_id'] as String?,
    homepage: raw['homepage'] as String?,
    cast: credits('cast'),
    crew: credits('crew'),
  );
}

PersonCredit _toCredit(Map<String, dynamic> c) {
  final date = (c['release_date'] ?? c['first_air_date']) as String?;
  final voteAverage = (c['vote_average'] as num?)?.toDouble() ?? 0;
  return PersonCredit(
    id: (c['id'] as num?)?.toInt() ?? 0,
    mediaType: (c['media_type'] ?? '').toString(),
    title: (c['title'] ?? c['name'] ?? '').toString(),
    poster: c['poster_path'] != null
        ? '$tmdbImg/w342${c['poster_path']}'
        : null,
    background: c['backdrop_path'] != null
        ? '$tmdbImg/w780${c['backdrop_path']}'
        : null,
    releaseInfo: date != null && date.isNotEmpty
        ? (date.length >= 4 ? date.substring(0, 4) : date)
        : null,
    releaseDate: date,
    imdbRating: voteAverage > 0 ? voteAverage.toStringAsFixed(1) : null,
    description: (c['overview'] ?? '').toString(),
    character: c['character'] as String?,
    job: c['job'] as String?,
    department: c['department'] as String?,
    popularity: (c['popularity'] as num?)?.toDouble() ?? 0,
    voteCount: (c['vote_count'] as num?)?.toInt() ?? 0,
    voteAverage: voteAverage,
    episodeCount: (c['episode_count'] as num?)?.toInt(),
    order: c['order'] is num ? (c['order'] as num).toInt() : null,
    genreIds: ((c['genre_ids'] as List?) ?? const [])
        .whereType<num>()
        .map((n) => n.toInt())
        .toList(),
  );
}

/// Converts a credit to a navigable meta, ported from `creditToMeta`.
MetaPreview creditToMeta(PersonCredit c) => MetaPreview.fromJson({
  'id': c.mediaType == 'movie' ? 'tmdb:movie:${c.id}' : 'tmdb:tv:${c.id}',
  'type': c.mediaType == 'movie' ? 'movie' : 'series',
  'name': c.title,
  if (c.poster != null) 'poster': c.poster,
  if (c.background != null) 'background': c.background,
  if (c.description != null) 'description': c.description,
  if (c.releaseInfo != null) 'releaseInfo': c.releaseInfo,
  if (c.releaseDate != null) 'releaseDate': c.releaseDate,
  if (c.imdbRating != null) 'imdbRating': c.imdbRating,
});

/// The grouped filmography sections a person view renders.
class PersonSections {
  const PersonSections({
    required this.knownFor,
    required this.movies,
    required this.shows,
    required this.directing,
    required this.writing,
    required this.producing,
    required this.other,
  });
  final List<PersonCredit> knownFor;
  final List<PersonCredit> movies;
  final List<PersonCredit> shows;
  final List<PersonCredit> directing;
  final List<PersonCredit> writing;
  final List<PersonCredit> producing;
  final List<PersonCredit> other;
}

List<PersonCredit> _sortedByPopularity(List<PersonCredit> credits) {
  final out = [...credits];
  stableSort(out, (a, b) => b.popularity.compareTo(a.popularity));
  return out;
}

/// Derives the person view's filmography sections, ported 1:1 from the
/// `PersonView` memos (known-for, movies, shows, directing, writing, producing,
/// other work).
PersonSections derivePersonSections(PersonDetail person) {
  final sortedCast = _sortedByPopularity(dedupe(person.cast));
  final sortedCrew = _sortedByPopularity(person.crew);

  final dept = person.knownForDepartment;
  final pool = (dept == 'Acting' || dept.isEmpty)
      ? sortedCast.where((c) => !isCameoOrGuest(c)).toList()
      : dedupeByMedia(sortedCrew.where((c) => c.department == dept).toList());
  stableSort(pool, (a, b) => notableScore(b).compareTo(notableScore(a)));
  final knownFor = pool.take(12).toList();

  bool director(PersonCredit c) => kDirectorJobs.contains(c.job ?? '');
  bool writer(PersonCredit c) => kWriterJobs.contains(c.job ?? '');
  bool producer(PersonCredit c) => kProducerJobs.contains(c.job ?? '');

  return PersonSections(
    knownFor: knownFor,
    movies: sortedCast.where((c) => c.mediaType == 'movie').toList(),
    shows: sortedCast.where((c) => c.mediaType == 'tv').toList(),
    directing: dedupe(sortedCrew.where(director).toList()),
    writing: dedupe(sortedCrew.where(writer).toList()),
    producing: dedupe(sortedCrew.where(producer).toList()),
    other: dedupe(
      sortedCrew
          .where((c) => !director(c) && !writer(c) && !producer(c))
          .toList(),
    ),
  );
}

// ---- person-utils.ts ----

const Set<String> kWriterJobs = {
  'Writer',
  'Screenplay',
  'Story',
  'Teleplay',
  'Author',
  'Novel',
  'Original Story',
};
const Set<String> kProducerJobs = {'Producer', 'Executive Producer'};
const Set<String> kDirectorJobs = {'Director'};

/// Whether a credit is a cameo/guest/self appearance, ported from
/// `isCameoOrGuest`.
bool isCameoOrGuest(PersonCredit c) {
  final ch = (c.character ?? '').toLowerCase().trim();
  final isSelf =
      ch == 'self' ||
      ch == 'himself' ||
      ch == 'herself' ||
      ch == 'themselves' ||
      ch.startsWith('self ') ||
      ch.startsWith('self -') ||
      ch.startsWith('himself ') ||
      ch.startsWith('himself -') ||
      ch.startsWith('herself ') ||
      ch.startsWith('herself -');
  if (ch.contains('(uncredited)') ||
      ch.contains('archive footage') ||
      ch.contains('archival footage')) {
    return true;
  }
  if (!isSelf) return false;
  if (c.mediaType == 'tv' && (c.episodeCount ?? 0) >= 8) return false;
  return true;
}

/// Prominence score for ranking a credit, ported from `notableScore`.
double notableScore(PersonCredit c) {
  final votes = c.voteCount.toDouble();
  if (c.mediaType == 'tv') {
    final eps = c.episodeCount ?? 0;
    if (eps < 3) return votes * 0.25;
    final epBoost = math.min(4.5, 1 + math.log(eps / 2) / math.ln2);
    final billing = c.order != null && c.order! < 5 ? 1.4 : 1.0;
    return votes * epBoost * billing;
  }
  final billing = c.order != null && c.order! < 5 ? 1.25 : 1.0;
  return votes * billing;
}

/// De-dupes credits by media + job, keeping the most popular. Ported from
/// `dedupe`.
List<PersonCredit> dedupe(List<PersonCredit> credits) {
  final map = <String, PersonCredit>{};
  for (final c in credits) {
    final k = '${c.mediaType}:${c.id}:${c.job ?? ''}';
    final existing = map[k];
    if (existing == null || existing.popularity < c.popularity) map[k] = c;
  }
  return map.values.toList();
}

/// De-dupes credits by media only, keeping the most popular. Ported from
/// `dedupeByMedia`.
List<PersonCredit> dedupeByMedia(List<PersonCredit> credits) {
  final map = <String, PersonCredit>{};
  for (final c in credits) {
    final k = '${c.mediaType}:${c.id}';
    final existing = map[k];
    if (existing == null || existing.popularity < c.popularity) map[k] = c;
  }
  return map.values.toList();
}

/// Age in years from a birth (and optional death) date, ported from `calcAge`.
int? calcAge(String birth, String? death, {DateTime? now}) {
  final b = _parseFlexibleDate(birth);
  if (b == null) return null;
  final end = death != null
      ? (_parseFlexibleDate(death) ?? (now ?? DateTime.now()))
      : (now ?? DateTime.now());
  var age = end.year - b.year;
  final m = end.month - b.month;
  if (m < 0 || (m == 0 && end.day < b.day)) age--;
  return age;
}

/// Long-form date ("July 13, 2026"), ported from `fmtDate`.
String fmtDate(String s) {
  final d = _parseFlexibleDate(s);
  if (d == null) return s;
  return '${_months[d.month - 1]} ${d.day}, ${d.year}';
}

const List<String> _months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

DateTime? _parseFlexibleDate(String s) {
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(s);
  if (m != null) {
    return DateTime(int.parse(m[1]!), int.parse(m[2]!), int.parse(m[3]!));
  }
  return DateTime.tryParse(s);
}
