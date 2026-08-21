import '../addons/models.dart';
import 'tmdb.dart';

/// A streaming service's TMDB watch-provider metadata + branding, ported 1:1
/// from `SERVICES` in `src/lib/providers/streaming.ts`.
class StreamingServiceMeta {
  const StreamingServiceMeta({
    required this.id,
    required this.name,
    required this.logoAsset,
    required this.tint,
    this.providerIds,
    this.logoHeight,
  });

  /// The primary TMDB watch-provider id.
  final int id;

  /// Extra provider ids merged with [id] for the discover query (regional
  /// duplicates, e.g. Prime's 9 + 119).
  final List<int>? providerIds;

  final String name;

  /// Bundled logo asset path (`assets/services/<svc>.svg`).
  final String logoAsset;

  /// Brand tint as an ARGB int, used for the service-view gradient wash.
  final int tint;

  /// Optional native logo pixel height for scale correction (Disney).
  final int? logoHeight;
}

/// The nine supported streaming services, keyed by their settings id.
const Map<String, StreamingServiceMeta> kServices = {
  'netflix': StreamingServiceMeta(
    id: 8,
    name: 'Netflix',
    logoAsset: 'assets/services/netflix.svg',
    tint: 0xFFE50914,
  ),
  'disney': StreamingServiceMeta(
    id: 337,
    name: 'Disney+',
    logoAsset: 'assets/services/disney.svg',
    tint: 0xFF0E47A1,
    logoHeight: 46,
  ),
  'hulu': StreamingServiceMeta(
    id: 15,
    name: 'Hulu',
    logoAsset: 'assets/services/hulu.svg',
    tint: 0xFF1CE783,
  ),
  'prime': StreamingServiceMeta(
    id: 9,
    providerIds: [9, 119],
    name: 'Prime Video',
    logoAsset: 'assets/services/prime.svg',
    tint: 0xFF00A8E1,
  ),
  'apple': StreamingServiceMeta(
    id: 350,
    name: 'Apple TV+',
    logoAsset: 'assets/services/apple.svg',
    tint: 0xFFFFFFFF,
  ),
  'max': StreamingServiceMeta(
    id: 1899,
    providerIds: [1899, 384],
    name: 'Max',
    logoAsset: 'assets/services/max.svg',
    tint: 0xFF9B6CFF,
  ),
  'paramount': StreamingServiceMeta(
    id: 531,
    providerIds: [531, 582, 1715, 1854],
    name: 'Paramount+',
    logoAsset: 'assets/services/paramount.svg',
    tint: 0xFF0064FF,
  ),
  'peacock': StreamingServiceMeta(
    id: 386,
    providerIds: [386, 387],
    name: 'Peacock',
    logoAsset: 'assets/services/peacock.svg',
    tint: 0xFFFF7112,
  ),
  'crunchyroll': StreamingServiceMeta(
    id: 283,
    name: 'Crunchyroll',
    logoAsset: 'assets/services/crunchyroll.svg',
    tint: 0xFFF47521,
  ),
};

/// The service ids in their canonical rail order.
const List<String> kServiceOrder = [
  'netflix',
  'disney',
  'hulu',
  'prime',
  'apple',
  'max',
  'paramount',
  'peacock',
  'crunchyroll',
];

/// The pipe-joined watch-provider ids for a service's discover query, ported
/// from `providerIdsFor`.
String providerIdsFor(StreamingServiceMeta s) =>
    (s.providerIds ?? [s.id]).join('|');

/// A service-view filter category, ported 1:1 from `CATEGORIES` in
/// `src/views/service.tsx`.
class ServiceCategory {
  const ServiceCategory({
    required this.id,
    required this.label,
    required this.fetchMovies,
    required this.fetchTv,
    this.movieGenres = const [],
    this.tvGenres = const [],
  });

  final String id;
  final String label;
  final bool fetchMovies;
  final bool fetchTv;
  final List<int> movieGenres;
  final List<int> tvGenres;
}

/// The fourteen service-view categories in order.
const List<ServiceCategory> kServiceCategories = [
  ServiceCategory(id: 'all', label: 'All', fetchMovies: true, fetchTv: true),
  ServiceCategory(
    id: 'movies',
    label: 'Movies',
    fetchMovies: true,
    fetchTv: false,
  ),
  ServiceCategory(
    id: 'tv',
    label: 'TV Shows',
    fetchMovies: false,
    fetchTv: true,
  ),
  ServiceCategory(
    id: 'docs',
    label: 'Documentaries',
    fetchMovies: true,
    fetchTv: true,
    movieGenres: [99],
    tvGenres: [99],
  ),
  ServiceCategory(
    id: 'anim',
    label: 'Animation',
    fetchMovies: true,
    fetchTv: true,
    movieGenres: [16],
    tvGenres: [16],
  ),
  ServiceCategory(
    id: 'kids',
    label: 'Kids & Family',
    fetchMovies: true,
    fetchTv: true,
    movieGenres: [10751],
    tvGenres: [10751],
  ),
  ServiceCategory(
    id: 'reality',
    label: 'Reality',
    fetchMovies: false,
    fetchTv: true,
    tvGenres: [10764],
  ),
  ServiceCategory(
    id: 'action',
    label: 'Action',
    fetchMovies: true,
    fetchTv: true,
    movieGenres: [28],
    tvGenres: [10759],
  ),
  ServiceCategory(
    id: 'comedy',
    label: 'Comedy',
    fetchMovies: true,
    fetchTv: true,
    movieGenres: [35],
    tvGenres: [35],
  ),
  ServiceCategory(
    id: 'drama',
    label: 'Drama',
    fetchMovies: true,
    fetchTv: true,
    movieGenres: [18],
    tvGenres: [18],
  ),
  ServiceCategory(
    id: 'horror',
    label: 'Horror',
    fetchMovies: true,
    fetchTv: true,
    movieGenres: [27],
    tvGenres: [9648],
  ),
  ServiceCategory(
    id: 'scifi',
    label: 'Sci-Fi & Fantasy',
    fetchMovies: true,
    fetchTv: true,
    movieGenres: [878],
    tvGenres: [10765],
  ),
  ServiceCategory(
    id: 'thriller',
    label: 'Thriller',
    fetchMovies: true,
    fetchTv: false,
    movieGenres: [53],
  ),
  ServiceCategory(
    id: 'romance',
    label: 'Romance',
    fetchMovies: true,
    fetchTv: false,
    movieGenres: [10749],
  ),
];

