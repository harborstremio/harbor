import '../../core/http/json_transport.dart';

/// One fanart.tv artwork item. Ported from `ArtItem`.
class _ArtItem {
  const _ArtItem({this.url, this.lang, this.likes});

  final String? url;
  final String? lang;
  final String? likes;

  static _ArtItem fromJson(Object? v) {
    if (v is! Map) return const _ArtItem();
    return _ArtItem(
      url: v['url'] as String?,
      lang: v['lang'] as String?,
      likes: v['likes']?.toString(),
    );
  }
}

/// A resolved set of fanart.tv artwork for a title. Ported from `FanartArt`.
class FanartArt {
  const FanartArt({
    this.logo,
    this.backdrop,
    required this.backdrops,
    this.poster,
    this.banner,
    this.thumb,
  });

  final String? logo;
  final String? backdrop;
  final List<String> backdrops;
  final String? poster;
  final String? banner;
  final String? thumb;
}

/// English-first artwork ranking: `en` beats the language-neutral `00` beats
/// everything else, then by descending likes. Ties keep the source order.
/// Ported from `rankItems`.
List<_ArtItem> _rankItems(Object? raw) {
  if (raw is! List || raw.isEmpty) return const [];
  final indexed = [
    for (var i = 0; i < raw.length; i++) (i, _ArtItem.fromJson(raw[i])),
  ];
  double langScore(_ArtItem a) => a.lang == 'en'
      ? 1
      : a.lang == '00'
      ? 0.5
      : 0;
  indexed.sort((a, b) {
    final al = langScore(a.$2);
    final bl = langScore(b.$2);
    if (al != bl) return bl.compareTo(al);
    final aLikes = num.tryParse(a.$2.likes ?? '0') ?? 0;
    final bLikes = num.tryParse(b.$2.likes ?? '0') ?? 0;
    if (aLikes != bLikes) return bLikes.compareTo(aLikes);
    return a.$1.compareTo(b.$1);
  });
  return [for (final e in indexed) e.$2];
}

String? _pickEnglish(Object? raw) {
  final ranked = _rankItems(raw);
  return ranked.isEmpty ? null : ranked.first.url;
}

List<String> _pickAll(Object? raw) => [
  for (final i in _rankItems(raw))
    if (i.url case final url?)
      if (url.isNotEmpty) url,
];

/// The fanart.tv artwork provider — English-ranked logos, backdrops, posters,
/// banners and thumbnails for a movie (by TMDB id) or show (by TVDB id). Ported
/// from `lib/providers/fanart.ts`. Requires the user's fanart.tv key; responses
/// are cached per URL for six hours.
class FanartClient {
  FanartClient(
    this._transport, {
    DateTime Function() clock = DateTime.now,
    this.ttl = const Duration(hours: 6),
  }) : _clock = clock;

  static const _base = 'https://webservice.fanart.tv/v3';

  final JsonTransport _transport;
  final DateTime Function() _clock;
  final Duration ttl;

  final Map<String, ({int t, Map<String, dynamic> v})> _cache = {};

  int get _now => _clock().millisecondsSinceEpoch;

  Future<Map<String, dynamic>?> _get(String key, String path) async {
    if (key.isEmpty) return null;
    final url = '$_base$path?api_key=${Uri.encodeQueryComponent(key)}';
    final hit = _cache[url];
    if (hit != null && _now - hit.t < ttl.inMilliseconds) return hit.v;
    try {
      final r = await _transport.getJson(url);
      if (!r.ok || r.data is! Map) return null;
      final j = (r.data as Map).cast<String, dynamic>();
      _cache[url] = (t: _now, v: j);
      return j;
    } catch (_) {
      return null;
    }
  }

  Future<FanartArt?> movie(String key, int tmdbId) async {
    final j = await _get(key, '/movies/$tmdbId');
    if (j == null) return null;
    final backdrops = _pickAll(j['moviebackground']);
    return FanartArt(
      logo: _pickEnglish(j['hdmovielogo']) ?? _pickEnglish(j['movielogo']),
      backdrop: backdrops.isEmpty ? null : backdrops.first,
      backdrops: backdrops,
      poster: _pickEnglish(j['movieposter']),
      banner: _pickEnglish(j['moviebanner']),
      thumb: _pickEnglish(j['moviethumb']),
    );
  }

  Future<FanartArt?> tv(String key, int tvdbId) async {
    final j = await _get(key, '/tv/$tvdbId');
    if (j == null) return null;
    final backdrops = _pickAll(j['showbackground']);
    return FanartArt(
      logo: _pickEnglish(j['hdtvlogo']) ?? _pickEnglish(j['clearlogo']),
      backdrop: backdrops.isEmpty ? null : backdrops.first,
      backdrops: backdrops,
      poster: _pickEnglish(j['tvposter']),
      banner: _pickEnglish(j['tvbanner']),
      thumb: _pickEnglish(j['tvthumb']),
    );
  }
}
