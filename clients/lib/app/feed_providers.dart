import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/addons/models.dart';
import '../domain/catalog/cinemeta.dart' show cinemetaBase;
import '../domain/catalog/hero_slide.dart';
import '../domain/catalog/tmdb_critic.dart';
import '../domain/discover/discover_store.dart';
import '../domain/feed/award_winners.dart';
import '../domain/feed/daily_rows.dart';
import '../domain/feed/feed_locale.dart' show localeWeights;
import '../domain/feed/feed_pool.dart';
import '../domain/feed/feed_preferences.dart';
import '../domain/feed/feed_sections.dart'
    show fetchCriticsPickList, fetchFeatured;
import '../domain/feed/feed_skipped.dart';
import 'awards_providers.dart';
import 'providers.dart';

/// The discover taste store — the event log and the affinity it derives, that
/// the featured hero, ranking and daily rows learn from.
final affinityStoreProvider = Provider<AffinityStore>(
  (ref) => AffinityStore(ref.watch(kvStoreProvider)),
);

/// The Discover feed-vote store — the up/down votes that steer and hide feed
/// titles, persisted to the key-value store.
final feedPreferencesStoreProvider = Provider<FeedPreferencesStore>(
  (ref) => FeedPreferencesStore(ref.watch(kvStoreProvider)),
);

/// The discovery queue's skip/block memory — a skip snoozes a title for two
/// weeks, a "not interested" blocks it for good, and both hide it from the
/// queue. Persisted to the key-value store.
final feedSkippedStoreProvider = Provider<FeedSkippedStore>(
  (ref) => FeedSkippedStore(ref.watch(kvStoreProvider)),
);

/// The Discover feed pool: the day-seeded, interleaved mix of trending, top-
/// rated, hidden-gem, genre, decade and language strands (keyed TMDB, or the
/// Cinemeta fallback). Ported from `getPool`; kept alive so the day's pool is
/// built once and cached for the session.
final feedPoolProvider = FutureProvider<List<FeedItem>>((ref) {
  ref.keepAlive();
  return buildPool(
    ref.watch(tmdbClientProvider),
    ref.watch(addonClientProvider),
  );
});

/// One more page of the feed pool for infinite scroll, ported from `extendPool`.
/// Empty without a TMDB key (the fallback pool does not paginate).
final feedPoolPageProvider = FutureProvider.family<List<FeedItem>, int>(
  (ref, page) => extendPool(ref.watch(tmdbClientProvider), page),
);

/// The Discover award-winners resolver — the newest winners of the seeded award
/// categories, searched on TMDB and cached, backing the "Award Winning" row.
final awardWinnersResolverProvider = FutureProvider<AwardWinnersResolver>((
  ref,
) async {
  final history = await ref.watch(awardsHistoryProvider.future);
  return AwardWinnersResolver(
    history,
    ref.watch(tmdbClientProvider),
    ref.watch(kvStoreProvider),
  );
});

/// The titles the user has voted on (up or down) — excluded from the featured
/// hero and daily rows.
final _feedBlockedProvider = Provider<Set<String>>((ref) {
  final prefs = ref.watch(feedPreferencesStoreProvider);
  return {...prefs.downvotedIds(), ...prefs.upvotedIds()};
});

/// The Discover featured hero pool — the taste-seeded, affinity-ranked top ten.
final featuredProvider = FutureProvider<List<MetaPreview>>((ref) {
  return fetchFeatured(
    ref.watch(tmdbClientProvider),
    ref.watch(addonClientProvider),
    ref.watch(settingsProvider),
    ref.watch(affinityStoreProvider).affinity(),
    ref.watch(_feedBlockedProvider),
    ref.watch(recentlyPlayedProvider),
  );
});

/// The Discover "Critics' Pick" list — day-rotated high-vote picks.
final criticsPickProvider = FutureProvider<List<MetaPreview>>((ref) {
  return fetchCriticsPickList(
    ref.watch(tmdbClientProvider),
    ref.watch(settingsProvider),
    ref.watch(recentlyPlayedProvider),
  );
});

