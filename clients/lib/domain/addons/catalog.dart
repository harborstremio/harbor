import '../../core/http/json_transport.dart';
import 'addon_name.dart';
import 'classify.dart';
import 'community_catalog.dart';
import 'curated.dart';
import 'models.dart';
import 'resolved_addon.dart';
import 'stremio_addons_client.dart';

/// The reconciled addon catalog — every addon keyed by its real manifest id,
/// plus the set of installed ids. Ported from `useAddonsCatalog`'s return.
class AddonCatalog {
  const AddonCatalog({required this.byId, required this.installedIds});

  final Map<String, ResolvedAddon> byId;
  final Set<String> installedIds;
}

/// Addons that are always hidden from the catalog, ported from
/// `ALWAYS_HIDDEN_IDS`.
const _alwaysHiddenIds = {'org.stremio.opensubtitles', 'com.opensubtitles.v3'};

/// A mutable working entry — the merge pipeline mutates in place exactly as the
/// web does, then converts to an immutable [ResolvedAddon] at the end.
class _Entry {
  _Entry({
    this.curated,
    this.manifest,
    required this.transportUrl,
    required this.source,
    required this.installed,
  });

  CuratedEntry? curated;
  Manifest? manifest;
  String transportUrl;
  AddonSource source;
  bool installed;

  ResolvedAddon toResolved() => ResolvedAddon(
    curated: curated,
    manifest: manifest,
    transportUrl: transportUrl,
    source: source,
    installed: installed,
  );
}

