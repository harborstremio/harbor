import '../addons/models.dart';
import 'catalog_row.dart';

/// The Home body split into its ranked top-10 rail and the remaining shelves,
/// after cross-row poster de-duplication. Ported 1:1 from the `displayed` memo
/// in `src/views/home.tsx`.
class HomeDisplay {
  const HomeDisplay({
    required this.top10,
    required this.top10Title,
    required this.rest,
  });

  /// The first ≤10 posters of the first row, promoted into the Top-10 rail.
  final List<MetaPreview> top10;

  /// The first row's name, used to title the Top-10 rail.
  final String top10Title;

  /// Every other row, each with its first-page head de-duplicated against the
  /// hero slides, the top-10, and every earlier row's head.
  final List<CatalogRow> rest;
}

/// The first-page window the web applies before de-duplication (`FIRST_PAGE`).
const _firstPage = 20;

/// Splits [rows] into the top-10 rail + the rest, de-duplicating posters the way
/// `src/views/home.tsx` does: the hero slide ids seed a `seen` set; the first
/// row's head yields up to ten unseen posters for the rank rail; then each later
/// row's first-page head drops already-seen posters (unless the row opts out via
/// [CatalogRow.noDedup]), and a normal row is skipped entirely if fewer than
/// four of its head posters survive. Only the head is de-duplicated — the paged
/// tail (beyond [_firstPage]) is preserved verbatim. In classic mode nothing is
/// promoted or de-duplicated.
HomeDisplay computeHomeDisplay({
  required List<CatalogRow> rows,
  required Set<String> heroIds,
  bool classic = false,
  bool dedup = true,
}) {
  if (classic) {
    return HomeDisplay(top10: const [], top10Title: '', rest: rows);
  }
  final seen = <String>{...heroIds};
  final firstRow = rows.isNotEmpty ? rows.first : null;
  final firstRowHead = (firstRow?.items ?? const <MetaPreview>[])
      .take(_firstPage)
      .toList();
  final top10 =
      (dedup ? firstRowHead.where((m) => !seen.contains(m.id)) : firstRowHead)
          .take(10)
          .toList();
  for (final m in top10) {
    seen.add(m.id);
  }
  final rest = <CatalogRow>[];
  for (final row in rows.skip(1)) {
    final head = row.items.take(_firstPage).toList();
    final tail = row.items.length > _firstPage
        ? row.items.sublist(_firstPage)
        : const <MetaPreview>[];
    // A row opts out of cross-row poster de-duplication via [CatalogRow.noDedup]
    // (web `row.noDedup`); production always calls with `dedup: true` (the web
    // `displayed` memo runs this stage unconditionally). The `dedup` flag stays
    // a test seam for exercising the un-deduped shape directly.
    final skipDedup = row.noDedup || !dedup;
    final filteredHead = skipDedup
        ? head
        : head.where((m) => !seen.contains(m.id)).toList();
    if (!skipDedup && filteredHead.length < 4) continue;
    for (final m in filteredHead) {
      seen.add(m.id);
    }
    rest.add(row.copyWith(items: [...filteredHead, ...tail]));
  }
  return HomeDisplay(
    top10: top10,
    top10Title: firstRow?.title ?? '',
    rest: rest,
  );
}
