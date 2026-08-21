import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Secure storage for secrets — the Stremio authKey, debrid/API keys, and IPTV
/// credentials. Backed by the platform keychain/keystore; never plaintext prefs.
/// See `docs/80-security.md`.
abstract interface class SecureStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

/// In-memory implementation for tests (a real Map-backed store, not a mock).
class MemorySecureStore implements SecureStore {
  final Map<String, String> _map = {};

  @override
  Future<String?> read(String key) async => _map[key];

  @override
  Future<void> write(String key, String value) async => _map[key] = value;

  @override
  Future<void> delete(String key) async => _map.remove(key);
}

/// Platform keychain/keystore implementation.
class FlutterSecureStore implements SecureStore {
  FlutterSecureStore([FlutterSecureStorage? storage])
    : _storage =
          storage ??
          const FlutterSecureStorage(
            iOptions: IOSOptions(
              accessibility: KeychainAccessibility.first_unlock,
            ),
          );

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}
