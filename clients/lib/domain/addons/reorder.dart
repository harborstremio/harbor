import 'dart:convert';

import '../../core/storage/kv_store.dart';

/// A raw Stremio collection addon (`transportUrl` + `manifest`), ported from the
/// web's `Addon`. Kept as its raw JSON map so save/verify compares by identity.
typedef CollectionAddon = Map<String, dynamic>;

/// Why a proposed reorder was rejected, ported from `ReorderInvalid`.
enum ReorderInvalid { empty, length, nullItem, urlMultiset, itemIdentity }

/// The stage a collection save is in, ported from `SaveStep`.
enum SaveStep { checking, saving, verifying }

/// The outcome of [AddonOrderStore.saveCollectionOrder], ported 1:1 from the
/// `SaveResult` union.
sealed class SaveResult {
  const SaveResult();
}

final class SaveSuccess extends SaveResult {
  const SaveSuccess(this.items);
  final List<CollectionAddon> items;
}

final class SaveValidateFailure extends SaveResult {
  const SaveValidateFailure(this.reason);
  final ReorderInvalid reason;
}

final class SaveFetchFailure extends SaveResult {
  const SaveFetchFailure();
}

final class SaveStaleFailure extends SaveResult {
  const SaveStaleFailure(this.current);
  final List<CollectionAddon> current;
}

final class SaveWriteFailure extends SaveResult {
  const SaveWriteFailure();
}

final class SaveVerifyFailure extends SaveResult {
  const SaveVerifyFailure(this.current);
  final List<CollectionAddon>? current;
}

/// The result of [validateReorder].
class ReorderValidation {
  const ReorderValidation.ok() : ok = true, reason = null;
  const ReorderValidation.invalid(ReorderInvalid this.reason) : ok = false;

  final bool ok;
  final ReorderInvalid? reason;
}

/// The host of [url], or the raw string when it cannot be parsed. Ported from
/// `hostOf`.
String hostOf(String url) {
  final uri = Uri.tryParse(url);
  if (uri == null || uri.host.isEmpty) return url;
  return uri.hasPort ? '${uri.host}:${uri.port}' : uri.host;
}

String? _urlOf(CollectionAddon a) {
  final u = a['transportUrl'];
  return u is String ? u : null;
}

String _nameOf(CollectionAddon a) {
  final m = a['manifest'];
  final n = m is Map ? m['name'] : null;
  return (n is String && n.isNotEmpty) ? n : hostOf(_urlOf(a) ?? '');
}

/// True when [a] and [b] hold the same string sequence. Ported from
/// `sequencesEqual`.
bool sequencesEqual(List<String> a, List<String> b) {
  if (a.length != b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (a[i] != b[i]) return false;
  }
  return true;
}

/// Returns [list] with the item at [from] moved to [to] (clamped in range),
/// leaving the original untouched. Returns the same list when it is a no-op.
/// Ported 1:1 from `moveItem`.
List<T> moveItem<T>(List<T> list, int from, int to) {
  final target = to < 0 ? 0 : (to > list.length - 1 ? list.length - 1 : to);
  if (from < 0 || from >= list.length || from == target) return list;
  final next = [...list];
  final item = next.removeAt(from);
  next.insert(target, item);
  return next;
}

/// Reorders [items] to follow [urls] (by [urlOf]); any item whose url is not in
/// [urls] is appended in its original order. Ported 1:1 from `applyOrderToItems`.
List<T> applyOrderToItems<T>(
  List<T> items,
  List<String> urls,
  String? Function(T) urlOf,
) {
  final used = List<bool>.filled(items.length, false);
  final out = <T>[];
  for (final url in urls) {
    for (var i = 0; i < items.length; i++) {
      if (!used[i] && urlOf(items[i]) == url) {
        used[i] = true;
        out.add(items[i]);
        break;
      }
    }
  }
  for (var i = 0; i < items.length; i++) {
    if (!used[i]) out.add(items[i]);
  }
  return out;
}

