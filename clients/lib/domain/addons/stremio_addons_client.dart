import '../../core/http/json_transport.dart';
import 'community_catalog.dart';
import 'models.dart';

const _apiBase = 'https://stremio-addons.net/api/v0';
const _site = 'https://stremio-addons.net';
const _cacheTtlMs = 60 * 60 * 1000;
const _maxCacheEntries = 48;

/// A stremio-addons.net category (`{ name, slug }`).
class SACategory {
  const SACategory({required this.name, required this.slug});

  final String name;
  final String slug;

  factory SACategory.fromJson(Map<String, dynamic> j) => SACategory(
    name: j['name']?.toString() ?? '',
    slug: j['slug']?.toString() ?? '',
  );
}

/// A stremio-addons.net addon record, ported 1:1 from `SAAddon`.
class SAAddon {
  const SAAddon({
    required this.uuid,
    required this.url,
    required this.manifestUrl,
    this.manifest,
    required this.slug,
    required this.stars,
    required this.categories,
    this.configureUrl,
    required this.createdAt,
    required this.updatedAt,
    this.documentation,
  });

  final String uuid;
  final String url;
  final String manifestUrl;
  final Manifest? manifest;
  final String slug;
  final num stars;
  final List<SACategory> categories;
  final String? configureUrl;
  final String createdAt;
  final String updatedAt;
  final String? documentation;

  static Manifest? _manifest(Object? m) =>
      m is Map ? Manifest(m.cast<String, dynamic>()) : null;

  static List<SACategory> _categories(Object? c) => c is List
      ? c
            .whereType<Map>()
            .map((e) => SACategory.fromJson(e.cast<String, dynamic>()))
            .toList()
      : const [];

  factory SAAddon.fromJson(Map<String, dynamic> j) => SAAddon(
    uuid: j['uuid']?.toString() ?? '',
    url: j['url']?.toString() ?? '',
    manifestUrl: j['manifestUrl']?.toString() ?? '',
    manifest: _manifest(j['manifest']),
    slug: j['slug']?.toString() ?? '',
    stars: j['stars'] is num ? j['stars'] as num : 0,
    categories: _categories(j['categories']),
    configureUrl: j['configureUrl']?.toString(),
    createdAt: j['createdAt']?.toString() ?? '',
    updatedAt: j['updatedAt']?.toString() ?? '',
    documentation: j['documentation']?.toString(),
  );
}

/// A single addon plus its alternate instances, ported from `SAAddonDetail`.
class SAAddonDetail extends SAAddon {
  const SAAddonDetail({
    required super.uuid,
    required super.url,
    required super.manifestUrl,
    super.manifest,
    required super.slug,
    required super.stars,
    required super.categories,
    super.configureUrl,
    required super.createdAt,
    required super.updatedAt,
    super.documentation,
    required this.instances,
  });

  final List<SAAddon> instances;

  factory SAAddonDetail.fromJson(Map<String, dynamic> j) {
    final base = SAAddon.fromJson(j);
    return SAAddonDetail.of(
      base,
      (j['instances'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => SAAddon.fromJson(e.cast<String, dynamic>()))
          .toList(),
    );
  }

  factory SAAddonDetail.of(SAAddon a, List<SAAddon> instances) => SAAddonDetail(
    uuid: a.uuid,
    url: a.url,
    manifestUrl: a.manifestUrl,
    manifest: a.manifest,
    slug: a.slug,
    stars: a.stars,
    categories: a.categories,
    configureUrl: a.configureUrl,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    documentation: a.documentation,
    instances: instances,
  );
}

/// An addon on the rising board plus its recent-star velocity, ported from
/// `SARisingAddon`.
class SARisingAddon extends SAAddon {
  const SARisingAddon({
    required super.uuid,
    required super.url,
    required super.manifestUrl,
    super.manifest,
    required super.slug,
    required super.stars,
    required super.categories,
    super.configureUrl,
    required super.createdAt,
    required super.updatedAt,
    super.documentation,
    required this.recentStars,
  });

  final num recentStars;

  factory SARisingAddon.fromJson(Map<String, dynamic> j) {
    final base = SAAddon.fromJson(j);
    return SARisingAddon(
      uuid: base.uuid,
      url: base.url,
      manifestUrl: base.manifestUrl,
      manifest: base.manifest,
      slug: base.slug,
      stars: base.stars,
      categories: base.categories,
      configureUrl: base.configureUrl,
      createdAt: base.createdAt,
      updatedAt: base.updatedAt,
      documentation: base.documentation,
      recentStars: j['recentStars'] is num ? j['recentStars'] as num : 0,
    );
  }
}

/// The `GET /addons` query parameters, ported from `ListParams`.
class ListParams {
  const ListParams({
    this.page,
    this.limit,
    this.search,
    this.nsfw,
    this.category = const [],
    this.sortBy,
    this.order,
    this.after,
  });

