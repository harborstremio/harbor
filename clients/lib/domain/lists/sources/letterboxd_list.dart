import 'package:xml/xml.dart';

import '../../../core/http/text_transport.dart';
import '../../addons/models.dart';
import '../list_types.dart';

/// Resolves a Letterboxd list or watchlist (`user/list/slug`, `user/watchlist`)
/// via the account's public RSS feed, which embeds the TMDB ids Harbor needs.
/// Ported 1:1 from `resolveLetterboxd` in `src/lib/lists/sources/letterboxd.ts`.
Future<List<MetaPreview>> resolveLetterboxdList(
  TextTransport transport,
  String ref,
) async {
  final String text;
  try {
    final res = await transport.getText(_rssUrl(ref));
    if (res.statusCode == 404) {
      throw const ListResolveError(
        ListErrorReason.notFound,
        ListSource.letterboxd,
      );
    }
    if (!res.ok) {
      throw const ListResolveError(
        ListErrorReason.network,
        ListSource.letterboxd,
      );
    }
    text = res.body;
  } on ListResolveError {
    rethrow;
  } catch (_) {
    throw const ListResolveError(
      ListErrorReason.network,
      ListSource.letterboxd,
    );
  }

  final XmlDocument doc;
  try {
    doc = XmlDocument.parse(text);
  } on XmlException {
    throw const ListResolveError(
      ListErrorReason.unparseable,
      ListSource.letterboxd,
    );
  }

  final items = <MetaPreview>[];
  for (final item in doc.findAllElements('item')) {
    final tvId = _tag(item, 'tmdb:tvId');
    final movieId = _tag(item, 'tmdb:movieId');
    if (tvId.isEmpty && movieId.isEmpty) continue;
    final year = _tag(item, 'letterboxd:filmYear');
    final filmTitle = _tag(item, 'letterboxd:filmTitle');
    final name = filmTitle.isNotEmpty ? filmTitle : _tag(item, 'title');
    items.add(
      MetaPreview({
        'id': tvId.isNotEmpty ? 'tmdb:tv:$tvId' : 'tmdb:movie:$movieId',
        'type': tvId.isNotEmpty ? 'series' : 'movie',
        'name': name,
        'releaseInfo': ?(year.isNotEmpty ? year : null),
      }),
    );
  }
  return items;
}

/// The public RSS feed for a ref, with any single trailing slash stripped.
String _rssUrl(String ref) {
  final clean = ref.replaceFirst(RegExp(r'/$'), '');
  return 'https://letterboxd.com/$clean/rss/';
}

/// The trimmed text of the first direct child element whose qualified name
/// (prefix included, e.g. `tmdb:tvId`) matches [name], or `''` when absent.
String _tag(XmlElement item, String name) {
  for (final el in item.childElements) {
    if (el.name.qualified == name) return el.innerText.trim();
  }
  return '';
}
