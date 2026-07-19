import '../../../core/http/text_transport.dart';
import '../../addons/models.dart';
import '../list_types.dart';

/// Resolves an IMDb list (`ls…`) or a user watchlist (`ur…`) by scraping the
/// title ids out of the rendered page. IMDb has no public list API, so the page
/// HTML is fetched and every `tt…` id is harvested (deduped, first-seen order).
/// Names are left blank — the caller enriches from Cinemeta/TMDB by id, exactly
/// as the web does. Ported 1:1 from `resolveImdb` in `src/lib/lists/sources/imdb.ts`.
Future<List<MetaPreview>> resolveImdbList(
  TextTransport transport,
  String ref,
) async {
  final String text;
  try {
    final res = await transport.getText(_pageUrl(ref));
    if (res.statusCode == 404) {
      throw const ListResolveError(ListErrorReason.notFound, ListSource.imdb);
    }
    if (!res.ok) {
      throw const ListResolveError(ListErrorReason.network, ListSource.imdb);
    }
    text = res.body;
  } on ListResolveError {
    rethrow;
  } catch (_) {
    throw const ListResolveError(ListErrorReason.network, ListSource.imdb);
  }

  final seen = <String>{};
  final items = <MetaPreview>[];
  for (final match in RegExp(r'\btt\d{7,}\b').allMatches(text)) {
    final id = match.group(0)!;
    if (!seen.add(id)) continue;
    items.add(MetaPreview({'id': id, 'type': 'movie', 'name': ''}));
  }
  return items;
}

/// A `ur…` ref is a user watchlist; anything else is a list id (`ls…`).
String _pageUrl(String ref) {
  if (RegExp(r'^ur\d+$', caseSensitive: false).hasMatch(ref)) {
    return 'https://www.imdb.com/user/$ref/watchlist';
  }
  return 'https://www.imdb.com/list/$ref/';
}
