import 'tmdb.dart';
import 'tmdb_details.dart' show fetchMovieAssets;

/// A single TMDB user/critic review kept for the Discover critics-pick card.
class CriticReview {
  const CriticReview({
    required this.author,
    required this.content,
    this.rating,
    this.url,
    this.createdAt,
  });

  final String author;
  final String content;
  final double? rating;
  final String? url;
  final String? createdAt;
}

/// A cast entry for the critics-pick card.
class CriticCast {
  const CriticCast({
    required this.id,
    required this.name,
    required this.character,
    this.profilePath,
  });

  final int id;
  final String name;
  final String character;
  final String? profilePath;
}

/// A key-crew entry (director, writer, composer…) for the critics-pick card.
class CriticCrew {
  const CriticCrew({required this.id, required this.name, required this.job});

  final int id;
  final String name;
  final String job;
}

/// A minimal person reference (the director callout).
class CriticPerson {
  const CriticPerson({required this.id, required this.name});
  final int id;
  final String name;
}

/// The enriched TMDB data behind the Discover critics-pick spotlight — reviews,
/// cast, key crew, and metadata. Ported 1:1 from `CriticData` in tmdb-critic.ts.
class CriticData {
  const CriticData({
    required this.reviews,
    required this.cast,
    required this.crew,
    required this.genres,
    this.tagline,
    this.overview,
    this.director,
    this.runtime,
  });

  final String? tagline;
  final String? overview;
  final List<CriticReview> reviews;
  final List<CriticCast> cast;
  final List<CriticCrew> crew;
  final CriticPerson? director;
  final int? runtime;
  final List<String> genres;
}

/// The crew jobs surfaced on the critics-pick card. Ported from `CRITIC_KEY_JOBS`.
const _criticKeyJobs = {
  'Director',
  'Producer',
  'Executive Producer',
  'Screenplay',
  'Writer',
  'Story',
  'Original Music Composer',
  'Director of Photography',
};

