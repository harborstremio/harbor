import 'tmdb.dart';

/// A streaming provider a title is available on, ported from `WatchProvider`.
class WatchProvider {
  const WatchProvider({
    required this.id,
    required this.name,
    required this.logo,
    required this.link,
  });
  final int id;
  final String name;
  final String logo;
  final String link;
}

/// The streaming providers a title is available on in a region, ported 1:1 from
/// `tmdbWatchProviders`: the region's flatrate + free + ads providers, ordered
/// by display priority, deduped, logo-required, capped at 8. Empty without a
/// key or numeric id.
Future<List<WatchProvider>> tmdbWatchProviders(
  TmdbClient client,
  String kind,
  int id,
  String region,
) async {
  if (!client.hasKey || id == 0) return const [];

  Map<String, dynamic>? data;
  try {
    data = await client.get('$kind/$id/watch/providers');
  } catch (_) {
    return const [];
  }
  final results = (data?['results'] as Map?)?.cast<String, dynamic>();
  if (results == null) return const [];

  final regionKey = (region.isNotEmpty ? region : 'US').toUpperCase();
  final r = (results[regionKey] ?? results['US']) as Map?;
  if (r == null) return const [];

  final link = (r['link'] ?? '').toString();
  final raw = <Map<String, dynamic>>[
    for (final key in const ['flatrate', 'free', 'ads'])
      ...((r[key] as List?) ?? const []).whereType<Map>().map(
        (e) => e.cast<String, dynamic>(),
      ),
  ];
  stableSort(
    raw,
    (a, b) => ((a['display_priority'] as num?)?.toInt() ?? 99).compareTo(
      (b['display_priority'] as num?)?.toInt() ?? 99,
    ),
  );

  final seen = <int>{};
  final out = <WatchProvider>[];
  for (final p in raw) {
    final pid = (p['provider_id'] as num?)?.toInt() ?? 0;
    final logoPath = p['logo_path'];
    if (seen.contains(pid) || logoPath == null) continue;
    seen.add(pid);
    out.add(
      WatchProvider(
        id: pid,
        name: (p['provider_name'] ?? '').toString(),
        logo: '$tmdbImg/original$logoPath',
        link: link,
      ),
    );
    if (out.length >= 8) break;
  }
  return out;
}
