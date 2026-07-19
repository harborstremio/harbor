import 'package:hive_ce_flutter/hive_flutter.dart';

/// A string keyed-value store mirroring the web app's `localStorage` model:
/// Harbor persists JSON blobs under `harbor.*` keys, and clientv2 keeps the same
/// keys/shapes so a Stremio account round-trips. Non-secret data only — secrets
/// go through [SecureStore] (see `secure_store.dart`).
abstract interface class KvStore {
  String? getString(String key);
  Future<void> setString(String key, String value);
  Future<void> remove(String key);
  bool contains(String key);
  Iterable<String> keys();

  /// Physically rewrites the backing store, dropping the append-only residue
  /// frames left by prior deletes/overwrites. Called after a legacy plaintext
  /// secret is migrated out so the old value can't be recovered from disk.
  Future<void> compact();
}

/// In-memory store. A real, complete implementation (not a mock) used for tests
/// and any ephemeral context.
class MemoryKvStore implements KvStore {
  MemoryKvStore([Map<String, String>? initial]) : _map = {...?initial};

  final Map<String, String> _map;

  @override
  String? getString(String key) => _map[key];

  @override
  Future<void> setString(String key, String value) async => _map[key] = value;

  @override
  Future<void> remove(String key) async => _map.remove(key);

  @override
  bool contains(String key) => _map.containsKey(key);

  @override
  Iterable<String> keys() => _map.keys;

  @override
  Future<void> compact() async {}
}

/// Hive-backed persistent store for the `harbor.*` JSON blobs.
class HiveKvStore implements KvStore {
  HiveKvStore._(this._box);

  final Box<String> _box;

  static Future<HiveKvStore> open(String boxName) async {
    await Hive.initFlutter();
    final box = await Hive.openBox<String>(boxName);
    return HiveKvStore._(box);
  }

  @override
  String? getString(String key) => _box.get(key);

  @override
  Future<void> setString(String key, String value) => _box.put(key, value);

  @override
  Future<void> remove(String key) => _box.delete(key);

  @override
  bool contains(String key) => _box.containsKey(key);

  @override
  Iterable<String> keys() => _box.keys.cast<String>();

  @override
  Future<void> compact() => _box.compact();
}
