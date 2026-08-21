import 'dart:convert';

import '../../core/storage/kv_store.dart';
import '../../core/storage/secure_store.dart';
import '../profiles/profiles_repository.dart';
import 'load_settings.dart';
import 'settings.dart';

/// The settings fields that hold secrets — debrid keys, metadata/AI/subtitle API
/// keys, and OAuth tokens/secrets. These are kept out of the plaintext settings
/// blob and stored in the platform keychain/keystore instead
/// (`docs/80-security.md`). A field added here migrates on the next save: the
/// plaintext value is read once, written to the keychain, and blanked from prefs.
const kSecretSettingKeys = <String>{
  // Debrid provider API keys.
  'rdKey',
  'tbKey',
  'adKey',
  'pmKey',
  'dlKey',
  // Metadata / artwork provider API keys.
  'tmdbKey',
  'mdblistKey',
  'omdbKey',
  'rpdbKey',
  'fanartKey',
  'tvdbKey',
  // AI provider API keys / deploy tokens.
  'aiSearchKey',
  'aiGroqKey',
  'jinaKey',
  'togetherCfToken',
  // Subtitle / music provider API keys.
  'opensubtitlesApiKey',
  'jimakuToken',
  'auddKey',
  // Trakt OAuth: the app-secret and the token migration-fallback fields (a
  // token/secret pasted into settings).
  'traktClientSecret',
  'traktAccessToken',
  'traktRefreshToken',
};

/// Non-string secret fields whose value (a list/map carrying credentials) is
/// stored in the keychain as a JSON string, then blanked in the plaintext blob.
/// `iptvPlaylists` embeds Xtream usernames/passwords in its stream/EPG URLs.
const kSecretJsonSettingKeys = <String>{'iptvPlaylists'};

/// Loads and persists the effective settings, matching Harbor's
/// `profile-store.ts` exactly (`docs/20` §1.3–1.6):
///
/// - **loadEffective** precedence: the active profile's source key →
///   `harbor.settings.shared` → `harbor.settings` (mirror) → defaults.
/// - **persistEffective** writes the serialized blob to BOTH the mirror and the
///   active source key.
/// - **forced-on-load overrides** are re-applied every load regardless of the
///   stored value (`subProvidersEnabled.wyzie=false`, `.opensubtitles=true`).
/// - **serialize** drops `theme.backgroundImage` (it lives outside the JSON).
class SettingsRepository {
  SettingsRepository(
    this._kv,
    this._profiles,
    this._secure, {
    this.deviceUiLanguage,
  });

  final KvStore _kv;
  final ProfilesRepository _profiles;
  final SecureStore _secure;

  /// The device's OS language code (or null), injected from the app layer so
  /// the pure domain stays Flutter-free. Used to default the interface
  /// language on first run.
  final String? deviceUiLanguage;

  static const _legacySeekBackKey = 'harbor.seek-step.back';
  static const _legacySeekForwardKey = 'harbor.seek-step.forward';
  static String _secureKey(String field) => 'harbor.secret.$field';

  Settings loadEffective() {
    final stored =
        _readJson(_profiles.settingsSourceKey()) ??
        _readJson(ProfilesRepository.sharedSettingsKey) ??
        _readJson(ProfilesRepository.mirrorSettingsKey);
    return loadStoredSettings(
      stored,
      legacySeekBack: _kv.getString(_legacySeekBackKey),
      legacySeekForward: _kv.getString(_legacySeekForwardKey),
      deviceUiLanguage: deviceUiLanguage,
    );
  }

  /// Reads the secret fields back from secure storage — merged onto the
  /// effective settings after the (synchronous) plaintext load. String secrets
  /// come back as strings; JSON secrets are decoded to their list/map value.
  Future<Map<String, Object>> loadSecrets() async {
    final out = <String, Object>{};
    for (final field in kSecretSettingKeys) {
      final v = await _secure.read(_secureKey(field));
      if (v != null && v.isNotEmpty) out[field] = v;
    }
    for (final field in kSecretJsonSettingKeys) {
      final v = await _secure.read(_secureKey(field));
      if (v == null || v.isEmpty) continue;
      try {
        out[field] = jsonDecode(v) as Object;
      } catch (_) {
        /* corrupt secret — ignore */
      }
    }
    return out;
  }

  Future<void> persistEffective(Settings settings) async {
    final map = _serialize(settings);
    // Split secrets into the keychain; blank them in the plaintext blob so no
    // credential is ever written to SharedPreferences (docs/80-security.md).
    for (final field in kSecretSettingKeys) {
      final v = map[field];
      if (v is String && v.isNotEmpty) {
        await _secure.write(_secureKey(field), v);
        map[field] = '';
      } else {
        await _secure.delete(_secureKey(field));
      }
    }
    // The same for credential-bearing list/map fields, stored as JSON.
    for (final field in kSecretJsonSettingKeys) {
      final v = map[field];
      final hasValue =
          (v is List && v.isNotEmpty) || (v is Map && v.isNotEmpty);
      if (hasValue) {
        await _secure.write(_secureKey(field), jsonEncode(v));
        map[field] = (v is List)
            ? const <dynamic>[]
            : const <String, dynamic>{};
      } else {
        await _secure.delete(_secureKey(field));
      }
    }
    final json = jsonEncode(map);
    await _kv.setString(ProfilesRepository.mirrorSettingsKey, json);
    await _kv.setString(_profiles.settingsSourceKey(), json);
  }

  Map<String, dynamic>? _readJson(String key) {
    final raw = _kv.getString(key);
    if (raw == null || raw.isEmpty) return null;
    try {
      return (jsonDecode(raw) as Map).cast<String, dynamic>();
    } catch (_) {
      return null;
    }
  }

  Map<String, dynamic> _serialize(Settings s) {
    final map = {...s.toJson()};
    final theme = map['theme'];
    if (theme is Map) {
      final t = Map<String, dynamic>.from(theme)..remove('backgroundImage');
      map['theme'] = t;
    }
    return map;
  }
}
