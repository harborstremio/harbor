import '../addons/models.dart';
import '../catalog/catalog_row.dart';
import 'stremboxd_client.dart';

/// The user-facing Letterboxd catalog ids, in panel order. Ported from the web
/// `LETTERBOXD_CATALOG_IDS`.
const letterboxdCatalogIds = <String>[
  'letterboxd-watchlist',
  'letterboxd-diary',
  'letterboxd-liked',
  'letterboxd-friends',
  'letterboxd-recommended',
  'letterboxd-popular',
  'letterboxd-top250',
];

/// Catalogs the public config can't produce — they need a full-mode sign-in.
const _fullOnlyCatalogIds = <String>{
  'letterboxd-diary',
  'letterboxd-friends',
  'letterboxd-recommended',
};

/// The full-mode backend id for liked films differs from the public toggle id.
const _publicToFullId = <String, String>{
  'letterboxd-liked': 'letterboxd-liked-films',
};

String _resolveCatalogId(String id, bool useFull) =>
    useFull ? (_publicToFullId[id] ?? id) : id;

const _priority = <String, int>{
  'letterboxd-watchlist': 0,
  'letterboxd-diary': 1,
  'letterboxd-liked': 2,
  'letterboxd-liked-films': 2,
  'letterboxd-friends': 3,
  'letterboxd-recommended': 4,
  'letterboxd-popular': 5,
  'letterboxd-top250': 6,
};

const _defaultNames = <String, String>{
  'letterboxd-watchlist': 'Letterboxd Watchlist',
  'letterboxd-diary': 'Recent Diary',
  'letterboxd-liked': 'Liked Films',
  'letterboxd-liked-films': 'Liked Films',
  'letterboxd-friends': "Friends' Activity",
  'letterboxd-recommended': 'Recommended for You',
  'letterboxd-popular': 'Popular This Week',
  'letterboxd-top250': 'Top 250 Narrative Features',
};

const _fullNameTemplates = <String, String>{
  'letterboxd-watchlist': "{name}'s Watchlist",
  'letterboxd-diary': "{name}'s Recent Diary",
  'letterboxd-liked': "{name}'s Liked Films",
  'letterboxd-liked-films': "{name}'s Liked Films",
  'letterboxd-friends': "{name}'s Friends Activity",
  'letterboxd-recommended': 'Recommended for {name}',
  'letterboxd-popular': 'Popular This Week',
  'letterboxd-top250': 'Top 250 Narrative Features',
};

const _minRowMetas = 4;

/// Builds the Letterboxd home rows from a validated config (and optional
/// full-mode [session]). A 1:1 port of the web `buildLetterboxdHomeRows`:
/// honours hidden catalogs and explicit order, fetches each catalog (the
/// authenticated full-mode endpoint when signed in — it also sees the private
/// watchlist and liked films), drops rows with fewer than [_minRowMetas] metas,
/// and names each row from the manifest with template/default fallbacks.
Future<List<CatalogRow>> buildLetterboxdHomeRows({
  required StremboxdClient client,
  required String configSegment,
  required List<String> selectedCatalogs,
  List<String> hiddenCatalogs = const [],
  List<String> catalogOrder = const [],
  LetterboxdSession? session,
  List<LetterboxdListRef> listRefs = const [],
}) async {
  if (selectedCatalogs.isEmpty) return const [];
  final hidden = hiddenCatalogs.toSet();
  final visible = selectedCatalogs.where((id) => !hidden.contains(id)).toList();
  if (visible.isEmpty) return const [];

  final s = session;
  final useFull = s != null;

  var manifestNames = <String, String>{};
  try {
    manifestNames = useFull
        ? await client.fetchFullManifestNames(s.userId)
        : await client.fetchManifestNames(configSegment);
  } catch (_) {
    /* fall back to template/default names */
  }

  final displayName = (s?.displayName?.isNotEmpty ?? false)
      ? s!.displayName!
      : (s?.username ?? '');
  String fallbackName(String catalogId, String realId) {
    final tpl = _fullNameTemplates[realId];
    if (s != null && tpl != null) return tpl.replaceAll('{name}', displayName);
    return _defaultNames[catalogId] ?? _defaultNames[realId] ?? catalogId;
  }

  final orderMap = <String, int>{};
  for (var i = 0; i < catalogOrder.length; i++) {
    orderMap[catalogOrder[i]] = i;
  }
  final ordered = [...visible]
    ..sort((a, b) {
      final pa = orderMap.containsKey(a)
          ? orderMap[a]!
          : (_priority[a] ?? 99) + 1000;
      final pb = orderMap.containsKey(b)
          ? orderMap[b]!
          : (_priority[b] ?? 99) + 1000;
      if (pa != pb) return pa.compareTo(pb);
      return a.compareTo(b);
    });

  final rows = <CatalogRow>[];
  for (final catalogId in ordered) {
    if (_fullOnlyCatalogIds.contains(catalogId) && s == null) continue;
    final realCatalogId = _resolveCatalogId(catalogId, useFull);

    List<MetaPreview> metas;
    try {
      metas = s != null
          ? await client.fetchFullCatalog(s.userId, realCatalogId)
          : await client.fetchCatalog(configSegment, realCatalogId);
    } catch (_) {
      continue;
    }
    if (metas.length < _minRowMetas) continue;

    final manifestName = manifestNames[realCatalogId];
    LetterboxdListRef? listRef;
    for (final r in listRefs) {
      if ('letterboxd-list-${r.id}' == catalogId) listRef = r;
    }
    final String name;
    if (manifestName != null && manifestName.isNotEmpty) {
      name = manifestName;
    } else if (listRef != null) {
      final owner = (listRef.owner?.isNotEmpty ?? false)
          ? ' · ${listRef.owner}'
          : '';
      name = '${listRef.name}$owner';
    } else {
      name = fallbackName(catalogId, realCatalogId);
    }

    rows.add(
      CatalogRow(
        title: name,
        type: 'movie',
        id: realCatalogId,
        items: metas,
        key: 'letterboxd-$catalogId',
        noDedup: true,
      ),
    );
  }
  return rows;
}
