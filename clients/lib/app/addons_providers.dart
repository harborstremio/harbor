import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/addons/addon_sources.dart';
import '../domain/addons/addon_url.dart' show CatalogExtra, addonBase;
import '../domain/addons/addons_velocity.dart';
import '../domain/addons/catalog.dart';
import '../domain/addons/classify.dart';
import '../domain/addons/community_index.dart';
import '../domain/addons/curated.dart';
import '../domain/addons/models.dart';
import '../domain/addons/recommend.dart';
import '../domain/addons/reorder.dart';
import '../domain/addons/resolved_addon.dart';
import '../domain/addons/stremio_addons_client.dart';
import '../domain/catalog/cinemeta_catalog.dart';
import 'providers.dart';
import 'stremio_auth.dart';

/// The stremio-addons.net client, sharing the app's direct JSON transport.
final stremioAddonsClientProvider = Provider<StremioAddonsClient>(
  (ref) => StremioAddonsClient(ref.watch(jsonTransportProvider)),
);

/// The community star index over the site client — one instance, cached.
final communityIndexProvider = Provider<CommunityIndex>(
  (ref) => CommunityIndex(ref.watch(stremioAddonsClientProvider)),
);

/// The star-velocity store, tracking daily snapshots of the community index.
final addonsVelocityStoreProvider = Provider<AddonsVelocityStore>(
  (ref) => AddonsVelocityStore(
    ref.watch(kvStoreProvider),
    ref.watch(communityIndexProvider),
  ),
);

/// The addon-order store: order backups, the display-order mirror, and the
/// account-collection save/verify flow behind the Organize page.
final addonOrderStoreProvider = Provider<AddonOrderStore>(
  (ref) => AddonOrderStore(ref.watch(kvStoreProvider)),
);

/// The top movers by recent star gain, recording a fresh snapshot first. Ported
/// from `useTopMovers`.
final moversProvider = FutureProvider.family<List<MoverEntry>, int>((
  ref,
  limit,
) async {
  final store = ref.watch(addonsVelocityStoreProvider);
  await store.recordSnapshot();
  return store.computeMovers(limit);
});

/// The rising board, or an empty list when the site is unreachable.
final risingProvider = FutureProvider<List<SARisingAddon>>((ref) async {
  try {
    return await ref.watch(stremioAddonsClientProvider).listRising();
  } catch (_) {
    return const [];
  }
});

/// The posters that back the Torrentio hero mosaic — the first 24 Cinemeta
/// Top-Movies posters. Ported from `loadCinemetaPosters`; kept alive so the art
/// loads once and stays cached for the life of the session, and yields an empty
/// list when Cinemeta is unreachable rather than surfacing an error.
final cinemetaPostersProvider = FutureProvider<List<String>>((ref) async {
  ref.keepAlive();
  try {
    final metas = await cinemetaTop(ref.watch(addonClientProvider), 'movie');
    return [
      for (final m in metas)
        if (m.poster != null && m.poster!.isNotEmpty) m.poster!,
    ].take(24).toList();
  } catch (_) {
    return const [];
  }
});

/// The browse category chips — the site categories, falling back to the sixteen
/// defaults so the row is never empty. Ported from `useCategories`; consumers
/// read `.value ?? kDefaultSaCategories` for the loading window.
final categoriesProvider = FutureProvider<List<SACategory>>((ref) async {
  final cats = await ref.watch(stremioAddonsClientProvider).listCategories();
  return cats.isNotEmpty ? cats : kDefaultSaCategories;
});

/// The Community-ratings rail data: the top 24 stremio-addons.net addons for a
/// sort mode (`stars` or `createdAt`), newest/highest first, excluding NSFW.
/// Ported from `CommunityAddonsRail`'s fetch; surfaces the site error verbatim
/// via [AsyncError] so the rail can show its reachability notice.
final communityAddonsRailProvider =
    FutureProvider.family<List<SAAddon>, String>((ref, sortBy) async {
      final res = await ref
          .watch(stremioAddonsClientProvider)
          .listAddons(
            ListParams(
              limit: 24,
              sortBy: sortBy,
              order: 'desc',
              nsfw: 'exclude',
            ),
          );
      return res.addons;
    });

