import '../addons/models.dart';

/// A browsable catalog declared by an installed addon's manifest. Ported from
/// `catalog-browse.ts` `BrowseCatalog`.
class BrowseCatalog {
  const BrowseCatalog({
    required this.key,
    required this.addonName,
    this.addonLogo,
    required this.base,
    required this.type,
    required this.id,
    required this.name,
    this.genreExtra,
    this.genres = const [],
  });

  /// Stable identity across addon + catalog.
  final String key;
  final String addonName;
  final String? addonLogo;

  /// The addon transport base (no `/manifest.json`).
  final String base;
  final String type;
  final String id;
  final String name;

  /// The name of the genre `extra`, if this catalog is genre-filterable.
  final String? genreExtra;
  final List<String> genres;
}

const _nonContent = {'addon_catalog'};

/// Enumerates the browsable content catalogs across [addons] — every
/// manifest-declared catalog that has a name/type/id, isn't an addon-catalog,
/// and doesn't require a search query. Ports `listBrowseCatalogs`.
List<BrowseCatalog> listBrowseCatalogs(List<InstalledAddon> addons) {
  final out = <BrowseCatalog>[];
  for (final addon in addons) {
    final manifest = addon.manifest;
    if (manifest == null) continue;
    final base = addon.transportUrl.replaceFirst(
      RegExp(r'/manifest\.json$'),
      '',
    );
    for (final cat in manifest.catalogs) {
      final name = cat.name;
      if (name == null ||
          name.isEmpty ||
          cat.type.isEmpty ||
          cat.id.isEmpty ||
          _nonContent.contains(cat.type.toLowerCase())) {
        continue;
      }
      final extras = cat.extra;
      if (extras.any((e) => e.isRequired && e.name == 'search')) continue;
      CatalogExtraDef? genre;
      for (final e in extras) {
        if (e.name == 'genre' || e.name == 'Genre') {
          genre = e;
          break;
        }
      }
      out.add(
        BrowseCatalog(
          key: '${manifest.id}-${cat.type}-${cat.id}',
          addonName: manifest.name ?? '',
          addonLogo: manifest.logo,
          base: base,
          type: cat.type,
          id: cat.id,
          name: name,
          genreExtra: genre?.name,
          genres: [
            for (final g in genre?.options ?? const <String>[])
              if (g.isNotEmpty) g,
          ],
        ),
      );
    }
  }
  return out;
}