  final int? page;
  final int? limit;
  final String? search;

  /// `only` or `exclude`.
  final String? nsfw;
  final List<String> category;

  /// `createdAt` or `stars`.
  final String? sortBy;

  /// `asc` or `desc`.
  final String? order;
  final String? after;
}

/// A paginated addon list, ported from `ListResult`.
class ListResult {
  const ListResult({required this.addons, required this.pagination});

  final List<SAAddon> addons;
  final SAPagination pagination;

  factory ListResult.fromJson(Map<String, dynamic> j) => ListResult(
    addons: (j['addons'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => SAAddon.fromJson(e.cast<String, dynamic>()))
        .toList(),
    pagination: SAPagination.fromJson(
      (j['pagination'] as Map?)?.cast<String, dynamic>() ?? const {},
    ),
  );
}

class SAPagination {
  const SAPagination({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
    required this.hasNextPage,
    required this.hasPreviousPage,
  });

  final int page;
  final int limit;
  final int total;
  final int totalPages;
  final bool hasNextPage;
  final bool hasPreviousPage;

  factory SAPagination.fromJson(Map<String, dynamic> j) => SAPagination(
    page: (j['page'] as num?)?.toInt() ?? 1,
    limit: (j['limit'] as num?)?.toInt() ?? 0,
    total: (j['total'] as num?)?.toInt() ?? 0,
    totalPages: (j['totalPages'] as num?)?.toInt() ?? 1,
    hasNextPage: j['hasNextPage'] == true,
    hasPreviousPage: j['hasPreviousPage'] == true,
  );

  SAPagination copyWith({int? total}) => SAPagination(
    page: page,
    limit: limit,
    total: total ?? this.total,
    totalPages: totalPages,
    hasNextPage: hasNextPage,
    hasPreviousPage: hasPreviousPage,
  );
}

class _CacheEntry {
  const _CacheEntry(this.at, this.data);
  final int at;
  final Object? data;
}

class _Fallback {
  const _Fallback(this.at, this.addons);
  final int at;
  final List<SAAddon> addons;
}

/// The 16 categories the site exposes, ported from `DEFAULT_SA_CATEGORIES`.
const List<SACategory> kDefaultSaCategories = [
  SACategory(name: 'anime', slug: 'anime'),
  SACategory(name: 'asian drama', slug: 'asian+drama'),
  SACategory(name: 'bollywood', slug: 'bollywood'),
  SACategory(name: 'debrid support', slug: 'debrid+support'),
  SACategory(name: 'http streams', slug: 'http+streams'),
  SACategory(name: 'live tv', slug: 'live+tv'),
  SACategory(name: 'metadata', slug: 'metadata'),
  SACategory(name: 'misc', slug: 'misc'),
  SACategory(name: 'movies', slug: 'movies'),
  SACategory(name: 'music', slug: 'music'),
  SACategory(name: 'nsfw', slug: 'nsfw'),
  SACategory(name: 'radios', slug: 'radios'),
  SACategory(name: 'subtitles', slug: 'subtitles'),
  SACategory(name: 'torrents', slug: 'torrents'),
  SACategory(name: 'tv shows', slug: 'tv+shows'),
  SACategory(name: 'usenet', slug: 'usenet'),
];

/// The stremio-addons.net client — the community index the addon browse/discover
/// panes read, with a per-instance TTL cache and a Stremio-community fallback
/// when the site is unreachable. Ported 1:1 from `providers/stremio-addons.ts`.
class StremioAddonsClient {
  StremioAddonsClient(
    this._transport, {
    DateTime Function() clock = DateTime.now,
  }) : _clock = clock;

  final JsonTransport _transport;
  final DateTime Function() _clock;
  final Map<String, _CacheEntry> _cache = {};
  _Fallback? _fallback;

  int get _now => _clock().millisecondsSinceEpoch;

  T? _readCache<T>(String key) {
    final hit = _cache[key];
    if (hit == null) return null;
    if (_now - hit.at > _cacheTtlMs) {
      _cache.remove(key);
      return null;
    }
    return hit.data as T;
  }

  void _writeCache(String key, Object? data) {
    _cache.remove(key);
    _cache[key] = _CacheEntry(_now, data);
    while (_cache.length > _maxCacheEntries) {
      _cache.remove(_cache.keys.first);
    }
  }