bool _urlCountsMatch(List<CollectionAddon> a, List<CollectionAddon> b) {
  if (a.length != b.length) return false;
  final counts = <String, int>{};
  for (final item in a) {
    final u = _urlOf(item) ?? '';
    counts[u] = (counts[u] ?? 0) + 1;
  }
  for (final item in b) {
    final u = _urlOf(item) ?? '';
    final c = counts[u] ?? 0;
    if (c == 0) return false;
    counts[u] = c - 1;
  }
  return true;
}

bool _bijectiveItemMatch(List<CollectionAddon> a, List<CollectionAddon> b) {
  if (a.length != b.length) return false;
  final aJson = [for (final x in a) jsonEncode(x)];
  final used = List<bool>.filled(a.length, false);
  for (final item in b) {
    final json = jsonEncode(item);
    var matched = false;
    for (var i = 0; i < a.length; i++) {
      if (used[i]) continue;
      if (identical(a[i], item) || aJson[i] == json) {
        used[i] = true;
        matched = true;
        break;
      }
    }
    if (!matched) return false;
  }
  return true;
}

/// Validates that [next] is a pure reordering of [original] — same length, every
/// item a real addon, same url multiset, and a one-to-one item match. Ported 1:1
/// from `validateReorder`.
ReorderValidation validateReorder(
  List<CollectionAddon> original,
  List<CollectionAddon> next,
) {
  if (original.isEmpty) {
    return const ReorderValidation.invalid(ReorderInvalid.empty);
  }
  if (next.length != original.length) {
    return const ReorderValidation.invalid(ReorderInvalid.length);
  }
  for (final item in next) {
    final u = item['transportUrl'];
    if (u is! String || u.isEmpty) {
      return const ReorderValidation.invalid(ReorderInvalid.nullItem);
    }
  }
  if (!_urlCountsMatch(original, next)) {
    return const ReorderValidation.invalid(ReorderInvalid.urlMultiset);
  }
  if (!_bijectiveItemMatch(original, next)) {
    return const ReorderValidation.invalid(ReorderInvalid.itemIdentity);
  }
  return const ReorderValidation.ok();
}

/// True when [fresh] is no longer a one-to-one match of [baseline] — the
/// collection changed underneath an in-progress reorder. Ported from
/// `collectionDrifted`.
bool collectionDrifted(
  List<CollectionAddon> baseline,
  List<CollectionAddon> fresh,
) => !_bijectiveItemMatch(baseline, fresh);

/// A saved snapshot of an addon order, ported from `AddonOrderBackup`.
class AddonOrderBackup {
  const AddonOrderBackup({
    required this.at,
    required this.urls,
    required this.names,
    this.items,
  });

  final int at;
  final List<String> urls;
  final List<String> names;
  final List<CollectionAddon>? items;

  Map<String, dynamic> toJson({bool includeItems = true}) => {
    'at': at,
    'urls': urls,
    'names': names,
    if (includeItems && items != null) 'items': items,
  };

  static AddonOrderBackup? fromJson(Object? j) {
    if (j is! Map) return null;
    final at = j['at'];
    final urls = j['urls'];
    final names = j['names'];
    if (at is! num || urls is! List || names is! List) return null;
    return AddonOrderBackup(
      at: at.toInt(),
      urls: urls.whereType<String>().toList(),
      names: names.whereType<String>().toList(),
      items: j['items'] is List
          ? [
              for (final e in (j['items'] as List))
                if (e is Map) e.cast<String, dynamic>(),
            ]
          : null,
    );
  }
}

/// The persistent home of addon-order backups and the display-order mirror, plus
/// the account-collection save/verify flow. Ported from the persistence and
/// `saveCollectionOrder` parts of `reorder.ts`. Inject [clock] for tests.
class AddonOrderStore {
  AddonOrderStore(this._kv, {DateTime Function() clock = DateTime.now})
    : _clock = clock;

  final KvStore _kv;
  final DateTime Function() _clock;

  int get _now => _clock().millisecondsSinceEpoch;

  static const _backupKey = 'harbor.addonOrderBackups';
  static const _orderKey = 'harbor.addonOrder';
  static const _maxBackups = 5;

