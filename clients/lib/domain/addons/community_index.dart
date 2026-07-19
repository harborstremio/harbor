import 'stremio_addons_client.dart';

const _indexTtlMs = 60 * 60 * 1000;
const _maxPages = 6;
const _pageSize = 100;

/// A community-index entry — the site metadata for one addon, keyed by manifest
/// id and slug. Ported 1:1 from `SACommunity`.
class SACommunity {
  const SACommunity({
    required this.uuid,
    required this.slug,
    required this.url,
    required this.stars,
    required this.categories,
    required this.createdAt,
    required this.updatedAt,
    this.manifestId,
    required this.manifestUrl,
    this.name,
    this.description,
    this.logo,
    this.background,
  });

  final String uuid;
  final String slug;
  final String url;
  final num stars;
  final List<SACategory> categories;
  final String createdAt;
  final String updatedAt;
  final String? manifestId;
  final String manifestUrl;
  final String? name;
  final String? description;
  final String? logo;
  final String? background;
}

/// The built index — lookups by manifest id and by slug, plus its freshness
/// timestamp and the reported total. Ported from the web `IndexState`.
class CommunityIndexState {
  const CommunityIndexState({
    required this.byManifestId,
    required this.bySlug,
    required this.fetchedAt,
    required this.totalAddons,
  });

  final Map<String, SACommunity> byManifestId;
  final Map<String, SACommunity> bySlug;
  final int fetchedAt;
  final int totalAddons;
}

SACommunity _buildEntry(SAAddon a) {
  final m = a.manifest;
  return SACommunity(
    uuid: a.uuid,
    slug: a.slug,
    url: a.url,
    stars: a.stars,
    categories: a.categories,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    manifestId: m?.id.isNotEmpty == true ? m!.id : null,
    manifestUrl: a.manifestUrl,
    name: m?.name,
    description: m?.description,
    logo: m?.logo,
    background: m?.background,
  );
}

/// The star/velocity index over the top community addons, paginated from the
/// stremio-addons.net client. Ported 1:1 from `stremio-addons-index.ts`; the
/// React subscriber layer is replaced by Riverpod in the provider seam.
class CommunityIndex {
  CommunityIndex(this._client, {DateTime Function() clock = DateTime.now})
    : _clock = clock;

  final StremioAddonsClient _client;
  final DateTime Function() _clock;

  CommunityIndexState? _cached;
  Future<CommunityIndexState>? _inflight;

  int get _now => _clock().millisecondsSinceEpoch;

  bool _fresh(CommunityIndexState s) => _now - s.fetchedAt < _indexTtlMs;

  /// The fresh cached index, or null when absent/stale.
  CommunityIndexState? getIndex() {
    final c = _cached;
    return c != null && _fresh(c) ? c : null;
  }

  /// The community entry for [manifestId], reading the cache directly (stale
  /// entries still resolve, matching the web `communityFor`).
  SACommunity? communityFor(String? manifestId) {
    if (manifestId == null || manifestId.isEmpty) return null;
    return _cached?.byManifestId[manifestId];
  }

  /// The community entry for [slug], ported from `communityBySlug`.
  SACommunity? communityBySlug(String slug) => _cached?.bySlug[slug];

  /// Ensures the index is built, de-duping concurrent builds and honoring the
  /// one-hour TTL. Ported from `ensureCommunityIndex` — rethrows on failure.
  Future<CommunityIndexState> ensureIndex() {
    final c = _cached;
    if (c != null && _fresh(c)) return Future.value(c);
    final existing = _inflight;
    if (existing != null) return existing;
    final future = _fetchIndex().then((s) {
      _cached = s;
      return s;
    });
    _inflight = future;
    future.whenComplete(() {
      if (identical(_inflight, future)) _inflight = null;
    });
    return future;
  }

  Future<CommunityIndexState> _fetchIndex() async {
    final byManifestId = <String, SACommunity>{};
    final bySlug = <String, SACommunity>{};
    var total = 0;
    for (var page = 1; page <= _maxPages; page++) {
      final res = await _client.listAddons(
        ListParams(
          page: page,
          limit: _pageSize,
          sortBy: 'stars',
          order: 'desc',
        ),
      );
      for (final a in res.addons) {
        if (a.createdAt.isEmpty) continue;
        final entry = _buildEntry(a);
        final mid = a.manifest?.id;
        if (mid != null && mid.isNotEmpty) byManifestId[mid] = entry;
        bySlug[a.slug] = entry;
      }
      total = res.pagination.total;
      if (!res.pagination.hasNextPage) break;
    }
    return CommunityIndexState(
      byManifestId: byManifestId,
      bySlug: bySlug,
      fetchedAt: _now,
      totalAddons: total,
    );
  }
}
