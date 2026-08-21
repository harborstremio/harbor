import '../addons/models.dart';
import 'anilist_client.dart';

String _stripHtml(String s) => s
    .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), ' ')
    .replaceAll(RegExp(r'<[^>]+>'), '')
    .replaceAll(RegExp(r'\s+'), ' ')
    .trim();

/// Maps an AniList `Media` node to a Harbor meta. Ported 1:1 from
/// `anilistMediaToMeta` — MAL id preferred for the id, English/user/romaji
/// title, cover→poster, banner→background, score/10 as the rating.
MetaPreview? anilistMediaToMeta(Map media) {
  final title = (media['title'] as Map?) ?? const {};
  final name =
      (title['english'] ?? title['userPreferred'] ?? title['romaji'])
          as String?;
  if (name == null || name.isEmpty) return null;
  final idMal = (media['idMal'] as num?)?.toInt();
  final id = idMal != null ? 'mal:$idMal' : 'anilist:${media['id']}';
  final cover = (media['coverImage'] as Map?) ?? const {};
  final poster = (cover['extraLarge'] ?? cover['large']) as String?;
  final desc = media['description'] as String?;
  final year = (media['seasonYear'] as num?)?.toInt();
  final avg = media['averageScore'] as num?;
  return MetaPreview.fromJson({
    'id': id,
    'type': media['format'] == 'MOVIE' ? 'movie' : 'series',
    'name': name,
    'poster': ?poster,
    if (media['bannerImage'] != null) 'background': media['bannerImage'],
    if (desc != null && desc.isNotEmpty) 'description': _stripHtml(desc),
    if (year != null) 'releaseInfo': '$year',
    if (avg != null) 'imdbRating': (avg / 10).toStringAsFixed(1),
    if (media['countryOfOrigin'] != null) 'country': media['countryOfOrigin'],
  });
}

const _browseQuery = r'''
query ($page: Int, $perPage: Int, $sort: [MediaSort], $isAdult: Boolean) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, sort: $sort, isAdult: $isAdult) {
      id
      idMal
      title { romaji english native userPreferred }
      coverImage { extraLarge large medium }
      bannerImage
      format
      episodes
      averageScore
      seasonYear
      countryOfOrigin
      description
    }
  }
}
''';

/// The public AniList anime browse for a [sort], paged (50/page) to [count],
/// deduped. Ported 1:1 from `fetchAnilistBrowse`.
Future<List<MetaPreview>> fetchAnilistBrowse(
  AnilistClient client,
  String sort,
  int count,
) async {
  final perPage = count < 50 ? count : 50;
  final pages = (count / perPage).ceil();
  final responses = await Future.wait([
    for (var i = 0; i < pages; i++)
      client
          .request(
            _browseQuery,
            variables: {
              'page': i + 1,
              'perPage': perPage,
              'sort': [sort],
              'isAdult': false,
            },
            skipAuth: true,
          )
          .then<Map<String, dynamic>?>((v) => v)
          .catchError((_) => null),
  ]);
  final out = <MetaPreview>[];
  final seen = <String>{};
  for (final data in responses) {
    final media = ((data?['Page'] as Map?)?['media'] as List?) ?? const [];
    for (final m in media.whereType<Map>()) {
      final meta = anilistMediaToMeta(m);
      if (meta == null || !seen.add(meta.id)) continue;
      out.add(meta);
    }
  }
  return out.take(count).toList();
}

Future<List<MetaPreview>> fetchAnilistTopAnime(
  AnilistClient client, [
  int count = 100,
]) => fetchAnilistBrowse(client, 'SCORE_DESC', count);

Future<List<MetaPreview>> fetchAnilistTrendingAnime(
  AnilistClient client, [
  int count = 40,
]) => fetchAnilistBrowse(client, 'TRENDING_DESC', count);