/// The enriched critic data for [metaId] (a `tmdb:{movie,tv}:id` or `tt…` id;
/// [type] disambiguates the IMDb `find`). Fetches the title with credits +
/// reviews appended and shapes it, ported 1:1 from `tmdbCriticData`: reviews are
/// ≥120 chars, author-deduped, capped at six and sorted by rating; cast is the
/// first twenty; crew keeps the key jobs. Null without a key or on a miss.
Future<CriticData?> tmdbCriticData(
  TmdbClient client,
  String metaId,
  String type,
) async {
  if (!client.hasKey) return null;

  String kind;
  String id;
  if (metaId.startsWith('tmdb:movie:')) {
    kind = 'movie';
    id = metaId.substring('tmdb:movie:'.length);
  } else if (metaId.startsWith('tmdb:tv:')) {
    kind = 'tv';
    id = metaId.substring('tmdb:tv:'.length);
  } else if (metaId.startsWith('tt')) {
    final find = await client.get('find/$metaId', {
      'external_source': 'imdb_id',
    });
    final movieResults = (find?['movie_results'] as List?) ?? const [];
    final tvResults = (find?['tv_results'] as List?) ?? const [];
    if (type == 'movie' && movieResults.isNotEmpty) {
      kind = 'movie';
      id = '${(movieResults.first as Map)['id']}';
    } else if (type == 'series' && tvResults.isNotEmpty) {
      kind = 'tv';
      id = '${(tvResults.first as Map)['id']}';
    } else {
      return null;
    }
  } else {
    return null;
  }

  final raw = await client.get('$kind/$id', {
    'append_to_response': 'credits,reviews',
  });
  if (raw == null) return null;

  // Reviews: substantial (≥120 chars), one per author, at most six, best first.
  final rawReviews = ((raw['reviews'] as Map?)?['results'] as List?) ?? const [];
  final reviews = <CriticReview>[];
  final seenAuthors = <String>{};
  for (final r in rawReviews.whereType<Map>()) {
    final content = r['content'] is String ? (r['content'] as String).trim() : '';
    if (content.length < 120) continue;
    final ad = r['author_details'] as Map?;
    final author = (ad?['username'] ?? r['author'] ?? 'Anonymous').toString();
    if (!seenAuthors.add(author.toLowerCase())) continue;
    reviews.add(
      CriticReview(
        author: author,
        rating: ad?['rating'] is num ? (ad!['rating'] as num).toDouble() : null,
        content: content,
        url: r['url'] is String ? r['url'] as String : null,
        createdAt: r['created_at'] is String ? r['created_at'] as String : null,
      ),
    );
    if (reviews.length >= 6) break;
  }
  reviews.sort((a, b) => (b.rating ?? 0).compareTo(a.rating ?? 0));

  final credits = raw['credits'] as Map?;
  final cast = <CriticCast>[
    for (final c
        in ((credits?['cast'] as List?) ?? const []).whereType<Map>().take(20))
      CriticCast(
        id: (c['id'] as num?)?.toInt() ?? 0,
        name: '${c['name'] ?? ''}',
        character: '${c['character'] ?? ''}',
        profilePath: c['profile_path'] as String?,
      ),
  ];

  final crewRaw = ((credits?['crew'] as List?) ?? const []).whereType<Map>();
  final directorRaw = crewRaw.where((c) => c['job'] == 'Director');
  final director = directorRaw.isEmpty
      ? null
      : CriticPerson(
          id: (directorRaw.first['id'] as num?)?.toInt() ?? 0,
          name: '${directorRaw.first['name'] ?? ''}',
        );
  final seenCrew = <int>{};
  final crew = <CriticCrew>[];
  for (final c in crewRaw) {
    if (!_criticKeyJobs.contains(c['job'])) continue;
    final cid = (c['id'] as num?)?.toInt() ?? 0;
    if (!seenCrew.add(cid)) continue;
    crew.add(CriticCrew(id: cid, name: '${c['name'] ?? ''}', job: '${c['job']}'));
  }

  final episodeRun = raw['episode_run_time'] as List?;
  final runtime =
      (raw['runtime'] as num?)?.toInt() ??
      (episodeRun != null && episodeRun.isNotEmpty
          ? (episodeRun.first as num?)?.toInt()
          : null);
  final genres = [
    for (final g in ((raw['genres'] as List?) ?? const []).whereType<Map>())
      if (g['name'] is String && (g['name'] as String).isNotEmpty)
        g['name'] as String,
  ];

  final tagline = raw['tagline'];
  final overview = raw['overview'];
  return CriticData(
    tagline: tagline is String && tagline.trim().isNotEmpty
        ? tagline.trim()
        : null,
    overview: overview is String && overview.trim().isNotEmpty
        ? overview.trim()
        : null,
    reviews: reviews,
    cast: cast,
    crew: crew,
    director: director,
    runtime: runtime,
    genres: genres,
  );
}

/// The critics-pick backdrop stills for [metaId] — the title's backdrops at
/// w780, best-voted first, deduped and capped at twelve. Ported 1:1 from
/// `tmdbMovieImages`, reusing [fetchMovieAssets].
Future<List<String>> tmdbMovieStills(TmdbClient client, String metaId) async {
  final data = await fetchMovieAssets(client, metaId);
  final backdrops = ((data?['backdrops'] as List?) ?? const [])
      .whereType<Map>()
      .toList();
  backdrops.sort(
    (a, b) => ((b['vote_average'] as num?) ?? 0).compareTo(
      (a['vote_average'] as num?) ?? 0,
    ),
  );
  final seen = <String>{};
  final out = <String>[];
  for (final b in backdrops) {
    final path = b['file_path'] as String?;
    if (path == null || !seen.add(path)) continue;
    out.add('$tmdbImg/w780$path');
    if (out.length >= 12) break;
  }
  return out;
}
