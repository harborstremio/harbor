import '../catalog/catalog_row.dart';

/// The per-user Home row customization, ported 1:1 from the web
/// `HomeRowCustomization` (`src/lib/home-customization.ts`). Persisted inside the
/// `homeRows` settings map so it round-trips with every other setting.
///
/// - [order]: explicit row-key ordering; keys not listed keep their natural order.
/// - [hidden]: row keys the user hid.
/// - [renamed]: row key → user label override.
/// - [numerals]: row keys rendered as a Top-10 ranked rail.
/// - [heroSource]: the row key whose artwork feeds the hero carousel, or null.
/// - [customSources]: user-defined source rows (opaque maps, preserved verbatim).
/// - [listRows]: custom-list ids pinned to Home as their own rows.
class HomeRowCustomization {
  const HomeRowCustomization({
    this.order = const [],
    this.hidden = const [],
    this.renamed = const {},
    this.numerals = const [],
    this.heroSource,
    this.customSources = const [],
    this.listRows = const [],
  });

  final List<String> order;
  final List<String> hidden;
  final Map<String, String> renamed;
  final List<String> numerals;
  final String? heroSource;
  final List<Map<String, dynamic>> customSources;
  final List<String> listRows;

  HomeRowCustomization copyWith({
    List<String>? order,
    List<String>? hidden,
    Map<String, String>? renamed,
    List<String>? numerals,
    Object? heroSource = _unset,
    List<Map<String, dynamic>>? customSources,
    List<String>? listRows,
  }) => HomeRowCustomization(
    order: order ?? this.order,
    hidden: hidden ?? this.hidden,
    renamed: renamed ?? this.renamed,
    numerals: numerals ?? this.numerals,
    heroSource: heroSource == _unset ? this.heroSource : heroSource as String?,
    customSources: customSources ?? this.customSources,
    listRows: listRows ?? this.listRows,
  );

  static const _unset = Object();

  /// Reads a customization from the raw `homeRows` settings map, tolerating any
  /// missing/mistyped field (falls back to the empty default per field).
  static HomeRowCustomization fromMap(Map<String, dynamic>? m) {
    if (m == null) return const HomeRowCustomization();
    List<String> strs(dynamic v) => v is List
        ? [
            for (final e in v)
              if (e is String) e,
          ]
        : const [];
    final rawRenamed = m['renamed'];
    final renamed = <String, String>{};
    if (rawRenamed is Map) {
      rawRenamed.forEach((k, v) {
        if (k is String && v is String) renamed[k] = v;
      });
    }
    final rawSources = m['customSources'];
    final sources = <Map<String, dynamic>>[];
    if (rawSources is List) {
      for (final e in rawSources) {
        if (e is Map) sources.add(e.cast<String, dynamic>());
      }
    }
    final hero = m['heroSource'];
    return HomeRowCustomization(
      order: strs(m['order']),
      hidden: strs(m['hidden']),
      renamed: renamed,
      numerals: strs(m['numerals']),
      heroSource: hero is String ? hero : null,
      customSources: sources,
      listRows: strs(m['listRows']),
    );
  }

  Map<String, dynamic> toMap() => {
    'order': order,
    'hidden': hidden,
    'renamed': renamed,
    'numerals': numerals,
    'heroSource': heroSource,
    'customSources': customSources,
    'listRows': listRows,
  };
}

/// Applies rename + hide + explicit ordering to [rows], ported 1:1 from
/// `applyHomeRowCustomization`. When [includeHidden] is false, hidden rows are
/// dropped; when true they are kept (edit mode renders them greyed with a Show
/// control). The `numerals` flag is layered on so a row the user marked as a
/// Top-10 renders ranked.
List<CatalogRow> applyHomeRowCustomization(
  List<CatalogRow> rows,
  HomeRowCustomization custom, {
  bool includeHidden = false,
}) {
  final numeralSet = custom.numerals.toSet();
  final renamedRows = <CatalogRow>[];
  for (final r in rows) {
    final key = r.key;
    if (!includeHidden && key != null && custom.hidden.contains(key)) continue;
    final rename = key == null ? null : custom.renamed[key];
    final wantsNumerals = key != null && numeralSet.contains(key);
    if (rename != null || (wantsNumerals && !r.numerals)) {
      renamedRows.add(
        r.copyWith(title: rename, numerals: wantsNumerals ? true : null),
      );
    } else {
      renamedRows.add(r);
    }
  }
  if (custom.order.isEmpty) return renamedRows;
  final byKey = <String, CatalogRow>{
    for (final r in renamedRows)
      if (r.key != null) r.key!: r,
  };
  final ordered = <CatalogRow>[];
  for (final k in custom.order) {
    final r = byKey[k];
    if (r != null) ordered.add(r);
  }
  final orderedKeys = custom.order.toSet();
  for (final r in renamedRows) {
    if (r.key == null || !orderedKeys.contains(r.key)) ordered.add(r);
  }
  return ordered;
}