/// The single title spotlighted by the Discover critics-pick card: the first
/// critics-pick that isn't already in the featured hero and has a backdrop +
/// description, day-rotated; falling back to the first non-featured pick.
/// Ported 1:1 from the `criticsPick` memo in discover.tsx.
final criticsPickSelectionProvider = FutureProvider<MetaPreview?>((ref) async {
  final list = await ref.watch(criticsPickProvider.future);
  final featured = await ref.watch(featuredProvider.future);
  final featuredIds = {for (final m in featured) m.id};
  final unfeatured = [
    for (final m in list)
      if (!featuredIds.contains(m.id)) m,
  ];
  if (unfeatured.isEmpty) return null;
  final candidates = [
    for (final m in unfeatured)
      if ((m.background ?? '').isNotEmpty && (m.description ?? '').isNotEmpty) m,
  ];
  if (candidates.isEmpty) return unfeatured.first;
  final now = DateTime.now();
  final dayOfYear = now.difference(DateTime(now.year)).inDays;
  return candidates[dayOfYear % candidates.length];
});

/// The enriched critic data (reviews/cast/crew/meta) behind the Discover
/// critics-pick spotlight, keyed by the title's id + type.
final criticDataProvider = FutureProvider.autoDispose
    .family<CriticData?, ({String id, String type})>(
      (ref, arg) =>
          tmdbCriticData(ref.watch(tmdbClientProvider), arg.id, arg.type),
    );

/// The backdrop stills strip for the critics-pick spotlight.
final movieStillsProvider = FutureProvider.autoDispose.family<List<String>, String>(
  (ref, metaId) => tmdbMovieStills(ref.watch(tmdbClientProvider), metaId),
);

/// The Discover sections the user has hidden via the customize bar
/// (`section-featured` / `section-surprise`), persisted to settings. Ports the
/// web `pageRows.custom.hidden` section toggles.
class DiscoverHiddenSectionsController extends Notifier<Set<String>> {
  @override
  Set<String> build() =>
      ref.watch(settingsProvider).getStringList('discoverHiddenSections').toSet();

  Future<void> toggle(String key) async {
    final next = {...state};
    if (!next.remove(key)) next.add(key);
    await ref
        .read(settingsProvider.notifier)
        .setValue('discoverHiddenSections', next.toList());
    state = next;
  }

  Future<void> reset() async {
    await ref
        .read(settingsProvider.notifier)
        .setValue('discoverHiddenSections', <String>[]);
    state = {};
  }
}

final discoverHiddenSectionsProvider =
    NotifierProvider<DiscoverHiddenSectionsController, Set<String>>(
      DiscoverHiddenSectionsController.new,
    );

/// The Discover daily rails — the pinned anchors plus the day-shuffled taste
/// rows (or the Cinemeta fallback shelves without a key).
final dailyRailsProvider = FutureProvider<List<RailDef>>((ref) async {
  final awards = await ref.watch(awardWinnersResolverProvider.future);
  final settings = ref.watch(settingsProvider);
  return DailyRows(ref.watch(kvStoreProvider)).select(
    tmdb: ref.watch(tmdbClientProvider),
    addon: ref.watch(addonClientProvider),
    awards: awards,
    affinity: ref.watch(affinityStoreProvider).affinity(),
    settings: settings,
    locale: localeWeights(settings),
    blocked: ref.watch(_feedBlockedProvider),
    watched: ref.watch(recentlyPlayedProvider),
  );
});

/// The Discover featured hero slides — the top of the featured pool, hydrated
/// for the hero carousel (Cinemeta ids are resolved for their backdrop/logo).
final featuredHeroSlidesProvider = FutureProvider<List<HeroSlide>>((ref) async {
  final featured = await ref.watch(featuredProvider.future);
  final client = ref.watch(addonClientProvider);
  final pool = featured.take(5).toList();
  final metas = await Future.wait(
    pool.map((m) async {
      if (m.id.startsWith('tmdb:') || m.background != null) return Meta(m.json);
      final r = await client.meta(cinemetaBase, m.type, m.id);
      return r.valueOrNull ?? Meta(m.json);
    }),
  );
  final slides = <HeroSlide>[];
  for (final meta in metas) {
    slides.add(
      HeroSlide(
        meta: meta,
        rankLabel: meta.type == 'series' ? 'TV' : 'Movies',
        rankPosition: slides.length + 1,
      ),
    );
  }
  return slides;
});
