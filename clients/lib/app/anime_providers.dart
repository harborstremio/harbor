import 'dart:async';
import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/addons/adult_filter.dart';
import '../domain/addons/models.dart';
import '../domain/anilist/anilist_browse.dart';
import '../domain/anime/anime_awards.dart';
import '../domain/anime/anime_detect.dart';
import '../domain/anime/anime_dub.dart';
import '../domain/anime/anime_episode_enrich.dart';
import '../domain/anime/anime_fillers.dart';
import '../domain/anime/anime_franchise_episodes.dart';
import '../domain/anime/anime_home_rows.dart';
import '../domain/anime/anime_kitsu_addon.dart';
import '../domain/anime/anime_mapping.dart';
import '../domain/anime/anime_rows.dart';
import '../domain/anime/fanart.dart';
import '../domain/catalog/catalog_row.dart';
import '../domain/anime/jikan_client.dart';
import '../domain/anime/kitsu_client.dart';
import 'anilist_providers.dart' show anilistClientProvider;
import 'iptv_providers.dart' show textTransportProvider;
import 'providers.dart';

/// The public "Trending on AniList" anime rail (no auth needed).
final anilistTrendingAnimeProvider = FutureProvider<List<MetaPreview>>(
  (ref) => fetchAnilistTrendingAnime(ref.watch(anilistClientProvider)),
);

/// The public "Top 100 on AniList" anime rail.
final anilistTopAnimeProvider = FutureProvider<List<MetaPreview>>(
  (ref) => fetchAnilistTopAnime(ref.watch(anilistClientProvider)),
);

/// The Jikan (MyAnimeList) client — the public anime data source behind the
/// anime rows. Reads the adult-content setting live at query time so toggling it
/// takes effect without rebuilding (and dropping) the client's cache.
final jikanClientProvider = Provider<JikanClient>((ref) {
  return JikanClient(
    ref.watch(jsonTransportProvider),
    kv: ref.watch(kvStoreProvider),
    adultHidden: () => adultContentHidden({
      'hideContent': ref.read(settingsProvider)['hideContent'],
    }),
  );
});

/// The Kitsu (kitsu.io) anime provider — detail and relationship fetches behind
/// the anime detail page and the top-picks sequels.
final kitsuClientProvider = Provider<KitsuClient>(
  (ref) => KitsuClient(
    ref.watch(jsonTransportProvider),
    adultHidden: () => adultContentHidden({
      'hideContent': ref.read(settingsProvider)['hideContent'],
    }),
  ),
);

/// The anime-kitsu Stremio addon meta provider — episode videos with IMDb
/// cross-ids behind the anime detail page's episode list.
final animeKitsuAddonClientProvider = Provider<AnimeKitsuAddonClient>(
  (ref) => AnimeKitsuAddonClient(ref.watch(jsonTransportProvider)),
);

/// The anime filler-episode resolver — scrapes animefillerlist.com (via MAL
/// titles) to mark filler episodes on the anime episode list.
final animeFillersProvider = Provider<AnimeFillers>(
  (ref) => AnimeFillers(
    json: ref.watch(jsonTransportProvider),
    text: ref.watch(textTransportProvider),
    kv: ref.watch(kvStoreProvider),
  ),
);

/// The fanart.tv artwork provider — English-ranked logos, backdrops, posters
/// and banners for anime, keyed by the user's fanart.tv key.
final fanartClientProvider = Provider<FanartClient>(
  (ref) => FanartClient(ref.watch(jsonTransportProvider)),
);

/// The keyless anime id cross-reference mapper (Kitsu↔TVDB/IMDb/AniList/MAL/
/// AniDB) behind anime detection, episode enrichment and the detail page.
final animeMapperProvider = Provider<AnimeMapper>(
  (ref) => AnimeMapper(
    json: ref.watch(jsonTransportProvider),
    text: ref.watch(textTransportProvider),
    kv: ref.watch(kvStoreProvider),
    kitsu: ref.watch(kitsuClientProvider),
  ),
);

/// The anime episode enricher — layers filler flags, fresh IMDb ratings and
/// Cinemeta/TVDB thumbnails onto the base episode list for the detail page.
final animeEpisodeEnricherProvider = Provider<AnimeEpisodeEnricher>(
  (ref) => AnimeEpisodeEnricher(
    mapper: ref.watch(animeMapperProvider),
    fillers: ref.watch(animeFillersProvider),
    addon: ref.watch(addonClientProvider),
    tvdb: ref.watch(tvdbClientProvider),
    transport: ref.watch(jsonTransportProvider),
  ),
);

/// The per-entry franchise episode fetcher — combines the anime-kitsu addon
/// meta, raw Kitsu episodes and ani.zip enrichment into the playable episodes
/// behind a franchise entry's episode list.
final franchiseEpisodeFetcherProvider = Provider<FranchiseEpisodeFetcher>(
  (ref) => FranchiseEpisodeFetcher(
    addon: ref.watch(animeKitsuAddonClientProvider),
    kitsu: ref.watch(kitsuClientProvider),
    transport: ref.watch(jsonTransportProvider),
  ),
);

/// The anime browse rows (airing, top, era and genre), bound to the Jikan
/// client — the row backbone of the anime view.
final animeRowSpecsProvider = Provider<List<AnimeRowSpec>>(
  (ref) => animeRowSpecs(ref.watch(jikanClientProvider)),
);

