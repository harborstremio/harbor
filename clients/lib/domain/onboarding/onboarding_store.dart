import 'dart:convert';

import '../../core/storage/kv_store.dart';

/// Persists which one-time onboarding nudges the user has dismissed
/// (`harbor.onboarding.dismissed.v1`). Ported from the web `useOnboarding`
/// `isDismissed` / `dismiss`.
class OnboardingStore {
  OnboardingStore(this._kv);
  static const _key = 'harbor.onboarding.dismissed.v1';
  final KvStore _kv;

  Set<String> dismissed() {
    final raw = _kv.getString(_key);
    if (raw == null || raw.isEmpty) return <String>{};
    try {
      final p = jsonDecode(raw);
      if (p is List) {
        return {
          for (final e in p)
            if (e is String) e,
        };
      }
    } catch (_) {
      // Corrupt payload → treat as nothing dismissed.
    }
    return <String>{};
  }

  bool isDismissed(String key) => dismissed().contains(key);

  Future<void> dismiss(String key) async {
    final set = dismissed()..add(key);
    await _kv.setString(_key, jsonEncode(set.toList()));
  }
}