/// A page-batch of a service category: the deduped movie and series metas.
class ServiceBucket {
  const ServiceBucket({required this.movies, required this.series});
  final List<MetaPreview> movies;
  final List<MetaPreview> series;

  bool get isEmpty => movies.isEmpty && series.isEmpty;
}

/// Pages fetched per batch and the per-bucket cap, ported from `service.tsx`.
const int kServicePageBatch = 5;
const int kServiceMaxPerBucket = 200;

List<MetaPreview> _dedupe(List<MetaPreview> metas) {
  final seen = <String>{};
  final out = <MetaPreview>[];
  for (final m in metas) {
    if (seen.add(m.id)) out.add(m);
  }
  return out;
}

Future<List<MetaPreview>> _fetchKind(
  TmdbClient client,
  String kind,
  String providerIds,
  String region,
  int page,
  List<int> genres,
) async {
  final params = <String, String>{
    'with_watch_providers': providerIds,
    'watch_region': region,
    'with_watch_monetization_types': 'flatrate|free|ads',
    'sort_by': 'popularity.desc',
    'include_adult': 'false',
    'page': '$page',
    if (genres.isNotEmpty) 'with_genres': genres.join(','),
  };
  final metas = await client.discover(kind, params);
  // The web keeps only poster-bearing results (poster == null iff no path).
  return metas.where((m) => m.poster != null).toList();
}

/// Fetches one batch (`kServicePageBatch` pages) of a service category, ported
/// 1:1 from `fetchCategoryBatch`: movie and series discover pages run in
/// parallel, poster-less results are dropped, and each list is de-duped by id.
Future<ServiceBucket> fetchServiceCategory(
  TmdbClient client, {
  required String providerIds,
  required String region,
  required ServiceCategory category,
  required int batch,
}) async {
  if (!client.hasKey) {
    return const ServiceBucket(movies: [], series: []);
  }
  final startPage = batch * kServicePageBatch + 1;
  final pages = [for (var i = 0; i < kServicePageBatch; i++) startPage + i];
  final results = await Future.wait([
    category.fetchMovies
        ? Future.wait(
            pages.map(
              (p) => _fetchKind(
                client,
                'movie',
                providerIds,
                region,
                p,
                category.movieGenres,
              ),
            ),
          )
        : Future.value(const <List<MetaPreview>>[]),
    category.fetchTv
        ? Future.wait(
            pages.map(
              (p) => _fetchKind(
                client,
                'tv',
                providerIds,
                region,
                p,
                category.tvGenres,
              ),
            ),
          )
        : Future.value(const <List<MetaPreview>>[]),
  ]);
  final movies = _dedupe(results[0].expand((e) => e).toList());
  final series = _dedupe(results[1].expand((e) => e).toList());
  return ServiceBucket(movies: movies, series: series);
}

/// Word-boundary patterns for the streaming-service catalog rows, ported 1:1
/// from the web `STREAMING_SERVICE_PATTERNS`. Word boundaries (not exact match)
/// so variant/partial titles — "Netflix Movies", "Disney+", "Apple TV+" — are
/// caught, exactly as web does.
final _streamingServicePatterns = <RegExp>[
  RegExp(r'\bnetflix\b'),
  RegExp(r'\bdisney\s*\+?\b'),
  RegExp(r'\bdisney\s*plus\b'),
  RegExp(r'\bhulu\b'),
  RegExp(r'\bprime\s*video\b'),
  RegExp(r'\bamazon\s*prime\b'),
  RegExp(r'\bapple\s*tv\s*\+?\b'),
  RegExp(r'\bappletv\b'),
  RegExp(r'\bhbo\s*max\b'),
  RegExp(r'\bmax\b'),
  RegExp(r'\bparamount\s*\+?\b'),
  RegExp(r'\bpeacock\b'),
  RegExp(r'\bstarz\b'),
  RegExp(r'\bshowtime\b'),
  RegExp(r'\bcrunchyroll\b'),
];

/// Whether [title] names a streaming-service catalog row. Those get the
/// dedicated Home streaming rail, so they are dropped from the Home addon rows
/// in curated (non-classic) mode. Ports web `isStreamingServiceRow`.
bool isStreamingServiceRowTitle(String title) {
  final t = title.toLowerCase();
  return _streamingServicePatterns.any((rx) => rx.hasMatch(t));
}
