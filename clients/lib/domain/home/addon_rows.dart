import '../catalog/catalog_row.dart';

/// Type-noise words stripped before comparing catalog names, ported from web
/// `STRIP_WORDS` (`lib/addons.ts`). So "Popular Movies" and "Popular" collapse to
/// the same key for a given type.
const _stripWords = [
  'movies',
  'movie',
  'series',
  'shows',
  'show',
  'tv shows',
  'tv',
];

/// A comparison key for a catalog row: lowercased, type-noise words removed,
/// non-alphanumerics squashed, suffixed with the type. Ported 1:1 from web
/// `normalizeName` — so two add-ons exposing the same catalog collapse to one row.
String normalizeCatalogName(String name, String type) {
  var n = name.toLowerCase();
  for (final w in _stripWords) {
    n = n.replaceAll(RegExp('\\b$w\\b'), '');
  }
  n = n.replaceAll(RegExp('[^a-z0-9]+'), ' ').trim();
  return '$n::$type';
}

/// De-duplicates add-on rows by [normalizeCatalogName] (against the curated
/// [built] rows and each other) and, when the same add-on name exposes more than
/// one type, renames each to "{name}: Movies"/"{name}: Series" so they stay
/// distinguishable. Ports web `mergeRows` (the add-on half — the built rows stay
/// where they are). [dedup] off (`homeShowAllAddonRows`) keeps every row.
List<CatalogRow> mergeAddonRows(
  List<CatalogRow> built,
  List<CatalogRow> addons, {
  bool dedup = true,
}) {
  // Same-name → set of types, for the multi-type rename.
  final typesByName = <String, Set<String>>{};
  for (final a in addons) {
    typesByName.putIfAbsent(a.title.trim().toLowerCase(), () => {}).add(a.type);
  }

  final seen = <String>{
    if (dedup)
      for (final r in built) normalizeCatalogName(r.title, r.type),
  };

  final out = <CatalogRow>[];
  for (final a in addons) {
    if (dedup) {
      final key = normalizeCatalogName(a.title, a.type);
      if (seen.contains(key)) continue;
      seen.add(key);
    }
    final types = typesByName[a.title.trim().toLowerCase()];
    final name = (types != null && types.length > 1)
        ? '${a.title}: ${a.type == 'movie'
              ? 'Movies'
              : a.type == 'series'
              ? 'Series'
              : a.type}'
        : a.title;
    out.add(name == a.title ? a : a.copyWith(title: name));
  }
  return out;
}