  /// The stored order backups, newest first, or empty when none are readable.
  List<AddonOrderBackup> loadBackups() {
    final raw = _kv.getString(_backupKey);
    if (raw == null) return const [];
    try {
      final parsed = jsonDecode(raw);
      if (parsed is! List) return const [];
      return [for (final b in parsed) ?AddonOrderBackup.fromJson(b)];
    } catch (_) {
      return const [];
    }
  }

  /// Prepends a snapshot of [items] to the backups (capped at five), degrading to
  /// a name-only record if the full snapshot cannot be written. Ported 1:1 from
  /// `pushBackup`.
  Future<void> pushBackup(List<CollectionAddon> items) async {
    final existing = loadBackups();
    final full = AddonOrderBackup(
      at: _now,
      urls: [for (final i in items) _urlOf(i) ?? ''],
      names: [for (final i in items) _nameOf(i)],
      items: items,
    );
    final slim = AddonOrderBackup(
      at: full.at,
      urls: full.urls,
      names: full.names,
    );
    final attempts = <List<Map<String, dynamic>>>[
      [full, ...existing].take(_maxBackups).map((b) => b.toJson()).toList(),
      [
        slim,
        ...existing,
      ].take(_maxBackups).map((b) => b.toJson(includeItems: false)).toList(),
      [slim.toJson(includeItems: false)],
    ];
    for (final attempt in attempts) {
      try {
        await _kv.setString(_backupKey, jsonEncode(attempt));
        return;
      } catch (_) {
        continue;
      }
    }
  }

  /// Persists the display-order mirror (the url sequence Harbor reads to order
  /// installed addons locally). Ported from `saveDisplayOrder`.
  Future<void> saveDisplayOrder(List<String> urls) async {
    try {
      await _kv.setString(_orderKey, jsonEncode(urls));
    } catch (_) {
      // A failed mirror is non-fatal; the account order still saved.
    }
  }

  /// The stored display-order mirror, or empty when none is readable. Ported
  /// from `loadDisplayOrder`.
  List<String> loadDisplayOrder() {
    final raw = _kv.getString(_orderKey);
    if (raw == null) return const [];
    try {
      final parsed = jsonDecode(raw);
      return parsed is List ? parsed.whereType<String>().toList() : const [];
    } catch (_) {
      return const [];
    }
  }

  /// Saves [next] as the account collection order, guarding every step: validate
  /// the reorder, re-fetch to detect drift, back up the baseline, write, then
  /// read back and verify the persisted order matches. Ported 1:1 from
  /// `saveCollectionOrder`; [fetch]/[write] wrap the Stremio collection API.
  Future<SaveResult> saveCollectionOrder({
    required List<CollectionAddon> baseline,
    required List<CollectionAddon> next,
    required bool alreadyBackedUp,
    required Future<List<CollectionAddon>?> Function() fetch,
    required Future<bool> Function(List<CollectionAddon>) write,
    void Function(SaveStep)? onStep,
  }) async {
    onStep?.call(SaveStep.checking);
    final valid = validateReorder(baseline, next);
    if (!valid.ok) return SaveValidateFailure(valid.reason!);

    final fresh = await fetch();
    if (fresh == null) return const SaveFetchFailure();
    if (collectionDrifted(baseline, fresh)) return SaveStaleFailure(fresh);

    if (!alreadyBackedUp) await pushBackup(baseline);
    onStep?.call(SaveStep.saving);
    final wrote = await write(next);
    if (!wrote) return const SaveWriteFailure();

    onStep?.call(SaveStep.verifying);
    final readBack = await fetch();
    if (readBack == null) return const SaveVerifyFailure(null);
    final readUrls = [for (final a in readBack) _urlOf(a) ?? ''];
    final nextUrls = [for (final a in next) _urlOf(a) ?? ''];
    if (!sequencesEqual(readUrls, nextUrls)) {
      return SaveVerifyFailure(readBack);
    }
    return SaveSuccess(readBack);
  }
}
