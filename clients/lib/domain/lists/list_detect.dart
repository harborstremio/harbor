import 'list_types.dart';

/// Detects which external list service a pasted URL or handle refers to and
/// extracts its opaque ref. Ported 1:1 from `detectSource` in
/// `src/lib/lists/detect.ts` — supports full URLs (mdblist / trakt / TMDB /
/// Letterboxd / IMDb / MyAnimeList) and a few bare shorthands (an IMDb `ls…`
/// id, a `user/list/slug` Letterboxd handle, a `user/slug` Trakt handle).
/// Returns null when nothing matches.
DetectResult? detectSource(String raw) {
  final input = _clean(raw);
  if (input.isEmpty) return null;
  final host = _host(input);
  if (host != null) return _detectUrl(input, host);
  return _detectBare(input);
}

String _clean(String input) => input.trim().replaceFirst(RegExp(r'^@'), '');

/// The URL host (lowercased, `www.` stripped), or null when [input] is not a
/// URL with a host — matching the web's `new URL()` throwing on bare input.
String? _host(String input) {
  final uri = Uri.tryParse(input);
  if (uri == null || uri.host.isEmpty) return null;
  return uri.host.replaceFirst(RegExp(r'^www\.'), '').toLowerCase();
}

String _path(String input) => Uri.tryParse(input)?.path ?? input;

bool _hostIs(String host, String domain) =>
    host == domain || host.endsWith('.$domain');

DetectResult? _detectUrl(String input, String host) {
  final p = _path(input);
  if (_hostIs(host, 'mdblist.com')) {
    final m = RegExp(
      r'/lists/([^/?#]+)/([^/?#]+)',
      caseSensitive: false,
    ).firstMatch(p);
    if (m != null) {
      return DetectResult(ListSource.mdblist, '${m[1]}/${m[2]}');
    }
    final id = RegExp(r'/lists/(\d+)', caseSensitive: false).firstMatch(p);
    if (id != null) return DetectResult(ListSource.mdblist, id[1]!);
    return null;
  }
  if (_hostIs(host, 'trakt.tv')) {
    final m = RegExp(
      r'/users/([^/?#]+)/lists/([^/?#]+)',
      caseSensitive: false,
    ).firstMatch(p);
    if (m != null) return DetectResult(ListSource.trakt, '${m[1]}/${m[2]}');
    return null;
  }
  if (_hostIs(host, 'themoviedb.org')) {
    final m = RegExp(r'/list/(\d+)', caseSensitive: false).firstMatch(p);
    if (m != null) return DetectResult(ListSource.tmdb, m[1]!);
    return null;
  }
  if (_hostIs(host, 'letterboxd.com')) {
    final list = RegExp(
      r'/([^/?#]+)/list/([^/?#]+)',
      caseSensitive: false,
    ).firstMatch(p);
    if (list != null) {
      final slug = list[2]!.replaceFirst(RegExp(r'/$'), '');
      return DetectResult(ListSource.letterboxd, '${list[1]}/list/$slug');
    }
    final watch = RegExp(
      r'/([^/?#]+)/watchlist',
      caseSensitive: false,
    ).firstMatch(p);
    if (watch != null) {
      return DetectResult(ListSource.letterboxd, '${watch[1]}/watchlist');
    }
    return null;
  }
  if (_hostIs(host, 'imdb.com')) {
    final ls = RegExp(r'/list/(ls\d+)', caseSensitive: false).firstMatch(p);
    if (ls != null) return DetectResult(ListSource.imdb, ls[1]!);
    final user = RegExp(
      r'/user/(ur\d+)/watchlist',
      caseSensitive: false,
    ).firstMatch(p);
    if (user != null) return DetectResult(ListSource.imdb, user[1]!);
    return null;
  }
  if (_hostIs(host, 'myanimelist.net')) {
    final profile = RegExp(
      r'/(?:profile|animelist)/([^/?#]+)',
      caseSensitive: false,
    ).firstMatch(p);
    if (profile != null) return DetectResult(ListSource.mal, profile[1]!);
    return null;
  }
  return null;
}

DetectResult? _detectBare(String input) {
  if (RegExp(r'^ls\d{4,}$', caseSensitive: false).hasMatch(input)) {
    return DetectResult(ListSource.imdb, input.toLowerCase());
  }
  if (RegExp(r'^[^/]+/list/[^/]+$', caseSensitive: false).hasMatch(input)) {
    return DetectResult(
      ListSource.letterboxd,
      input.replaceFirst(RegExp(r'/$'), ''),
    );
  }
  if (RegExp(r'^[^/\s]+/[^/\s]+$').hasMatch(input)) {
    return DetectResult(ListSource.trakt, input);
  }
  return null;
}