/// The community-index entry for a manifest id, building the index on demand.
/// Resolves to null when the index cannot be built.
final communityForProvider = FutureProvider.family<SACommunity?, String>((
  ref,
  manifestId,
) async {
  final index = ref.watch(communityIndexProvider);
  try {
    await index.ensureIndex();
  } catch (_) {
    return null;
  }
  return index.communityFor(manifestId);
});

/// The reconciled addon catalog — the curated set, the user's Stremio
/// collection, Harbor's local installs, and the community index merged into one
/// id-keyed map. Re-runs when the installs, session, or adult setting change.
final addonsCatalogProvider = FutureProvider<AddonCatalog>((ref) async {
  final transport = ref.watch(jsonTransportProvider);
  final adultsAllowed = ref.watch(
    settingsProvider.select((s) => s.getBool('showAdultAddons')),
  );

  final local = await resolveInstalledAddons(
    ref.watch(installedAddonsProvider),
    transport,
  );

  // Await the session so the catalog is built once, after sign-in state is
  // known, rather than computed against a loading session and rebuilt.
  final authKey = (await ref.watch(stremioSessionProvider.future))?.authKey;
  var stremio = const <CommunityAddon>[];
  if (authKey != null && authKey.isNotEmpty) {
    final raw =
        (await ref.read(stremioApiProvider).addonCollectionGet(authKey))
            .valueOrNull ??
        const [];
    stremio = parseStremioCollection(raw);
  }

  return buildCatalog(
    localAddons: local,
    stremioAddons: stremio,
    saClient: ref.watch(stremioAddonsClientProvider),
    transport: transport,
    adultsAllowed: adultsAllowed,
  );
});

/// A curated Discover rail with the addons that populate it.
typedef DiscoverRail = ({CuratedRail rail, List<ResolvedAddon> items});

/// A resolved Discover hero — its curated entry and the catalog addon behind it.
typedef DiscoverHero = ({CuratedEntry entry, ResolvedAddon resolved});

/// The Discover tab's data: the featured hero, the populated curated rails, the
/// installed-id set and the current auth key (which gates the sign-in banner).
/// Ported from the `hero` / `railsData` memos in the web addons page.
class DiscoverData {
  const DiscoverData({
    required this.hero,
    required this.rails,
    required this.installedIds,
    required this.authKey,
  });

  final DiscoverHero? hero;
  final List<DiscoverRail> rails;
  final Set<String> installedIds;
  final String? authKey;
}

/// Builds the Discover tab data over the reconciled catalog: the hero entry (if
/// its addon is present), and every curated rail that has at least one addon.
final discoverDataProvider = FutureProvider<DiscoverData>((ref) async {
  final catalog = await ref.watch(addonsCatalogProvider.future);
  final byId = catalog.byId;

  final h = heroEntry();
  final heroAddon = h == null ? null : byId[h.id];
  final hero = (h != null && heroAddon != null)
      ? (entry: h, resolved: heroAddon)
      : null;

  final rails = <DiscoverRail>[];
  for (final rail in kCuratedRails) {
    final items = buildRail(byId, rail.id);
    if (items.isNotEmpty) rails.add((rail: rail, items: items));
  }

  final authKey = (await ref.watch(stremioSessionProvider.future))?.authKey;
  return DiscoverData(
    hero: hero,
    rails: rails,
    installedIds: catalog.installedIds,
    authKey: authKey,
  );
});

/// The installed addons resolved to their catalog entries, ordered by the saved
/// display order then the install order. Ported from the `installed` memo in the
/// web addons page (rank by `loadDisplayOrder` ++ install sequence).
final installedResolvedProvider = FutureProvider<List<ResolvedAddon>>((
  ref,
) async {
  final catalog = await ref.watch(addonsCatalogProvider.future);
  final installOrder = ref.watch(installedAddonsProvider);
  final displayOrder = ref.watch(addonOrderStoreProvider).loadDisplayOrder();

  final rank = <String, int>{};
  var i = 0;
  for (final url in [
    ...displayOrder,
    ...installOrder.map((a) => a.transportUrl),
  ]) {
    rank.putIfAbsent(url, () => i++);
  }

  final installed = [
    for (final r in catalog.byId.values)
      if (r.installed) r,
  ];
  const unranked = 1 << 30;
  installed.sort(
    (a, b) => (rank[a.transportUrl] ?? unranked).compareTo(
      rank[b.transportUrl] ?? unranked,
    ),
  );
  return installed;
});