/// The anime Home rails (Trending / New / Popular / Upcoming anime) — the anime
/// slice at the tail of the Home body. Empty when anime is hidden or on classic
/// Home, matching the web effect gate `!hideContent.anime && homeMode !==
/// 'classic'` (note: `animeOnlyInAnimeRoom` gates only the CW shelf, not these
/// rows).
final animeHomeRowsProvider = FutureProvider<List<CatalogRow>>((ref) async {
  // Depend only on the two gating settings (like the web effect deps) so an
  // unrelated setting change never re-hits the rate-limited Jikan API.
  final (hideAnime, classic) = ref.watch(
    settingsProvider.select(
      (s) => (
        s.getMap('hideContent')['anime'] == true,
        s.getString('homeMode') == 'classic',
      ),
    ),
  );
  if (hideAnime || classic) return const [];
  return buildAnimeHomeRows(ref.watch(jikanClientProvider));
});

/// The store of IMDb-id titles detected as anime.
final animeDetectStoreProvider = Provider<AnimeDetectStore>(
  (ref) => AnimeDetectStore(ref.watch(kvStoreProvider)),
);

/// The detected-anime set, with a probe that resolves continue-watching IMDb
/// ids against their meta and marks the Japanese-animation ones. Ported from the
/// `detectAnimeForCw` store; rebuilds watchers as titles are detected.
class AnimeDetectController extends Notifier<Set<String>> {
  final Set<String> _checked = {};
  final Set<String> _pending = {};

  @override
  Set<String> build() => ref.watch(animeDetectStoreProvider).detected;

  /// Probes each IMDb-id item's meta once and records the anime among them.
  Future<void> detectForCw(List<({String id, String type})> items) async {
    final store = ref.read(animeDetectStoreProvider);
    for (final it in items) {
      final id = it.id;
      if (!isImdbId(id)) continue;
      if (store.isDetected(id) ||
          _checked.contains(id) ||
          _pending.contains(id)) {
        continue;
      }
      _pending.add(id);
      try {
        final meta = await ref.read(
          metaProvider((
            type: it.type == 'movie' ? 'movie' : 'series',
            id: id,
          )).future,
        );
        _checked.add(id);
        if (meta != null &&
            isJapaneseAnime(country: meta.country, genres: meta.genres)) {
          if (store.add(id)) state = {...state, id};
        }
      } catch (_) {
        // A failed probe is left unchecked so a later pass can retry.
      } finally {
        _pending.remove(id);
      }
    }
  }
}

final animeDetectControllerProvider =
    NotifierProvider<AnimeDetectController, Set<String>>(
      AnimeDetectController.new,
    );

/// The persisted award-meta cache key, used to build the franchise synonyms.
const _awardMetasCacheKey = 'harbor.anime_awards.metas.v2';

const _animeAwardFiles = <AwardSourceId, String>{
  AwardSourceId.crunchyroll: 'assets/data/crunchyroll-awards.json',
  AwardSourceId.taaf: 'assets/data/taaf-awards.json',
  AwardSourceId.jmaf: 'assets/data/japan-media-arts-awards.json',
  AwardSourceId.rAnime: 'assets/data/r-anime-awards.json',
  AwardSourceId.animationKobe: 'assets/data/animation-kobe-awards.json',
};

/// The bundled anime-awards index, loaded from the five award datasets and
/// bridged to Jikan names via the synonym cache. Kept alive so the parse and
/// index build happen once.
final animeAwardsProvider = FutureProvider<AnimeAwards>((ref) async {
  ref.keepAlive();
  final data = <AwardSourceId, Map<String, dynamic>>{};
  for (final entry in _animeAwardFiles.entries) {
    final raw = await rootBundle.loadString(entry.value);
    final parsed = jsonDecode(raw);
    if (parsed is Map) data[entry.key] = parsed.cast<String, dynamic>();
  }
  final synonyms = buildAnimeAwardSynonyms(
    ref.watch(kvStoreProvider).getString(_awardMetasCacheKey),
  );
  return AnimeAwards.fromData(data, synonyms: synonyms);
});

/// The debounced search query for the supplementary anime row — Jikan is
/// aggressively rate-limited, so its search fires ~0.5s after the last keystroke
/// rather than on every one.
final _searchAnimeQueryProvider = FutureProvider.autoDispose<String>((ref) {
  final q = ref.watch(searchQueryProvider);
  final completer = Completer<String>();
  final timer = Timer(
    const Duration(milliseconds: 500),
    () => completer.complete(q),
  );
  ref.onDispose(timer.cancel);
  return completer.future;
});

/// Jikan title-search hits for the Search screen's Anime row — supplements the
/// TMDB movies/series with anime results (web `results.anime`). Empty for a
/// short query or on a rate-limit (the Jikan client degrades gracefully).
final searchAnimeProvider = FutureProvider.autoDispose<List<MetaPreview>>((
  ref,
) async {
  final query = (await ref.watch(_searchAnimeQueryProvider.future)).trim();
  if (query.length < 2) return const [];
  try {
    return await ref.read(jikanClientProvider).searchByTitle(query, 8);
  } catch (_) {
    return const [];
  }
});

/// The English-dub anime id sets (web `anime-dub-sub`), fetched once when the
/// DUB-badge setting is on; empty otherwise so the badge stays hidden.
final animeDubSetProvider = FutureProvider<AnimeDubSet>((ref) async {
  ref.keepAlive();
  final on = ref.watch(
    settingsProvider.select((s) => s.getBool('showDubBadge')),
  );
  if (!on) return AnimeDubSet.empty;
  return fetchAnimeDubSet(ref.watch(jsonTransportProvider));
});
