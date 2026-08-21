import '../addons/addon_client.dart';
import '../addons/addon_url.dart';
import '../addons/models.dart';
import 'cinemeta.dart';
import 'tmdb_details.dart';

/// A stable negative id for a person Cinemeta names but TMDB does not identify,
/// ported 1:1 from `synthId` (djb2 hash, 32-bit, negated). The 32-bit masking
/// mirrors JS bitwise-int32 semantics exactly.
int synthPersonId(String name) {
  var h = 5381;
  for (var i = 0; i < name.length; i++) {
    h = (((h << 5).toSigned(32) + h).toSigned(32) ^ name.codeUnitAt(i))
        .toSigned(32);
  }
  final abs = h.abs();
  return -(abs != 0 ? abs : 1);
}

List<PersonRef> _people(List<String> names) {
  final seen = <String>{};
  final out = <PersonRef>[];
  for (final name in names) {
    if (name.isEmpty || !seen.add(name)) continue;
    out.add(PersonRef(id: synthPersonId(name), name: name));
  }
  return out;
}

List<String> _strList(Object? v) =>
    (v as List?)?.whereType<String>().toList() ?? const [];

TmdbDetail _toDetail(
  Map<String, dynamic> m,
  String kind,
  List<MetaPreview> related,
) {
  final cast = <CastEntry>[];
  final rawCast = _strList(m['cast']);
  for (var i = 0; i < rawCast.length; i++) {
    cast.add(
      CastEntry(
        id: synthPersonId(rawCast[i]),
        name: rawCast[i],
        character: '',
        profilePath: null,
        order: i,
      ),
    );
  }
  final genres = (m['genre'] as List?) != null
      ? _strList(m['genre'])
      : _strList(m['genres']);
  final trailerCandidates = ((m['trailerStreams'] as List?) ?? const [])
      .whereType<Map>()
      .map((t) => t['ytId'])
      .whereType<String>()
      .where((s) => s.isNotEmpty)
      .toList();

  final year = m['year'] != null
      ? '${m['year']}'
      : m['releaseInfo'] is String
      ? (m['releaseInfo'] as String).let(
          (s) => s.length >= 4 ? s.substring(0, 4) : s,
        )
      : m['releaseInfo'] is num
      ? '${m['releaseInfo']}'
      : m['released'] is String
      ? (m['released'] as String).let(
          (s) => s.length >= 4 ? s.substring(0, 4) : s,
        )
      : null;

  final released = m['released'] as String?;
  final country = m['country'] as String?;

  return TmdbDetail(
    kind: kind,
    id: (m['moviedb_id'] as num?)?.toInt() ?? 0,
    imdbId:
        (m['imdb_id'] as String?) ??
        ((m['id'] as String?)?.startsWith('tt') ?? false
            ? m['id'] as String
            : null),
    title: (m['name'] ?? '').toString(),
    originalTitle: (m['name'] ?? '').toString(),
    tagline: '',
    overview: (m['description'] ?? '').toString(),
    poster: m['poster'] as String?,
    backdrop: m['background'] as String?,
    logo: m['logo'] as String?,
    year: year,
    rating: m['imdbRating'] as String?,
    voteCount: 0,
    runtime: m['runtime'] as String?,
    status: '',
    genres: genres,
    genresRich: const [],
    originalLanguage: '',
    spokenLanguages: const [],
    productionCountries: country != null
        ? country
              .split(',')
              .map((s) => s.trim())
              .where((s) => s.isNotEmpty)
              .toList()
        : const [],
    productionCompanies: const [],
    networks: const [],
    trailerYtId: trailerCandidates.isNotEmpty ? trailerCandidates.first : null,
    trailerCandidates: trailerCandidates,
    extraVideos: const [],
    gallery: const GalleryImages(backdrops: [], posters: [], logos: []),
    cast: cast,
    crew: const [],
    directors: _people(_strList(m['director'])),
    writers: _people(_strList(m['writer'])),
    creators: const [],
    producers: const [],
    composer: const [],
    cinematography: const [],
    editor: const [],
    recommendations: const [],
    similar: related,
    collection: null,
    seasons: const [],
    numberOfSeasons: 0,
    numberOfEpisodes: 0,
    keywords: const [],
    firstAirDate: released != null && released.length >= 10
        ? released.substring(0, 10)
        : released,
    lastAirDate: null,
    releaseDate: released != null && released.length >= 10
        ? released.substring(0, 10)
        : released,
    lastEpisodeAir: null,
    budget: null,
    revenue: null,
    homepage: null,
  );
}

/// The keyless detail source, ported 1:1 from `cinemetaDetails`: fetches the
/// Cinemeta meta for a `tt…` id and shapes it into a [TmdbDetail], filling
/// `similar` from the primary-genre `top` catalog (self excluded, capped at 30).
/// Returns null for a non-imdb id or a missing meta.
Future<TmdbDetail?> fetchCinemetaDetails(
  AddonClient client,
  MetaPreview meta,
) async {
  final imdbId = meta.id.startsWith('tt') ? meta.id : null;
  if (imdbId == null) return null;
  final kind = meta.type == 'series' ? 'tv' : 'movie';
  final typePath = kind == 'tv' ? 'series' : 'movie';

  final res = await client.meta(cinemetaBase, typePath, imdbId);
  final full = res.valueOrNull;
  if (full == null) return null;
  final m = full.json;

  final genres = (m['genre'] as List?) != null
      ? _strList(m['genre'])
      : _strList(m['genres']);
  final primaryGenre = genres.isNotEmpty ? genres.first : null;
  var related = const <MetaPreview>[];
  if (primaryGenre != null) {
    final r = await client.catalog(
      cinemetaBase,
      kind == 'movie' ? 'movie' : 'series',
      'top',
      extras: [CatalogExtra('genre', primaryGenre)],
    );
    related = (r.valueOrNull ?? const [])
        .where((x) => x.id != imdbId)
        .take(30)
        .toList();
  }
  return _toDetail(m, kind, related);
}

extension _Let<T> on T {
  R let<R>(R Function(T) f) => f(this);
}
