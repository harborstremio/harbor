import '../../core/http/json_transport.dart';

const _base = 'https://api.tvmaze.com';

/// A TVmaze show (keyless series fallback). Ported from `TvmazeShow`.
class TvmazeShow {
  const TvmazeShow({
    required this.id,
    required this.name,
    this.image,
    required this.isAnime,
  });

  final int id;
  final String name;
  final String? image;
  final bool isAnime;
}

/// A TVmaze episode. Ported from `TvmazeEpisode`.
class TvmazeEpisode {
  const TvmazeEpisode({
    required this.season,
    required this.number,
    required this.name,
    required this.airdate,
    this.image,
    this.summary = '',
  });

  final int season;
  final int number;
  final String name;
  final String airdate;
  final String? image;
  final String summary;
}

String? _image(Object? raw) {
  if (raw is! Map) return null;
  final original = raw['original'];
  if (original is String && original.isNotEmpty) return original;
  final medium = raw['medium'];
  return medium is String && medium.isNotEmpty ? medium : null;
}

String _stripHtml(Object? s) =>
    (s ?? '').toString().replaceAll(RegExp('<[^>]*>'), '').trim();

String _d10(Object? v) {
  final s = (v ?? '').toString();
  return s.length >= 10 ? s.substring(0, 10) : s;
}

/// Looks a show up by IMDb id (`/lookup/shows?imdb=`). Null when not found.
/// Ports `tvmazeShow`.
Future<TvmazeShow?> tvmazeShow(JsonTransport t, String imdb) async {
  try {
    final res = await t.getJson(
      '$_base/lookup/shows?imdb=${Uri.encodeQueryComponent(imdb)}',
    );
    if (!res.ok || res.data is! Map) return null;
    final raw = res.data as Map;
    final id = raw['id'];
    if (id is! num) return null;
    final genres = (raw['genres'] as List?) ?? const [];
    return TvmazeShow(
      id: id.toInt(),
      name: (raw['name'] ?? '').toString(),
      image: _image(raw['image']),
      isAnime: genres.any((g) => g.toString().toLowerCase() == 'anime'),
    );
  } on TransportException {
    return null;
  }
}

/// A show's episodes (`/shows/<id>/episodes`), dated only. Ports
/// `tvmazeEpisodes`.
Future<List<TvmazeEpisode>> tvmazeEpisodes(JsonTransport t, int showId) async {
  try {
    final res = await t.getJson('$_base/shows/$showId/episodes');
    if (!res.ok || res.data is! List) return const [];
    return [
      for (final e in res.data as List)
        if (e is Map && e['airdate'] != null && '${e['airdate']}'.isNotEmpty)
          TvmazeEpisode(
            season: (e['season'] as num?)?.toInt() ?? 0,
            number: (e['number'] as num?)?.toInt() ?? 0,
            name: (e['name'] ?? '').toString(),
            airdate: _d10(e['airdate']),
            image: _image(e['image']),
            summary: _stripHtml(e['summary']),
          ),
    ];
  } on TransportException {
    return const [];
  }
}

/// The show plus its episodes airing within [inWindow]. Ports `tvmazeUpcoming`.
Future<({TvmazeShow show, List<TvmazeEpisode> episodes})?> tvmazeUpcoming(
  JsonTransport t,
  String imdb,
  bool Function(String airdate) inWindow,
) async {
  final show = await tvmazeShow(t, imdb);
  if (show == null) return null;
  final eps = await tvmazeEpisodes(t, show.id);
  return (
    show: show,
    episodes: [
      for (final e in eps)
        if (inWindow(e.airdate)) e,
    ],
  );
}
