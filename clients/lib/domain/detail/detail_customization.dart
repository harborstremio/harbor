import 'dart:convert';

import '../../core/storage/kv_store.dart';

/// The per-user detail rail layout, ported 1:1 from `DetailCustomization`: an
/// explicit `order` of section keys and a set of `hidden` keys.
class DetailCustomization {
  const DetailCustomization({this.order = const [], this.hidden = const []});
  final List<String> order;
  final List<String> hidden;

  DetailCustomization copyWith({List<String>? order, List<String>? hidden}) =>
      DetailCustomization(
        order: order ?? this.order,
        hidden: hidden ?? this.hidden,
      );

  Map<String, dynamic> toJson() => {'order': order, 'hidden': hidden};
}

/// Orders [available] section keys by the customization's explicit order, then
/// appends any not listed (in their natural order). Ported from
/// `orderedSectionKeys`.
List<String> orderedSectionKeys(List<String> available, DetailCustomization c) {
  final set = available.toSet();
  final out = <String>[];
  for (final k in c.order) {
    if (set.contains(k)) out.add(k);
  }
  final seen = out.toSet();
  for (final k in available) {
    if (!seen.contains(k)) out.add(k);
  }
  return out;
}

/// Moves a section one step in the ordering, ported from `moveSection`.
DetailCustomization moveSection(
  DetailCustomization c,
  List<String> available,
  String key,
  int delta,
) {
  final order = orderedSectionKeys(available, c);
  final i = order.indexOf(key);
  if (i < 0) return c;
  final j = i + delta;
  if (j < 0 || j >= order.length) return c;
  final next = [...order];
  final tmp = next[i];
  next[i] = next[j];
  next[j] = tmp;
  return c.copyWith(order: next);
}

/// Toggles a section's hidden state, ported from `toggleSectionHidden`.
DetailCustomization toggleSectionHidden(DetailCustomization c, String key) {
  final has = c.hidden.contains(key);
  return c.copyWith(
    hidden: has
        ? [
            for (final k in c.hidden)
              if (k != key) k,
          ]
        : [...c.hidden, key],
  );
}

/// The persisted detail-layout store (`harbor.detailLayout`), ported from
/// `loadDetailCustomization` / `saveDetailCustomization`.
class DetailCustomizationStore {
  DetailCustomizationStore(this._kv);
  static const _key = 'harbor.detailLayout';
  final KvStore _kv;

  DetailCustomization load() {
    final raw = _kv.getString(_key);
    if (raw == null || raw.isEmpty) return const DetailCustomization();
    try {
      final p = jsonDecode(raw);
      if (p is! Map) return const DetailCustomization();
      List<String> strs(dynamic v) => v is List
          ? [
              for (final e in v)
                if (e is String) e,
            ]
          : const [];
      return DetailCustomization(
        order: strs(p['order']),
        hidden: strs(p['hidden']),
      );
    } catch (_) {
      return const DetailCustomization();
    }
  }

  Future<void> save(DetailCustomization c) =>
      _kv.setString(_key, jsonEncode(c.toJson()));
}