  /// Clears the in-memory caches (the eviction hook the maintenance sweep runs).
  void evict() {
    _cache.clear();
    _fallback = null;
  }

  Future<dynamic> _get(String url) async {
    final res = await _transport.getJson(url);
    if (!res.ok) {
      throw TransportException('stremio-addons ${res.statusCode}');
    }
    return res.data;
  }

  static String buildQuery(ListParams p) {
    final parts = <String>[];
    void add(String k, String v) => parts.add(
      '${Uri.encodeQueryComponent(k)}=${Uri.encodeQueryComponent(v)}',
    );
    if (p.page != null && p.page != 0) add('page', '${p.page}');
    if (p.limit != null && p.limit != 0) add('limit', '${p.limit}');
    if (p.search != null && p.search!.isNotEmpty) add('search', p.search!);
    if (p.nsfw != null && p.nsfw!.isNotEmpty) add('nsfw', p.nsfw!);
    if (p.sortBy != null && p.sortBy!.isNotEmpty) add('sort_by', p.sortBy!);
    if (p.order != null && p.order!.isNotEmpty) add('order', p.order!);
    if (p.after != null && p.after!.isNotEmpty) add('after', p.after!);
    for (final c in p.category) {
      add('category', c);
    }
    return parts.join('&');
  }

  static String _slugifyId(String id) => id
      .toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
      .replaceAll(RegExp(r'^-+|-+$'), '');

  SAAddon _addonToSa(CommunityAddon a) {
    final id = a.manifest.id.isNotEmpty ? a.manifest.id : a.transportUrl;
    return SAAddon(
      uuid: id,
      url: a.transportUrl,
      manifestUrl: a.transportUrl,
      manifest: a.manifest,
      slug: _slugifyId(id),
      stars: 0,
      categories: const [],
      configureUrl: null,
      createdAt: '',
      updatedAt: '',
    );
  }

  Future<List<SAAddon>> _loadFallbackAddons() async {
    final cached = _fallback;
    if (cached != null && _now - cached.at < _cacheTtlMs) return cached.addons;
    List<CommunityAddon> community;
    try {
      community = await fetchCommunityAddons(_transport);
    } catch (_) {
      community = const [];
    }
    final addons = community.map(_addonToSa).toList();
    _fallback = _Fallback(_now, addons);
    return addons;
  }

  static bool _isAdult(SAAddon a) => a.manifest?.adult ?? false;

  static bool _matchesSearch(SAAddon a, String q) {
    final name = (a.manifest?.name ?? '').toLowerCase();
    final desc = (a.manifest?.description ?? '').toLowerCase();
    return name.contains(q) ||
        desc.contains(q) ||
        a.slug.toLowerCase().contains(q);
  }

  static bool _eligibleExtra(SAAddon a, ListParams p) {
    if (p.search != null && p.search!.isNotEmpty) {
      if (!_matchesSearch(a, p.search!.toLowerCase())) return false;
    }
    if (p.nsfw == 'exclude' && _isAdult(a)) return false;
    if (p.category.isNotEmpty) {
      if (p.category.contains('nsfw')) {
        if (!_isAdult(a)) return false;
      } else {
        return false;
      }
    }
    return true;
  }

  static ListResult _applyListParams(List<SAAddon> all, ListParams p) {
    var filtered = all;
    if (p.search != null && p.search!.isNotEmpty) {
      final q = p.search!.toLowerCase();
      filtered = filtered.where((a) => _matchesSearch(a, q)).toList();
    }
    if (p.nsfw == 'exclude') {
      filtered = filtered.where((a) => !_isAdult(a)).toList();
    }
    if (p.sortBy == 'createdAt') {
      filtered = [...filtered]
        ..sort((a, b) => a.createdAt.compareTo(b.createdAt) > 0 ? -1 : 1);
    }
    if (p.order == 'asc') filtered = filtered.reversed.toList();
    final page = p.page != null && p.page! > 1 ? p.page! : 1;
    final limit = p.limit != null && p.limit! > 1 ? p.limit! : 50;
    final total = filtered.length;
    final totalPages = (total / limit).ceil().clamp(1, 1 << 30);
    final start = (page - 1) * limit;
    final slice = filtered.skip(start < 0 ? 0 : start).take(limit).toList();
    return ListResult(
      addons: slice,
      pagination: SAPagination(
        page: page,
        limit: limit,
        total: total,
        totalPages: totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      ),
    );
  }

