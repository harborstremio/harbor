import '../../core/http/json_transport.dart';
import 'anime_episode_build.dart';
import 'anime_kitsu_addon.dart';
import 'anizip.dart';
import 'kitsu_client.dart';

/// Whether an episode can actually be played — it carries an addon stream id, or
/// a complete IMDb episode address. Ported 1:1 from `isPlayable`.
bool _isPlayable(KitsuEpisode ep) {
  final streamId = ep.streamId;
  if (streamId != null && streamId.isNotEmpty) return true;
  return (ep.imdbId?.startsWith('tt') ?? false) &&
      ep.imdbSeason != null &&
      ep.imdbEpisode != null;
}

/// Fetches the playable episodes for one franchise entry: the anime-kitsu addon
/// meta, the raw Kitsu episodes and the ani.zip enrichment are gathered in
/// parallel, combined, then each surviving episode is tagged with its source
/// meta id. Results are cached per Kitsu id for the process lifetime. Ported
/// from `fetchEntryEpisodes` (`anime-franchise-episodes.ts`).
class FranchiseEpisodeFetcher {
  FranchiseEpisodeFetcher({
    required AnimeKitsuAddonClient addon,
    required KitsuClient kitsu,
    required JsonTransport transport,
  }) : _addon = addon,
       _kitsu = kitsu,
       _transport = transport;

  final AnimeKitsuAddonClient _addon;
  final KitsuClient _kitsu;
  final JsonTransport _transport;

  final Map<int, Future<List<KitsuEpisode>>> _cache = {};

  Future<List<KitsuEpisode>> fetchEntryEpisodes(int kitsuId) {
    final cached = _cache[kitsuId];
    if (cached != null) return cached;
    final p = _fetch(kitsuId);
    _cache[kitsuId] = p;
    return p;
  }

  Future<List<KitsuEpisode>> _fetch(int kitsuId) async {
    // Start all three in parallel; a failure in any one degrades to its empty
    // value rather than failing the whole fetch.
    final metaF = _guard<AnimeKitsuMeta?>(_addon.meta('kitsu:$kitsuId'), null);
    final rawF = _guard<List<KitsuEpisode>>(
      _kitsu.kitsuEpisodes(kitsuId, 100),
      const [],
    );
    final aniZipF = _guard<AniZipMapping?>(
      aniZipByKitsu(_transport, kitsuId),
      null,
    );
    final addonMeta = await metaF;
    final raw = await rawF;
    final aniZip = await aniZipF;

    final eps = buildKitsuEpisodes(addonMeta, raw);
    mergeAniZipEpisodes(eps, aniZip);
    final sourceMetaId = 'kitsu:$kitsuId';
    final out = <KitsuEpisode>[];
    for (final ep in eps) {
      if (!_isPlayable(ep)) continue;
      ep.sourceMetaId = sourceMetaId;
      out.add(ep);
    }
    return out;
  }

  static Future<T> _guard<T>(Future<T> f, T fallback) async {
    try {
      return await f;
    } catch (_) {
      return fallback;
    }
  }
}
