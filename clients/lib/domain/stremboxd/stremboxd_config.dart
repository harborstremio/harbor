import 'dart:convert';

/// The Stremboxd backend that bridges Letterboxd into Stremio catalogs. The
/// encoded config is placed in the URL path:
/// `{stremboxdBase}/{encodedConfig}/manifest.json`. Ported from the web
/// `stremboxd/config.ts`.
const stremboxdBase = 'https://api.stremboxd.com';

/// The public-mode catalog toggles (`c`). `popular` and `top250` are always
/// present; `watchlist` and `likedFilms` gate on a username being set.
class StremboxdCatalogs {
  const StremboxdCatalogs({
    required this.popular,
    required this.top250,
    this.watchlist,
    this.likedFilms,
  });

  final bool popular;
  final bool top250;
  final bool? watchlist;
  final bool? likedFilms;

  Map<String, dynamic> toJson() => {
    if (watchlist != null) 'watchlist': watchlist,
    'popular': popular,
    'top250': top250,
    if (likedFilms != null) 'likedFilms': likedFilms,
  };

  static StremboxdCatalogs fromJson(Map raw) => StremboxdCatalogs(
    popular: raw['popular'] == true,
    top250: raw['top250'] == true,
    watchlist: raw['watchlist'] is bool ? raw['watchlist'] as bool : null,
    likedFilms: raw['likedFilms'] is bool ? raw['likedFilms'] as bool : null,
  );
}

/// The public-mode Stremboxd config. Ported 1:1 from `StremboxdPublicConfig` —
/// the short field names (`u/c/l/r` plus the advanced knobs) are part of the
/// wire format the backend decodes, so they must not change. Advanced knobs the
/// clientv2 panel does not set (`n/w/o/s/f/h/q`) are carried through [extras] so
/// an externally-generated config round-trips losslessly.
class StremboxdPublicConfig {
  const StremboxdPublicConfig({
    this.username,
    required this.catalogs,
    this.listIds = const [],
    this.ratings = false,
    this.extras = const {},
  });

  final String? username;
  final StremboxdCatalogs catalogs;
  final List<String> listIds;
  final bool ratings;
  final Map<String, dynamic> extras;

  Map<String, dynamic> toJson() => {
    if (username != null && username!.isNotEmpty) 'u': username,
    'c': catalogs.toJson(),
    'l': listIds,
    'r': ratings,
    ...extras,
  };

  static StremboxdPublicConfig? fromJson(Object? raw) {
    if (raw is! Map || raw['c'] is! Map || raw['l'] is! List) return null;
    const known = {'u', 'c', 'l', 'r'};
    return StremboxdPublicConfig(
      username: raw['u'] is String ? raw['u'] as String : null,
      catalogs: StremboxdCatalogs.fromJson(raw['c'] as Map),
      listIds: (raw['l'] as List).whereType<String>().toList(),
      ratings: raw['r'] == true,
      extras: {
        for (final e in raw.entries)
          if (!known.contains(e.key)) e.key.toString(): e.value,
      },
    );
  }
}

/// Encodes a config to the URL-path segment (base64url, no padding). Ported from
/// `encodeStremboxdConfig`.
String encodeStremboxdConfig(StremboxdPublicConfig config) {
  final json = jsonEncode(config.toJson());
  return base64Url.encode(utf8.encode(json)).replaceAll('=', '');
}

/// Decodes a URL-path segment back to a config, or null when malformed. Ported
/// from `decodeStremboxdConfig`.
StremboxdPublicConfig? decodeStremboxdConfig(String encoded) {
  try {
    final padded = encoded.padRight((encoded.length + 3) & ~3, '=');
    final json = utf8.decode(base64Url.decode(padded));
    return StremboxdPublicConfig.fromJson(jsonDecode(json));
  } catch (_) {
    return null;
  }
}

/// The manifest URL for a public-mode [config].
String stremboxdManifestUrl(StremboxdPublicConfig config) =>
    '$stremboxdBase/${encodeStremboxdConfig(config)}/manifest.json';
