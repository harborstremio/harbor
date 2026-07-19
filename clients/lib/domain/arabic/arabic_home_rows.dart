import '../addons/models.dart';
import '../catalog/catalog_row.dart';
import '../catalog/tmdb.dart';
import 'arabic_rows.dart';

/// Fetches the first page of each Arabic row and returns the non-empty ones as
/// home rows (the Arabic-UI home feed prepends these). Ported 1:1 from the web
/// `buildArabicHomeRows`; rows carry `noDedup` so they are not collapsed against
/// the rest of the feed. Returns empty when there is no TMDB key.
Future<List<CatalogRow>> buildArabicHomeRows(
  TmdbClient client, {
  DateTime Function() clock = DateTime.now,
}) async {
  if (client.apiKey.isEmpty) return const [];
  final specs = arabicRowSpecs(client, clock: clock);
  final firstPages = await Future.wait(
    specs.map((s) => s.fetcher(1).catchError((_) => <MetaPreview>[])),
  );
  final rows = <CatalogRow>[];
  for (var i = 0; i < specs.length; i++) {
    final metas = firstPages[i];
    if (metas.isEmpty) continue;
    rows.add(
      CatalogRow(
        key: 'arabic-${specs[i].id}',
        id: 'arabic-${specs[i].id}',
        title: specs[i].title,
        type: specs[i].type,
        items: metas,
        noDedup: true,
      ),
    );
  }
  return rows;
}
