import '../../core/http/json_transport.dart';
import 'community_catalog.dart';
import 'models.dart';

/// Resolves Harbor's local installs into `{ transportUrl, manifest }` records for
/// the catalog merge, ported from `fetchInstalledAddons`: entries that already
/// carry a manifest are used directly; the rest have their manifest fetched, and
/// any whose fetch fails are dropped.
Future<List<CommunityAddon>> resolveInstalledAddons(
  List<InstalledAddon> installed,
  JsonTransport transport,
) async {
  final results = await Future.wait(
    installed.map((e) async {
      final m = e.manifest;
      if (m != null) {
        return CommunityAddon(transportUrl: e.transportUrl, manifest: m);
      }
      final fetched = await fetchAddonManifest(transport, e.transportUrl);
      return fetched == null
          ? null
          : CommunityAddon(transportUrl: e.transportUrl, manifest: fetched);
    }),
  );
  return [for (final a in results) ?a];
}

/// Parses the Stremio `addonCollectionGet` result into `{ transportUrl, manifest
/// }` records for the catalog merge, skipping entries without a transportUrl or a
/// manifest object.
List<CommunityAddon> parseStremioCollection(List<dynamic> raw) {
  final out = <CommunityAddon>[];
  for (final a in raw) {
    if (a is! Map) continue;
    final transportUrl = a['transportUrl'];
    final manifest = a['manifest'];
    if (transportUrl is! String || transportUrl.isEmpty) continue;
    if (manifest is! Map) continue;
    out.add(
      CommunityAddon(
        transportUrl: transportUrl,
        manifest: Manifest(manifest.cast<String, dynamic>()),
      ),
    );
  }
  return out;
}
