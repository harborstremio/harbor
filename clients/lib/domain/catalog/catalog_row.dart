import '../addons/models.dart';
import '../library/playback_history.dart';

/// A titled row of catalog items shown on Home / Discover / Catalogs. [key] is
/// a stable id for customization/scroll-memory; [genre] (when set) is the
/// catalog `genre` extra so a row's View-All can re-fetch it.
class CatalogRow {
  const CatalogRow({
    required this.title,
    required this.type,
    required this.id,
    required this.items,
    this.key,
    this.genre,
    this.numerals = false,
    this.noDedup = false,
  });

  final String title;
  final String type;
  final String id;
  final List<MetaPreview> items;
  final String? key;
  final String? genre;

  /// Render as a ranked (Top-10) row rather than a poster grid.
  final bool numerals;

  /// When true this row opts out of cross-row poster de-duplication (personal
  /// rows like Favorites / My Watchlist and custom-source rows).
  final bool noDedup;

  CatalogRow copyWith({
    List<MetaPreview>? items,
    String? title,
    bool? numerals,
  }) => CatalogRow(
    title: title ?? this.title,
    type: type,
    id: id,
    items: items ?? this.items,
    key: key,
    genre: genre,
    numerals: numerals ?? this.numerals,
    noDedup: noDedup,
  );
}

/// Keeps metas whose `originalLanguage` is unset or in [langs], ported from the
/// `homeLanguages` filter in `customizable-rows.tsx`. Empty [langs] = no filter.
List<MetaPreview> filterMetasByLanguage(
  List<MetaPreview> metas,
  List<String> langs,
) {
  if (langs.isEmpty) return metas;
  return metas.where((m) {
    final l = m.originalLanguage;
    return l == null || l.isEmpty || langs.contains(l);
  }).toList();
}

/// Applies [filterMetasByLanguage] to each row, dropping any left empty.
List<CatalogRow> filterRowsByLanguage(
  List<CatalogRow> rows,
  List<String> langs,
) {
  if (langs.isEmpty) return rows;
  final out = <CatalogRow>[];
  for (final r in rows) {
    final items = filterMetasByLanguage(r.items, langs);
    if (items.isEmpty) continue;
    out.add(r.copyWith(items: items));
  }
  return out;
}

/// True when [m] releases after [now]: a valid future `releaseDate` wins, else
/// the `releaseInfo` year (first 4 chars) exceeding [now]'s year. Ported 1:1
/// from `isUnreleased` in `customizable-rows.tsx`.
bool isUnreleasedMeta(MetaPreview m, DateTime now) {
  final rd = m.releaseDate;
  if (rd != null && rd.isNotEmpty) {
    final t = DateTime.tryParse(rd);
    if (t != null) return t.isAfter(now);
  }
  final info = m.releaseInfo;
  if (info != null && info.isNotEmpty) {
    final head = info.length >= 4 ? info.substring(0, 4) : info;
    final yr = int.tryParse(head);
    if (yr != null) return yr > now.year;
  }
  return false;
}

/// Drops metas that are not yet released as of [now] (the `hideUnreleased`
/// setting).
List<MetaPreview> filterMetasUnreleased(
  List<MetaPreview> metas,
  DateTime now,
) => metas.where((m) => !isUnreleasedMeta(m, now)).toList();

/// Applies [filterMetasUnreleased] to each row, dropping any left empty.
List<CatalogRow> filterRowsUnreleased(List<CatalogRow> rows, DateTime now) {
  final out = <CatalogRow>[];
  for (final r in rows) {
    final items = filterMetasUnreleased(r.items, now);
    if (items.isEmpty) continue;
    out.add(r.copyWith(items: items));
  }
  return out;
}

/// Drops titles the viewer has already watched (by id or normalized title),
/// for the `hideWatchedInCatalogs` setting — the local portion of the web
/// `isWatched` check.
List<MetaPreview> filterMetasWatched(
  List<MetaPreview> metas,
  WatchedSet watched,
) => metas.where((m) => !watched.contains(m.id, m.name)).toList();

/// Applies [filterMetasWatched] to each row, dropping any left empty.
List<CatalogRow> filterRowsWatched(List<CatalogRow> rows, WatchedSet watched) {
  final out = <CatalogRow>[];
  for (final r in rows) {
    final items = filterMetasWatched(r.items, watched);
    if (items.isEmpty) continue;
    out.add(r.copyWith(items: items));
  }
  return out;
}