/// The addon-detail view's data: the resolved target plus its related and
/// recommended rails. Ported from `RemoteOrLocalDetail`'s resolution.
class AddonDetailData {
  const AddonDetailData({
    required this.resolved,
    required this.related,
    required this.recommended,
  });

  final ResolvedAddon resolved;
  final List<ResolvedAddon> related;
  final List<ResolvedAddon> recommended;
}

/// Resolves one addon for its detail view: the entry from the merged catalog,
/// or — when it is not in the catalog — the community index plus a fresh
/// `getAddon`. Computes the related and recommended rails over the catalog.
/// Ported 1:1 from `RemoteOrLocalDetail`. Resolves to null when a non-catalog
/// addon cannot be found remotely (the view treats that as a cancel).
final addonDetailProvider = FutureProvider.family<AddonDetailData?, String>((
  ref,
  id,
) async {
  final catalog = await ref.watch(addonsCatalogProvider.future);
  final all = catalog.byId.values.toList();
  final installedIds = catalog.installedIds;

  var resolved = catalog.byId[id];
  if (resolved == null) {
    final index = ref.watch(communityIndexProvider);
    try {
      await index.ensureIndex();
    } catch (_) {
      // Fall through to the null lookup below.
    }
    final community = index.communityFor(id);
    if (community == null) return null;
    try {
      final detail = await ref
          .watch(stremioAddonsClientProvider)
          .getAddon(community.slug);
      resolved = ResolvedAddon(
        manifest: detail.manifest,
        transportUrl: detail.manifestUrl,
        source: AddonSource.community,
        installed: installedIds.contains(id),
      );
    } catch (_) {
      return null;
    }
  }

  final related = relatedAddons(resolved, all);
  final exclude = <String>{for (final r in related) resolvedAddonId(r), id};
  final recommended = recommendedAddons(resolved, all, installedIds, exclude);
  return AddonDetailData(
    resolved: resolved,
    related: related,
    recommended: recommended,
  );
});

/// Debounced query for the addon-catalog search — each matching catalog fires an
/// HTTP request, so it runs ~0.5s after the last keystroke, not on every one.
final _searchAddonQueryProvider = FutureProvider.autoDispose<String>((ref) {
  final q = ref.watch(searchQueryProvider);
  final completer = Completer<String>();
  final timer = Timer(
    const Duration(milliseconds: 500),
    () => completer.complete(q),
  );
  ref.onDispose(timer.cancel);
  return completer.future;
});

/// Search hits from every installed addon's `search`-capable movie/series
/// catalogs (web `searchAddonCatalogs`) — fetched in parallel, merged + deduped
/// by id. Empty when no addon declares a search catalog, or best-effort on
/// failure. Capped at 12 catalogs × 12 metas.
final searchAddonCatalogsProvider =
    FutureProvider.autoDispose<List<MetaPreview>>((ref) async {
      final q = (await ref.watch(_searchAddonQueryProvider.future)).trim();
      if (q.length < 2) return const [];
      final addons = ref.watch(installedAddonsProvider);
      final client = ref.watch(addonClientProvider);
      final targets = <({String base, String type, String id})>[];
      for (final a in addons) {
        final manifest = a.manifest;
        if (manifest == null) continue;
        for (final c in manifest.catalogs) {
          if (c.type != 'movie' && c.type != 'series') continue;
          if (!c.extra.any((e) => e.name == 'search')) continue;
          targets.add((base: addonBase(a.transportUrl), type: c.type, id: c.id));
          if (targets.length >= 12) break;
        }
        if (targets.length >= 12) break;
      }
      if (targets.isEmpty) return const [];
      final lists = await Future.wait(
        targets.map((t) async {
          try {
            final metas =
                (await client.catalog(
                  t.base,
                  t.type,
                  t.id,
                  extras: [CatalogExtra('search', q)],
                )).valueOrNull ??
                const <MetaPreview>[];
            return metas.take(12).toList();
          } catch (_) {
            return const <MetaPreview>[];
          }
        }),
      );
      final out = <MetaPreview>[];
      final seen = <String>{};
      for (final list in lists) {
        for (final m in list) {
          if (m.id.isEmpty || !seen.add(m.id)) continue;
          out.add(m);
        }
      }
      return out;
    });
