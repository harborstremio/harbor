import '../../core/http/json_transport.dart';
import 'models.dart';

/// Cinemeta's addon directories (community + official), each a
/// `{ addons: [{ transportUrl, manifest }] }` catalog.
const _stremioDirectories = [
  'https://v3-cinemeta.strem.io/addon_catalog/all/community.json',
  'https://v3-cinemeta.strem.io/addon_catalog/all/official.json',
];

/// The Stremio flat official-collection endpoint, returned either as a bare
/// array or wrapped in `{ addons }`.
const _stremioFlatDirectory =
    'https://api.strem.io/addonsofficialcollection.json';

/// Fetches the union of the Stremio addon directories, de-duped by manifest id.
/// This is the keyless community source the browse/discover panes fall back to.
/// Ported 1:1 from `fetchCommunityAddons`.
Future<List<CommunityAddon>> fetchCommunityAddons(
  JsonTransport transport,
) async {
  final lists = await Future.wait([
    for (final url in _stremioDirectories) _fetchCatalog(transport, url),
    _fetchFlatCollection(transport, _stremioFlatDirectory),
  ]);
  final out = <CommunityAddon>[];
  final seen = <String>{};
  for (final list in lists) {
    for (final a in list) {
      final id = a.manifest.id;
      if (id.isEmpty || !seen.add(id)) continue;
      out.add(a);
    }
  }
  return out;
}

/// Fetches a single addon's live manifest, ported from `fetchManifest`. Returns
/// null on any failure (offline addon, non-2xx, malformed JSON).
Future<Manifest?> fetchAddonManifest(
  JsonTransport transport,
  String transportUrl,
) async {
  try {
    final res = await transport.getJson(
      transportUrl,
      headers: const {'Accept': 'application/json'},
    );
    if (!res.ok) return null;
    final data = res.data;
    return data is Map ? Manifest(data.cast<String, dynamic>()) : null;
  } on TransportException {
    return null;
  }
}

/// A `{ addons: [...] }` directory catalog; empty on any failure.
Future<List<CommunityAddon>> _fetchCatalog(
  JsonTransport transport,
  String url,
) async {
  try {
    final res = await transport.getJson(
      url,
      headers: const {'Accept': 'application/json'},
    );
    if (!res.ok) return const [];
    final data = res.data;
    if (data is! Map) return const [];
    return _parseEntries(data['addons']);
  } on TransportException {
    return const [];
  }
}

/// The flat collection, returned as a bare array or `{ addons: [...] }`; empty
/// on any failure.
Future<List<CommunityAddon>> _fetchFlatCollection(
  JsonTransport transport,
  String url,
) async {
  try {
    final res = await transport.getJson(
      url,
      headers: const {'Accept': 'application/json'},
    );
    if (!res.ok) return const [];
    final data = res.data;
    if (data is List) return _parseEntries(data);
    if (data is Map) return _parseEntries(data['addons']);
    return const [];
  } on TransportException {
    return const [];
  }
}

/// Parses a raw addons array into [CommunityAddon]s, skipping entries without a
/// transportUrl or a manifest object.
List<CommunityAddon> _parseEntries(Object? raw) {
  if (raw is! List) return const [];
  final out = <CommunityAddon>[];
  for (final e in raw) {
    if (e is! Map) continue;
    final transportUrl = e['transportUrl'];
    final manifest = e['manifest'];
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
