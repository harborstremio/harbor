import '../addons/models.dart';
import '../anilist/anilist_client.dart';

const _countryByMalQuery = r'''
query ($ids: [Int]) {
  Page(page: 1, perPage: 50) {
    media(idMal_in: $ids, type: ANIME) { idMal countryOfOrigin }
  }
}
''';

/// Session cache of MAL id → country of origin, so a repeated title never
/// re-queries AniList. Ported from web `malCountryCache`.
final Map<int, String> _malCountryCache = {};

/// The MAL id of an anime meta from its `mal:<id>` id, else 0. Ported from
/// `malIdOf`.
int animeMalId(MetaPreview m) {
  final id = m.id;
  if (id.startsWith('mal:')) return int.tryParse(id.substring(4)) ?? 0;
  return 0;
}

/// The country of origin for each MAL id, batched (50 per query) through the
/// public AniList API and cached. Ported 1:1 from `anilistCountriesByMalIds`.
Future<Map<int, String>> anilistCountriesByMalIds(
  AnilistClient client,
  List<int> malIds,
) async {
  final out = <int, String>{};
  final need = <int>[];
  for (final n in malIds.toSet()) {
    if (n <= 0) continue;
    final cached = _malCountryCache[n];
    if (cached != null) {
      out[n] = cached;
    } else {
      need.add(n);
    }
  }
  for (var i = 0; i < need.length; i += 50) {
    final batch = need.sublist(i, (i + 50).clamp(0, need.length));
    try {
      final data = await client.request(
        _countryByMalQuery,
        variables: {'ids': batch},
        skipAuth: true,
      );
      final media = ((data?['Page'] as Map?)?['media'] as List?) ?? const [];
      for (final m in media.whereType<Map>()) {
        final idMal = (m['idMal'] as num?)?.toInt();
        final country = m['countryOfOrigin'] as String?;
        if (idMal != null && country != null && country.isNotEmpty) {
          _malCountryCache[idMal] = country;
          out[idMal] = country;
        }
      }
    } catch (_) {
      // AniList errors are non-fatal — the origin filter just can't fire.
    }
  }
  return out;
}

/// Fills in the country of origin (via AniList) for anime metas that lack one,
/// so the origin filter can act on them. Ported 1:1 from `enrichAnimeCountry`.
Future<List<MetaPreview>> enrichAnimeCountry(
  AnilistClient client,
  List<MetaPreview> metas,
) async {
  final need = [
    for (final m in metas)
      if (m.country == null) animeMalId(m),
  ]..removeWhere((n) => n <= 0);
  if (need.isEmpty) return metas;
  final map = await anilistCountriesByMalIds(client, need);
  if (map.isEmpty) return metas;
  return [
    for (final m in metas)
      if (m.country != null)
        m
      else
        _withCountry(m, map[animeMalId(m)]),
  ];
}

MetaPreview _withCountry(MetaPreview m, String? country) => country == null
    ? m
    : MetaPreview.fromJson({...m.json, 'country': country});
