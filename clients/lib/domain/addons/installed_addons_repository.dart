import 'dart:convert';

import '../../core/result.dart';
import '../../core/storage/kv_store.dart';
import 'models.dart';

/// Persists the user's installed addons and their disabled/order state, matching
/// Harbor's keys (`docs/30`): `harbor.installed-addons`, `harbor.addons.disabled`,
/// `harbor.addonOrder`. Add-by-URL normalization is transcribed from
/// `addon-store.ts`.
class InstalledAddonsRepository {
  InstalledAddonsRepository(this._kv);

  final KvStore _kv;

  static const installedKey = 'harbor.installed-addons';
  static const disabledKey = 'harbor.addons.disabled';
  static const orderKey = 'harbor.addonOrder';

  List<InstalledAddon> load() {
    final raw = _kv.getString(installedKey);
    if (raw == null || raw.isEmpty) return [];
    try {
      final list = jsonDecode(raw) as List;
      return list
          .whereType<Map>()
          .map((e) => InstalledAddon.fromJson(e.cast<String, dynamic>()))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> save(List<InstalledAddon> addons) => _kv.setString(
    installedKey,
    jsonEncode(addons.map((a) => a.toJson()).toList()),
  );

  /// Merges [incoming] add-ons in, keeping every existing one and appending any
  /// whose transportUrl is new. Used to pull the Stremio add-on collection on
  /// sign-in. Returns the resulting list.
  Future<List<InstalledAddon>> merge(List<InstalledAddon> incoming) async {
    final current = load();
    final have = {for (final a in current) a.transportUrl};
    final added = [
      for (final a in incoming)
        if (!have.contains(a.transportUrl)) a,
    ];
    if (added.isEmpty) return current;
    final next = [...current, ...added];
    await save(next);
    return next;
  }

  Set<String> loadDisabled() {
    final raw = _kv.getString(disabledKey);
    if (raw == null || raw.isEmpty) return {};
    try {
      return (jsonDecode(raw) as List).map((e) => e.toString()).toSet();
    } catch (_) {
      return {};
    }
  }

  Future<void> saveDisabled(Set<String> ids) =>
      _kv.setString(disabledKey, jsonEncode(ids.toList()));

  /// Flips [transportUrl]'s disabled state and returns the updated set.
  Future<Set<String>> toggleDisabled(String transportUrl) async {
    final set = {...loadDisabled()};
    if (!set.add(transportUrl)) set.remove(transportUrl);
    await saveDisabled(set);
    return set;
  }

  /// Drops disabled entries no longer in [keepTransportUrls] (post-uninstall).
  Future<Set<String>> pruneDisabled(Set<String> keepTransportUrls) async {
    final set = loadDisabled();
    final next = set.intersection(keepTransportUrls);
    if (next.length != set.length) await saveDisabled(next);
    return next;
  }

  /// Normalize a pasted manifest URL / stremio:// link. Returns the canonical
  /// `https://…/manifest.json`, or an [Err] with the user-facing message.
  Result<String> normalizeAddonUrl(String input) {
    var raw = input.trim();
    if (raw.isEmpty) {
      return const Err(Failure('Paste a manifest URL or stremio:// link.'));
    }
    if (raw.startsWith('stremio://')) {
      raw = 'https://${raw.substring('stremio://'.length)}';
    }
    raw = raw.replaceFirst(RegExp(r'/#/configure/?$'), '');
    raw = raw.replaceFirst(RegExp(r'/configure/?$'), '');
    raw = raw.replaceFirst(RegExp(r'/+$'), '');
    if (!raw.startsWith('https://')) {
      return const Err(Failure('URL must start with https:// or stremio://'));
    }
    if (!RegExp(
      r'manifest\.json(\?.*)?$',
      caseSensitive: false,
    ).hasMatch(raw)) {
      raw = '$raw/manifest.json';
    }
    return Ok(raw);
  }

  /// Install (or move-to-front) an addon by its normalized transportUrl,
  /// optionally with its fetched manifest. De-dupes by transportUrl.
  Future<InstalledAddon> install(
    String transportUrl, {
    Manifest? manifest,
    required int installedAt,
  }) async {
    final list = load()..removeWhere((a) => a.transportUrl == transportUrl);
    final entry = InstalledAddon(
      id: manifest?.id.isNotEmpty == true ? manifest!.id : transportUrl,
      transportUrl: transportUrl,
      installedAt: installedAt,
      manifest: manifest,
    );
    list.add(entry);
    await save(list);
    return entry;
  }

  Future<void> uninstall(String transportUrl) async {
    final list = load()..removeWhere((a) => a.transportUrl == transportUrl);
    await save(list);
  }
}
