import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/http/bytes_transport.dart';
import '../core/http/text_transport.dart';
import '../domain/addons/models.dart';
import '../domain/iptv/channel_hydration.dart';
import '../domain/iptv/channel_stats.dart';
import '../domain/iptv/country_prefs.dart';
import '../domain/iptv/epg_map.dart';
import '../domain/iptv/epg_store.dart';
import '../domain/iptv/favorites.dart';
import '../domain/iptv/group_prefs.dart';
import '../domain/iptv/m3u.dart';
import '../domain/iptv/pins.dart';
import '../domain/iptv/playlist.dart';
import '../domain/iptv/xmltv.dart';
import '../domain/iptv/playlist_store.dart';
import '../domain/iptv/prefs.dart';
import '../domain/iptv/rtl.dart' show arabicAwareMatch;
import '../domain/iptv/vod_enrich.dart';
import '../domain/iptv/source_cleanup.dart';
import '../domain/iptv/xtream_short_epg.dart';
import 'providers.dart';

/// The direct raw-text HTTP transport (M3U playlists). Overridden in tests.
final textTransportProvider = Provider<TextTransport>(
  (ref) => DioTextTransport(),
);

/// The direct raw-bytes HTTP transport (gzipped XMLTV EPG). Overridden in tests.
final bytesTransportProvider = Provider<BytesTransport>(
  (ref) => DioBytesTransport(),
);

/// The configured IPTV sources, parsed from `iptvPlaylists` in settings.
final iptvSourcesProvider = Provider<List<IptvPlaylistSource>>(
  (ref) => parseIptvSources(ref.watch(settingsProvider)['iptvPlaylists']),
);

/// The global EPG time offset in hours, from settings.
final iptvEpgOffsetHoursProvider = Provider<double>(
  (ref) =>
      iptvEpgOffsetHoursPref(ref.watch(settingsProvider)['iptvEpgOffsetHours']),
);

/// The playlist cache/loader, wired with the live transports. The Xtream live
/// container preference is read from settings at load time.
final iptvPlaylistStoreProvider = Provider<IptvPlaylistStore>(
  (ref) => IptvPlaylistStore(
    json: ref.watch(jsonTransportProvider),
    text: ref.watch(textTransportProvider),
    liveContainer: () =>
        iptvLiveContainerPref(ref.read(settingsProvider)['iptvLiveContainer']),
  ),
);

/// The XMLTV EPG cache/loader, wired with the live bytes transport.
final epgStoreProvider = Provider<EpgStore>(
  (ref) => EpgStore(bytes: ref.watch(bytesTransportProvider)),
);

/// Loads (and caches) the playlist for a source, exposed as an AsyncValue for
/// the Live TV view's loading/error/data states.
final iptvPlaylistProvider =
    FutureProvider.family<IptvPlaylist, IptvPlaylistSource>(
      (ref, source) => ref.watch(iptvPlaylistStoreProvider).load(source),
    );

/// A 30-second wall-clock tick (epoch millis) driving the EPG now/next
/// progress. Overridden with a fixed value in tests.
final nowMsProvider = StreamProvider<int>((ref) async* {
  yield DateTime.now().millisecondsSinceEpoch;
  yield* Stream.periodic(
    const Duration(seconds: 30),
    (_) => DateTime.now().millisecondsSinceEpoch,
  );
});

/// Loads the XMLTV EPG index for a source — from its `epgUrl`, else the derived
/// Xtream EPG urls — or null when unavailable. Best-effort: a failure leaves the
/// channels rendering without programme info.
final iptvEpgProvider = FutureProvider.family<EpgIndex?, IptvPlaylistSource>((
  ref,
  source,
) async {
  final epgUrl = source.epgUrl;
  final urls = (epgUrl != null && epgUrl.isNotEmpty)
      ? [epgUrl]
      : deriveEpgUrls(source.url);
  EpgIndex? base;
  if (urls.isNotEmpty) {
    try {
      base = await ref
          .watch(epgStoreProvider)
          .load(playlistId: source.id, urls: urls);
    } catch (_) {
      base = null;
    }
  }
  // Xtream short-EPG now/next fallback when the XMLTV feed carries no
  // programmes: fetch per-stream get_short_epg for the leading channels.
  if (source.kind == IptvSourceKind.xtream &&
      (base == null || base.byChannel.isEmpty)) {
    try {
      final playlist = await ref.watch(iptvPlaylistProvider(source).future);
      return await xtreamEpgFallback(
        ref.watch(jsonTransportProvider),
        source,
        playlist.channels,
        base,
      );
    } catch (_) {
      // Best-effort: fall through to the (possibly empty) XMLTV base.
    }
  }
  return base;
});

/// The manual EPG override map (channelId → tvg-id).
final epgOverrideStoreProvider = Provider<EpgOverrideStore>(
  (ref) => EpgOverrideStore(ref.watch(kvStoreProvider)),
);

/// The pinned-channel store.
final channelPinsStoreProvider = Provider<ChannelPinsStore>(
  (ref) => ChannelPinsStore(ref.watch(kvStoreProvider)),
);