  /// Lists addons with the site API, merging in eligible community extras; on any
  /// failure it falls back to filtering the community catalog. Ported from
  /// `listAddons`.
  Future<ListResult> listAddons([
    ListParams params = const ListParams(),
  ]) async {
    final qs = buildQuery(params);
    final key = 'list:$qs';
    final hit = _readCache<ListResult>(key);
    if (hit != null) return hit;
    final url = qs.isNotEmpty ? '$_apiBase/addons?$qs' : '$_apiBase/addons';
    try {
      final data = await _get(url);
      final json = ListResult.fromJson((data as Map).cast<String, dynamic>());
      final community = await _loadFallbackAddons();
      final seen = {
        for (final a in json.addons)
          if (a.manifest != null && a.manifest!.id.isNotEmpty) a.manifest!.id,
      };
      final extras = community.where((a) {
        final id = a.manifest?.id;
        if (id == null || id.isEmpty || seen.contains(id)) return false;
        return _eligibleExtra(a, params);
      }).toList();
      final merged = ListResult(
        addons: [...json.addons, ...extras],
        pagination: json.pagination.copyWith(
          total: json.pagination.total + extras.length,
        ),
      );
      _writeCache(key, merged);
      return merged;
    } catch (_) {
      final all = await _loadFallbackAddons();
      final result = _applyListParams(all, params);
      _writeCache(key, result);
      return result;
    }
  }

  /// Fetches one addon's detail by uuid or slug, falling back to the community
  /// catalog. Ported from `getAddon`. Throws when nothing matches.
  Future<SAAddonDetail> getAddon(String uuidOrSlug) async {
    final key = 'addon:$uuidOrSlug';
    final hit = _readCache<SAAddonDetail>(key);
    if (hit != null) return hit;
    try {
      final data = await _get(
        '$_apiBase/addons/${Uri.encodeComponent(uuidOrSlug)}',
      );
      final json = SAAddonDetail.fromJson(
        (data as Map).cast<String, dynamic>(),
      );
      _writeCache(key, json);
      return json;
    } catch (e) {
      final all = await _loadFallbackAddons();
      SAAddon? match;
      for (final a in all) {
        if (a.slug == uuidOrSlug || a.uuid == uuidOrSlug) {
          match = a;
          break;
        }
      }
      if (match == null) {
        throw e is TransportException
            ? e
            : const TransportException('addon not found');
      }
      final detail = SAAddonDetail.of(match, const []);
      _writeCache(key, detail);
      return detail;
    }
  }

  /// The site categories, or an empty list on failure. Ported from
  /// `listCategories`.
  Future<List<SACategory>> listCategories() async {
    final hit = _readCache<List<SACategory>>('categories');
    if (hit != null && hit.isNotEmpty) return hit;
    try {
      final data = await _get('$_apiBase/categories');
      final cats = ((data as Map)['categories'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => SACategory.fromJson(e.cast<String, dynamic>()))
          .toList();
      if (cats.isNotEmpty) _writeCache('categories', cats);
      return cats;
    } catch (_) {
      return const [];
    }
  }

  /// The rising board. Ported from `listRising` — throws on failure (there is no
  /// fallback; the caller decides how to degrade).
  Future<List<SARisingAddon>> listRising() async {
    final hit = _readCache<List<SARisingAddon>>('rising');
    if (hit != null) return hit;
    final data = await _get('$_apiBase/rising');
    final addons = ((data as Map)['addons'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => SARisingAddon.fromJson(e.cast<String, dynamic>()))
        .where((a) => a.manifest != null)
        .toList();
    _writeCache('rising', addons);
    return addons;
  }
}

/// The rank (1-based) and recent-star velocity of an addon on the rising board,
/// or null when it is not present. Ported 1:1 from `risingEntryFor`.
({int rank, num recentStars})? risingEntryFor(
  List<SARisingAddon> list, {
  String? uuid,
  String? slug,
  String? manifestUrl,
}) {
  for (var i = 0; i < list.length; i++) {
    final r = list[i];
    if ((uuid != null && r.uuid == uuid) ||
        (slug != null && r.slug == slug) ||
        (manifestUrl != null && r.manifestUrl == manifestUrl)) {
      return (rank: i + 1, recentStars: r.recentStars);
    }
  }
  return null;
}

/// The addon's page on stremio-addons.net, ported from `addonSiteUrl`.
String addonSiteUrl(String slug) =>
    '$_site/addons/${Uri.encodeComponent(slug)}';

/// The addon's rate anchor on stremio-addons.net, ported from `rateOnSiteUrl`.
String rateOnSiteUrl(String slug) =>
    '$_site/addons/${Uri.encodeComponent(slug)}#rate';