/// Reconciles the curated catalog, the user's Stremio collection, Harbor's local
/// installs, and the community index into a single id-keyed map. Ported 1:1 from
/// the `useAddonsCatalog` merge pipeline.
///
/// [localAddons] are Harbor's local installs and [stremioAddons] the user's
/// Stremio collection, both as `{ transportUrl, manifest }`. [saClient] supplies
/// the star-ranked community list; [transport] fetches the community directories
/// and any curated manifests still missing.
Future<AddonCatalog> buildCatalog({
  required List<CommunityAddon> localAddons,
  required List<CommunityAddon> stremioAddons,
  required StremioAddonsClient saClient,
  required JsonTransport transport,
  required bool adultsAllowed,
}) async {
  final installed = <String>{
    for (final a in localAddons) a.manifest.id,
    for (final a in stremioAddons) a.manifest.id,
  };

  final map = <String, _Entry>{};

  // 1. Seed with the curated catalog.
  for (final e in kCuratedAddons) {
    map[e.id] = _Entry(
      curated: e,
      transportUrl: e.transportUrl,
      source: AddonSource.curated,
      installed: installed.contains(e.id),
    );
  }

  // 2. Overlay the Stremio collection, then the local installs.
  for (final a in stremioAddons) {
    final existing = map[a.manifest.id];
    map[a.manifest.id] = _Entry(
      curated: existing?.curated,
      manifest: a.manifest,
      transportUrl: a.transportUrl,
      source: existing?.source ?? AddonSource.stremioUser,
      installed: true,
    );
  }
  for (final a in localAddons) {
    final existing = map[a.manifest.id];
    map[a.manifest.id] = _Entry(
      curated: existing?.curated,
      manifest: a.manifest,
      transportUrl: a.transportUrl,
      source: existing?.source ?? AddonSource.harborLocal,
      installed: true,
    );
  }

  // 3. The community sources: the star-ranked site list and the directories.
  List<CommunityAddon> saList;
  try {
    final res = await saClient.listAddons(
      const ListParams(limit: 200, sortBy: 'stars', order: 'desc'),
    );
    saList = [
      for (final a in res.addons)
        if (a.manifest != null)
          CommunityAddon(transportUrl: a.manifestUrl, manifest: a.manifest!),
    ];
  } catch (_) {
    saList = const [];
  }
  final community = await fetchCommunityAddons(transport);

  final saIds = <String>{};
  final saManifestById = <String, Manifest>{};
  for (final a in saList) {
    final id = a.manifest.id;
    if (id.isNotEmpty) {
      saIds.add(id);
      saManifestById[id] = a.manifest;
    }
  }

  // SA-first dedupe of the combined community pool by manifest id.
  final mergedCommunity = <CommunityAddon>[];
  final seenCommunity = <String>{};
  for (final a in [...saList, ...community]) {
    final id = a.manifest.id;
    if (id.isEmpty || !seenCommunity.add(id)) continue;
    mergedCommunity.add(a);
  }

  // 4. Reconcile the community pool against the map, re-keying by transportUrl.
  final byTransportUrl = <String, String>{};
  for (final e in map.entries) {
    byTransportUrl[e.value.transportUrl.toLowerCase()] = e.key;
  }
  for (final a in mergedCommunity) {
    final realId = a.manifest.id;
    final url = a.transportUrl;
    final existingIdByUrl = byTransportUrl[url.toLowerCase()];
    if (existingIdByUrl != null && existingIdByUrl != realId) {
      final existing = map[existingIdByUrl]!;
      map.remove(existingIdByUrl);
      map[realId] = _Entry(
        curated: existing.curated,
        manifest: a.manifest,
        transportUrl: url,
        source: existing.source,
        installed: existing.installed || installed.contains(realId),
      );
      byTransportUrl[url.toLowerCase()] = realId;
      continue;
    }
    if (!map.containsKey(realId)) {
      map[realId] = _Entry(
        manifest: a.manifest,
        transportUrl: url,
        source: AddonSource.community,
        installed: installed.contains(realId),
      );
      byTransportUrl[url.toLowerCase()] = realId;
    } else {
      map[realId]!.manifest ??= a.manifest;
    }
  }

  // 5. Fetch the manifests of curated entries the community did not fill.
  final needing = [
    for (final e in map.values)
      if (e.manifest == null && e.source == AddonSource.curated) e,
  ];
  await Future.wait([
    for (final e in needing)
      fetchAddonManifest(transport, e.transportUrl).then((m) {
        if (m != null) e.manifest = m;
      }),
  ]);

  // 6. Re-key every entry by its real manifest id, merging on collision.
  final reKeyed = <String, _Entry>{};
  for (final e in map.entries) {
    final oldKey = e.key;
    final r = e.value;
    final realId = r.manifest?.id;
    if (realId == null || realId.isEmpty || realId == oldKey) {
      reKeyed[oldKey] = r;
      continue;
    }
    final existing = reKeyed[realId];
    if (existing != null) {
      existing.curated ??= r.curated;
      existing.installed =
          existing.installed || r.installed || installed.contains(realId);
      existing.manifest ??= r.manifest;
    } else {
      reKeyed[realId] = _Entry(
        curated: r.curated,
        manifest: r.manifest,
        transportUrl: r.transportUrl,
        source: r.source,
        installed: r.installed || installed.contains(realId),
      );
    }
  }
  map
    ..clear()
    ..addAll(reKeyed);

  // 7. Enrich each entry's manifest with the site metadata.
  for (final e in map.entries) {
    final sa = saManifestById[e.key];
    final m = e.value.manifest;
    if (sa == null || m == null) continue;
    e.value.manifest = Manifest({
      ...m.json,
      'name': sa.name ?? m.name,
      'logo': m.logo ?? sa.logo,
      'description': sa.description ?? m.description,
      'background': m.background ?? sa.background,
    });
  }

  // 8. Collapse duplicates that share a normalized name.
  final byNorm = <String, List<String>>{};
  for (final e in map.entries) {
    final norm = normalizeAddonName(e.value.manifest?.name);
    if (norm.isEmpty) continue;
    (byNorm[norm] ??= []).add(e.key);
  }
  for (final ids in byNorm.values) {
    if (ids.length <= 1) continue;
    final installedInBucket = [
      for (final id in ids)
        if (map[id]?.installed == true) id,
    ];
    if (installedInBucket.isNotEmpty) {
      for (final id in ids) {
        if (map[id]?.installed != true) map.remove(id);
      }
      continue;
    }
    final curatedIds = [
      for (final id in ids)
        if (map[id]?.curated != null) id,
    ];
    final saIdsHit = [
      for (final id in ids)
        if (saIds.contains(id)) id,
    ];
    final winner = curatedIds.isNotEmpty
        ? curatedIds.first
        : (saIdsHit.isNotEmpty ? saIdsHit.first : ids.first);
    for (final id in ids) {
      if (id != winner) map.remove(id);
    }
  }

  // 9. Strip the always-hidden ids and, when disallowed, the adult addons.
  for (final id in _alwaysHiddenIds) {
    map.remove(id);
  }
  if (!adultsAllowed) {
    map.removeWhere((_, e) => isAdultAddon(e.toResolved()));
  }

  return AddonCatalog(
    byId: {for (final e in map.entries) e.key: e.value.toResolved()},
    installedIds: installed,
  );
}
