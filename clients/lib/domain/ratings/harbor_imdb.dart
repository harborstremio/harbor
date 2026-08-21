import 'package:meta/meta.dart';

import '../../core/http/json_transport.dart';

const String _harborImdbBase = 'https://harbor.site/api/imdb';

/// A parental-guide category and its severity. Ported from `ParentalCategory`.
class ParentalCategory {
  const ParentalCategory({required this.category, required this.severity});

  final String category;
  final String severity;
}

// Permanent in-process caches — a title's ratings and parental guide don't
// change within a session — plus in-flight de-duplication. Ported 1:1 from the
// module-level maps in `harbor-imdb.ts`.
final Map<String, double?> _titleCache = {};
final Map<String, Map<String, double>> _episodeCache = {};
final Map<String, Future<Map<String, double>>> _episodeInflight = {};
final Map<String, List<ParentalCategory>> _parentalCache = {};
final Map<String, Future<List<ParentalCategory>>> _parentalInflight = {};

/// Clears the process-wide Harbor IMDb caches. For tests only, so cached
/// lookups from one case do not leak into the next.
@visibleForTesting
void resetHarborImdbCache() {
  _titleCache.clear();
  _episodeCache.clear();
  _episodeInflight.clear();
  _parentalCache.clear();
  _parentalInflight.clear();
}

double? _finitePositive(Object? raw) {
  final v = raw is num
      ? raw.toDouble()
      : (raw is String ? double.tryParse(raw) : null);
  return (v != null && v.isFinite && v > 0) ? v : null;
}

/// Fetches the fresh IMDb rating for a `tt…` title from the Harbor IMDb service,
/// ported 1:1 from `harborImdbTitle`: the numeric `rating` when finite and
/// positive, else null. Null for non-`tt` ids or any transport failure. This is
/// the highest-priority source for the detail hero's primary IMDb rating. The
/// result (including a cached null) is remembered; a network error is not
/// cached, so a later call retries.
Future<double?> harborImdbTitle(JsonTransport transport, String tt) async {
  if (!tt.startsWith('tt')) return null;
  if (_titleCache.containsKey(tt)) return _titleCache[tt];
  try {
    final res = await transport.getJson('$_harborImdbBase/title/$tt');
    if (!res.ok) {
      _titleCache[tt] = null;
      return null;
    }
    final data = res.data;
    final out = _finitePositive(data is Map ? data['rating'] : null);
    _titleCache[tt] = out;
    return out;
  } catch (_) {
    return null;
  }
}

/// Fetches fresh per-episode IMDb ratings for a series, ported 1:1 from
/// `harborImdbEpisodes`: a map keyed `"season:episode"` of finite positive
/// ratings. Empty for non-`tt` ids or any transport failure. The result is
/// cached for the session and concurrent identical requests are shared.
Future<Map<String, double>> harborImdbEpisodes(
  JsonTransport transport,
  String seriesTt,
) {
  if (!seriesTt.startsWith('tt')) return Future.value(const {});
  final cached = _episodeCache[seriesTt];
  if (cached != null) return Future.value(cached);
  final pending = _episodeInflight[seriesTt];
  if (pending != null) return pending;
  final p = _fetchEpisodes(transport, seriesTt);
  _episodeInflight[seriesTt] = p;
  // Statement body, not an arrow — an arrow would return the removed future and
  // have it await itself.
  return p.whenComplete(() {
    _episodeInflight.remove(seriesTt);
  });
}

Future<Map<String, double>> _fetchEpisodes(
  JsonTransport transport,
  String seriesTt,
) async {
  try {
    final res = await transport.getJson('$_harborImdbBase/episodes/$seriesTt');
    final out = <String, double>{};
    if (res.ok && res.data is Map) {
      final ratings = (res.data as Map)['ratings'];
      if (ratings is Map) {
        ratings.forEach((k, raw) {
          final v = _finitePositive(raw);
          if (v != null) out['$k'] = v;
        });
      }
    }
    _episodeCache[seriesTt] = out;
    return out;
  } catch (_) {
    final empty = <String, double>{};
    _episodeCache[seriesTt] = empty;
    return empty;
  }
}

/// The cached per-episode ratings for a series, if already fetched — a
/// synchronous read of the episode cache. Ported from `harborImdbEpisodesCached`.
Map<String, double>? harborImdbEpisodesCached(String seriesTt) =>
    _episodeCache[seriesTt];

/// Fetches the parental-guide categories for a `tt…` title, ported 1:1 from
/// `harborImdbParental`: each category with its severity. Empty for non-`tt`
/// ids or any transport failure. Cached for the session with in-flight
/// de-duplication.
Future<List<ParentalCategory>> harborImdbParental(
  JsonTransport transport,
  String tt,
) {
  if (!tt.startsWith('tt')) return Future.value(const []);
  final cached = _parentalCache[tt];
  if (cached != null) return Future.value(cached);
  final pending = _parentalInflight[tt];
  if (pending != null) return pending;
  final p = _fetchParental(transport, tt);
  _parentalInflight[tt] = p;
  return p.whenComplete(() {
    _parentalInflight.remove(tt);
  });
}

Future<List<ParentalCategory>> _fetchParental(
  JsonTransport transport,
  String tt,
) async {
  try {
    final res = await transport.getJson('$_harborImdbBase/parental/$tt');
    final out = <ParentalCategory>[];
    if (res.ok && res.data is Map) {
      final cats = (res.data as Map)['categories'];
      if (cats is List) {
        for (final c in cats) {
          if (c is Map && c['category'] is String && c['severity'] is String) {
            out.add(
              ParentalCategory(
                category: c['category'] as String,
                severity: c['severity'] as String,
              ),
            );
          }
        }
      }
    }
    _parentalCache[tt] = out;
    return out;
  } catch (_) {
    _parentalCache[tt] = const [];
    return const [];
  }
}
