import '../../core/http/json_transport.dart';
import '../../core/http/text_transport.dart';
import '../addons/models.dart';
import '../catalog/tmdb.dart';
import '../trakt/trakt_client.dart';
import 'list_types.dart';
import 'sources/imdb_list.dart';
import 'sources/letterboxd_list.dart';
import 'sources/mal_list.dart';
import 'sources/mdblist_list.dart';
import 'sources/tmdb_list.dart';
import 'sources/trakt_list.dart';

/// The hard cap on how many items a single list contributes, matching the web
/// `CAP`. Deduping also stops here.
const _cap = 500;

/// Resolves an [ImportedList] to its catalog items by dispatching to the matching
/// per-source resolver, then deduping by id. Ported 1:1 from `resolveList` in
/// `src/lib/lists/resolve.ts`. The web passes ambient singletons to the
/// resolvers; here the clients/transports are injected once and reused, so the
/// per-call surface is just the list itself. A resolver failure surfaces as the
/// [ListResolveError] it throws — never a silent empty result.
class ListResolver {
  const ListResolver({
    required JsonTransport jsonTransport,
    required TextTransport textTransport,
    required TmdbClient tmdbClient,
    required TraktClient traktClient,
    required this.mdblistKey,
  }) : _json = jsonTransport,
       _text = textTransport,
       _tmdb = tmdbClient,
       _trakt = traktClient;

  final JsonTransport _json;
  final TextTransport _text;
  final TmdbClient _tmdb;
  final TraktClient _trakt;

  /// The MDBList API key (the only source key not already carried by a client;
  /// TMDB's key lives inside [_tmdb]). Mirrors the web `ListKeys`.
  final String mdblistKey;

  Future<ResolveResult> resolve(ImportedList list) async {
    final items = switch (list.source) {
      ListSource.mdblist => await resolveMdblistList(
        _json,
        list.ref,
        mdblistKey,
      ),
      ListSource.trakt => await resolveTraktList(_trakt, list.ref),
      ListSource.tmdb => await resolveTmdbList(_tmdb, list.ref),
      ListSource.letterboxd => await resolveLetterboxdList(_text, list.ref),
      ListSource.imdb => await resolveImdbList(_text, list.ref),
      ListSource.mal => await resolveMalList(_json, list.ref),
    };
    return ResolveResult(items: _dedupe(items));
  }
}

/// Drops id-less and duplicate items (first id wins), capped at [_cap].
List<MetaPreview> _dedupe(List<MetaPreview> items) {
  final seen = <String>{};
  final out = <MetaPreview>[];
  for (final item in items) {
    final id = item.id;
    if (id.isEmpty || !seen.add(id)) continue;
    out.add(item);
    if (out.length >= _cap) break;
  }
  return out;
}