/// Whether [key] is currently hidden. Ported from `isRowHidden`.
bool isRowHidden(HomeRowCustomization custom, String key) =>
    custom.hidden.contains(key);

/// The effective ordering of live [rows]: the customization order (restricted to
/// live keys) then any live key not yet in the order. Ported from
/// `effectiveOrder`.
List<String> effectiveHomeOrder(
  List<CatalogRow> rows,
  HomeRowCustomization custom,
) {
  final live = [
    for (final r in rows)
      if (r.key != null) r.key!,
  ];
  final liveSet = live.toSet();
  final out = <String>[];
  for (final k in custom.order) {
    if (liveSet.contains(k)) out.add(k);
  }
  final seen = out.toSet();
  for (final k in live) {
    if (!seen.contains(k)) out.add(k);
  }
  return out;
}

/// Moves [key] one step (delta -1 up / +1 down) within the effective order.
/// Ported from `moveRow`.
HomeRowCustomization moveHomeRow(
  HomeRowCustomization custom,
  List<CatalogRow> rows,
  String key,
  int delta,
) {
  final order = effectiveHomeOrder(rows, custom);
  final idx = order.indexOf(key);
  if (idx < 0) return custom;
  final target = idx + delta;
  if (target < 0 || target >= order.length) return custom;
  final next = [...order];
  final tmp = next[idx];
  next[idx] = next[target];
  next[target] = tmp;
  return custom.copyWith(order: next);
}

/// Toggles a row's hidden state. Ported from `toggleRowHidden`.
HomeRowCustomization toggleHomeRowHidden(
  HomeRowCustomization custom,
  String key,
) {
  final has = custom.hidden.contains(key);
  return custom.copyWith(
    hidden: has
        ? [
            for (final k in custom.hidden)
              if (k != key) k,
          ]
        : [...custom.hidden, key],
  );
}

/// Sets or clears a row's label override. Empty [label] clears it. Ported from
/// `renameRow`.
HomeRowCustomization renameHomeRow(
  HomeRowCustomization custom,
  String key,
  String label,
) {
  final trimmed = label.trim();
  final renamed = {...custom.renamed};
  if (trimmed.isEmpty) {
    renamed.remove(key);
  } else {
    renamed[key] = trimmed;
  }
  return custom.copyWith(renamed: renamed);
}

/// Toggles a row's Top-10 numerals rendering. Ported from `toggleRowNumerals`.
HomeRowCustomization toggleHomeRowNumerals(
  HomeRowCustomization custom,
  String key,
) {
  final has = custom.numerals.contains(key);
  return custom.copyWith(
    numerals: has
        ? [
            for (final k in custom.numerals)
              if (k != key) k,
          ]
        : [...custom.numerals, key],
  );
}

/// Sets [key] as the hero source, or clears it if it already is. Ported from
/// `toggleHeroSource`.
HomeRowCustomization toggleHomeHeroSource(
  HomeRowCustomization custom,
  String key,
) => custom.copyWith(heroSource: custom.heroSource == key ? null : key);

/// Pins a custom list to Home (no-op if already pinned). Ported from `addListRow`.
HomeRowCustomization addHomeListRow(
  HomeRowCustomization custom,
  String listId,
) {
  if (custom.listRows.contains(listId)) return custom;
  return custom.copyWith(listRows: [...custom.listRows, listId]);
}

/// Unpins a custom list from Home. Ported from `removeListRow`.
HomeRowCustomization removeHomeListRow(
  HomeRowCustomization custom,
  String listId,
) => custom.copyWith(
  listRows: [
    for (final id in custom.listRows)
      if (id != listId) id,
  ],
);

/// The empty customization used by the Reset control. Ported from `resetHomeRows`.
HomeRowCustomization resetHomeRows() => const HomeRowCustomization();
