import '../catalog/catalog_row.dart';

final _animeNamePattern = RegExp(
  r'\b(anime|mal|anilist|kitsu|aniworld|crunchyroll|funimation)\b',
);

/// Whether an add-on catalog [row] is an anime row — ported 1:1 from web
/// `is-anime-row.ts`. Used to drop anime catalogs from the general Home rows in
/// curated mode (they belong in the anime room, not the main shelf). A row is
/// anime when its type is `anime`, its name matches a known anime keyword, or at
/// least half of its first six titles carry an anime id namespace.
bool isAnimeAddonRow(CatalogRow row) {
  if (row.type == 'anime') return true;
  if (_animeNamePattern.hasMatch(row.title.toLowerCase())) return true;
  final sample = row.items.take(6).toList();
  if (sample.isEmpty) return false;
  final animeIds = sample
      .where(
        (m) =>
            m.id.startsWith('kitsu:') ||
            m.id.startsWith('mal:') ||
            m.id.startsWith('anilist:'),
      )
      .length;
  return animeIds / sample.length >= 0.5;
}