/// The per-source group-preferences store.
final groupPrefsStoreProvider = Provider<GroupPrefsStore>(
  (ref) => GroupPrefsStore(ref.watch(kvStoreProvider)),
);

/// The channel play-stats store.
final channelStatsStoreProvider = Provider<ChannelStatsStore>(
  (ref) => ChannelStatsStore(ref.watch(kvStoreProvider)),
);

/// Enriches named channels with Cinemeta metadata (posters for logo-less
/// channels), caching + persisting results.
final channelHydratorProvider = Provider<ChannelHydrator>(
  (ref) => ChannelHydrator(
    ref.watch(addonClientProvider),
    kv: ref.watch(kvStoreProvider),
  ),
);

/// The hydrated Cinemeta metadata for a channel name, or null. Keyed by name so
/// distinct channels fetch once and share the result.
final channelHydrationProvider = FutureProvider.family<Meta?, String>(
  (ref, name) => ref.watch(channelHydratorProvider).hydrate(name),
);

/// Enriches VOD movie/series titles with TMDB metadata (posters/overview).
final vodEnricherProvider = Provider<VodEnricher>(
  (ref) => VodEnricher(ref.watch(tmdbClientProvider)),
);

/// The TMDB enrichment for a VOD title, keyed `(kind, title, year)`.
final vodEnrichmentProvider =
    FutureProvider.family<VodEnrichment?, (String, String, int?)>(
      (ref, key) =>
          ref.watch(vodEnricherProvider).enrich(key.$1, key.$2, key.$3),
    );

/// The currently-cached playlists for every configured source, kicking off a
/// load for each and re-emitting when the store commits (including the
/// deferred Xtream VOD/series hydration). Backs the VOD library.
class IptvCachedPlaylists extends Notifier<List<IptvPlaylist>> {
  @override
  List<IptvPlaylist> build() {
    final store = ref.watch(iptvPlaylistStoreProvider);
    final sources = ref.watch(iptvSourcesProvider);
    final unsub = store.subscribe(() => state = _snapshot(store, sources));
    ref.onDispose(unsub);
    for (final s in sources) {
      unawaited(store.load(s));
    }
    return _snapshot(store, sources);
  }

  List<IptvPlaylist> _snapshot(
    IptvPlaylistStore store,
    List<IptvPlaylistSource> sources,
  ) => [for (final s in sources) ?store.cached(s.id)];
}

final iptvCachedPlaylistsProvider =
    NotifierProvider<IptvCachedPlaylists, List<IptvPlaylist>>(
      IptvCachedPlaylists.new,
    );

/// The per-source country-filter store.
final countryPrefsStoreProvider = Provider<CountryPrefsStore>(
  (ref) => CountryPrefsStore(ref.watch(kvStoreProvider)),
);

/// The favorited-channel store.
final favoritesStoreProvider = Provider<FavoritesStore>(
  (ref) => FavoritesStore(ref.watch(kvStoreProvider)),
);

/// Fans a source removal across every per-source IPTV cache and preference
/// (favorites included). Call when a playlist source is deleted from settings.
final iptvSourceCleanupProvider = Provider<Future<void> Function(String)>(
  (ref) =>
      (sourceId) => purgePlaylistState(
        sourceId: sourceId,
        playlistStore: ref.read(iptvPlaylistStoreProvider),
        epgStore: ref.read(epgStoreProvider),
        statsStore: ref.read(channelStatsStoreProvider),
        pinsStore: ref.read(channelPinsStoreProvider),
        groupPrefsStore: ref.read(groupPrefsStoreProvider),
        countryPrefsStore: ref.read(countryPrefsStoreProvider),
        epgOverrideStore: ref.read(epgOverrideStoreProvider),
        removeFavoritesForSource: ref
            .read(favoritesStoreProvider)
            .removeForSource,
      ),
);

/// Live-TV channel hits for the Search screen (web `results.liveTv`) — an
/// arabic-aware name/group match across every cached, non-EPG playlist, deduped
/// by url and capped at 8. Empty for a short query or before any playlist is
/// cached (matches web `getCachedPlaylist`); recomputes as the query changes.
final searchLiveChannelsProvider = Provider.autoDispose<
  List<({IptvChannel channel, String playlistName})>
>((ref) {
  final q = ref.watch(searchQueryProvider).trim().toLowerCase();
  if (q.length < 2) return const [];
  final sources = ref.watch(iptvSourcesProvider);
  final store = ref.watch(iptvPlaylistStoreProvider);
  final out = <({IptvChannel channel, String playlistName})>[];
  final seenUrl = <String>{};
  for (final s in sources) {
    if (s.kind == IptvSourceKind.epg) continue;
    final cached = store.cached(s.id);
    if (cached == null) continue;
    for (final ch in cached.channels) {
      if (seenUrl.contains(ch.url)) continue;
      if (!arabicAwareMatch('${ch.name} ${ch.group ?? ''}', q)) continue;
      seenUrl.add(ch.url);
      out.add((channel: ch, playlistName: s.name));
      if (out.length >= 8) return out;
    }
  }
  return out;
});
