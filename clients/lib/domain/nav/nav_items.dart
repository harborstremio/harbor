import 'frame.dart';

// The navigation model, ported 1:1 from the web `src/chrome/nav-items.tsx`.
// Pure Dart (no Flutter): the sidebar/topbar widgets read this to render the
// rail, and the settings "customize navigation" surface mutates the
// [NavCustomization] that drives order/visibility/labels.

/// Stable identity for every navigable tab, matching the web `NavItemId` union.
/// The [name] of each value is the exact string the web persists in
/// `navCustomization.order/hidden/renamed` (e.g. `home`, `live`, `vod`).
enum NavItemId {
  home,
  discover,
  catalogs,
  movies,
  shows,
  kids,
  anime,
  live,
  vod,
  calendar,
  library,
  downloads,
  addons,
  settings,
}

/// A gate key on `settings.hideContent` — hiding the item when the user turned
/// that content class off. Mirrors the web `hideKey` union.
enum NavHideKey { anime, liveTv, sports }

/// A parental-lockable tab (`settings`/profile `lockedTabs`), mirroring the web
/// `LockableTab`. Used to hide/PIN-gate items under an active parental lock.
enum NavLockableTab {
  discover,
  movies,
  shows,
  anime,
  liveTv,
  calendar,
  library,
  addons,
}

/// One navigation entry. [labelKey] is the i18n key (e.g. `nav.home`) and
/// [label] is the built-in English string the key resolves to today (the
/// clientv2 i18n layer is not wired yet, so widgets render [label] directly).
class NavItemDef {
  const NavItemDef({
    required this.id,
    required this.labelKey,
    required this.label,
    required this.frame,
    this.hideKey,
    this.parentalKey,
    this.pinGated = false,
  });

  final NavItemId id;
  final String labelKey;
  final String label;
  final FrameKind frame;
  final NavHideKey? hideKey;
  final NavLockableTab? parentalKey;
  final bool pinGated;

  /// A copy with a user-supplied display label (from `navCustomization.renamed`).
  /// Both [label] and [labelKey] become the literal string so translation
  /// returns it unchanged — matching the web, where a rename replaces the key.
  NavItemDef withLabel(String custom) => NavItemDef(
    id: id,
    labelKey: custom,
    label: custom,
    frame: frame,
    hideKey: hideKey,
    parentalKey: parentalKey,
    pinGated: pinGated,
  );
}

/// The canonical nav list in default order — the exact set, order, labels, and
/// gates of the web `NAV_ITEMS`.
const List<NavItemDef> kNavItems = [
  NavItemDef(
    id: NavItemId.home,
    labelKey: 'nav.home',
    label: 'Home',
    frame: FrameKind.home,
  ),
  NavItemDef(
    id: NavItemId.discover,
    labelKey: 'nav.discover',
    label: 'Discover',
    frame: FrameKind.discover,
    parentalKey: NavLockableTab.discover,
  ),
  NavItemDef(
    id: NavItemId.catalogs,
    labelKey: 'nav.catalogs',
    label: 'Catalogs',
    frame: FrameKind.catalogs,
    parentalKey: NavLockableTab.discover,
  ),
  NavItemDef(
    id: NavItemId.movies,
    labelKey: 'nav.movies',
    label: 'Movies',
    frame: FrameKind.movies,
    parentalKey: NavLockableTab.movies,
  ),
  NavItemDef(
    id: NavItemId.shows,
    labelKey: 'nav.shows',
    label: 'Shows',
    frame: FrameKind.shows,
    parentalKey: NavLockableTab.shows,
  ),
  NavItemDef(
    id: NavItemId.kids,
    labelKey: 'nav.kids',
    label: 'Watch',
    frame: FrameKind.kids,
  ),
  NavItemDef(
    id: NavItemId.anime,
    labelKey: 'nav.anime',
    label: 'Anime',
    frame: FrameKind.anime,
    hideKey: NavHideKey.anime,
    parentalKey: NavLockableTab.anime,
  ),
  NavItemDef(
    id: NavItemId.live,
    labelKey: 'nav.live',
    label: 'Live TV',
    frame: FrameKind.live,
    hideKey: NavHideKey.liveTv,
    parentalKey: NavLockableTab.liveTv,
  ),
  NavItemDef(
    id: NavItemId.vod,
    labelKey: 'nav.playlists',
    label: 'Playlists',
    frame: FrameKind.vod,
  ),
  NavItemDef(
    id: NavItemId.calendar,
    labelKey: 'nav.calendar',
    label: 'Calendar',
    frame: FrameKind.calendar,
    parentalKey: NavLockableTab.calendar,
  ),
  NavItemDef(
    id: NavItemId.library,
    labelKey: 'nav.library',
    label: 'My Library',
    frame: FrameKind.library,
    parentalKey: NavLockableTab.library,
  ),
  NavItemDef(
    id: NavItemId.downloads,
    labelKey: 'nav.downloads',
    label: 'Downloads',
    frame: FrameKind.downloads,
  ),
  NavItemDef(
    id: NavItemId.addons,
    labelKey: 'nav.addons',
    label: 'Addons',
    frame: FrameKind.addons,
    parentalKey: NavLockableTab.addons,
  ),
  NavItemDef(
    id: NavItemId.settings,
    labelKey: 'nav.settings',
    label: 'Settings',
    frame: FrameKind.settings,
    pinGated: true,
  ),
];

/// The upper (content) section of the rail; the rest render below a divider.
/// Mirrors the web `PRIMARY_IDS`.
const Set<NavItemId> kNavPrimaryIds = {
  NavItemId.home,
  NavItemId.discover,
  NavItemId.catalogs,
  NavItemId.movies,
  NavItemId.shows,
  NavItemId.kids,
  NavItemId.anime,
  NavItemId.live,
  NavItemId.vod,
};

bool navIsPrimary(NavItemId id) => kNavPrimaryIds.contains(id);

NavItemId? _navIdByName(String name) {
  for (final id in NavItemId.values) {
    if (id.name == name) return id;
  }
  return null;
}

/// The user's persisted nav customization: reordering, hiding, and renaming.
/// Ported from the web `NavCustomization` (stored under `navCustomization`).
class NavCustomization {
  const NavCustomization({
    this.order = const [],
    this.hidden = const [],
    this.renamed = const {},
  });

  /// Ordered item ids (by [NavItemId.name]); empty means "default order".
  final List<String> order;

  /// Hidden item ids.
  final List<String> hidden;

  /// Custom display labels, keyed by item id.
  final Map<String, String> renamed;

  factory NavCustomization.fromMap(Map<String, dynamic>? m) {
    if (m == null) return const NavCustomization();
    return NavCustomization(
      order: ((m['order'] as List?) ?? const [])
          .map((e) => e.toString())
          .toList(),
      hidden: ((m['hidden'] as List?) ?? const [])
          .map((e) => e.toString())
          .toList(),
      renamed: ((m['renamed'] as Map?) ?? const {}).map(
        (k, v) => MapEntry(k.toString(), v.toString()),
      ),
    );
  }

  Map<String, dynamic> toMap() => {
    'order': order,
    'hidden': hidden,
    'renamed': renamed,
  };

  NavCustomization copyWith({
    List<String>? order,
    List<String>? hidden,
    Map<String, String>? renamed,
  }) => NavCustomization(
    order: order ?? this.order,
    hidden: hidden ?? this.hidden,
    renamed: renamed ?? this.renamed,
  );
}

/// Filters hidden items, applies renames, then reorders per [cfg] — the web
/// `applyNavCustomization`. Items not named in [cfg.order] keep their default
/// relative position, appended after the ordered ones.
List<NavItemDef> applyNavCustomization(
  List<NavItemDef> items,
  NavCustomization cfg,
) {
  final shown = [
    for (final it in items)
      if (!cfg.hidden.contains(it.id.name))
        cfg.renamed[it.id.name] != null && cfg.renamed[it.id.name]!.isNotEmpty
            ? it.withLabel(cfg.renamed[it.id.name]!)
            : it,
  ];
  if (cfg.order.isEmpty) return shown;
  final byId = {for (final it in shown) it.id.name: it};
  final ordered = <NavItemDef>[];
  for (final name in cfg.order) {
    final it = byId[name];
    if (it != null) ordered.add(it);
  }
  final inOrder = cfg.order.toSet();
  for (final it in shown) {
    if (!inOrder.contains(it.id.name)) ordered.add(it);
  }
  return ordered;
}

/// The full effective id order (including items absent from [cfg.order], in
/// their default position) — the web `effectiveNavOrder`.
List<NavItemId> effectiveNavOrder(NavCustomization cfg) {
  final all = kNavItems.map((it) => it.id).toList();
  final allNames = all.map((id) => id.name).toSet();
  final out = <NavItemId>[];
  for (final name in cfg.order) {
    if (allNames.contains(name)) {
      final id = _navIdByName(name);
      if (id != null) out.add(id);
    }
  }
  final seen = out.map((id) => id.name).toSet();
  for (final id in all) {
    if (!seen.contains(id.name)) out.add(id);
  }
  return out;
}

/// Moves [fromId] before/after [toId], returning an updated customization — the
/// web `moveNavItem`. No-op when either id is unknown or the two are equal.
NavCustomization moveNavItem(
  NavCustomization cfg,
  String fromId,
  String toId,
  String position, // 'before' | 'after'
) {
  if (fromId == toId) return cfg;
  final next = effectiveNavOrder(
    cfg,
  ).map((id) => id.name).where((id) => id != fromId).toList();
  final anchor = next.indexOf(toId);
  if (anchor < 0) return cfg;
  next.insert(position == 'after' ? anchor + 1 : anchor, fromId);
  return cfg.copyWith(order: next);
}

/// Toggles an item's hidden state — the web `toggleNavHidden`.
NavCustomization toggleNavHidden(NavCustomization cfg, String id) {
  final hidden = cfg.hidden.contains(id)
      ? (cfg.hidden.where((x) => x != id).toList())
      : ([...cfg.hidden, id]);
  return cfg.copyWith(hidden: hidden);
}

/// Sets or clears an item's custom label — the web `renameNavItem`. An empty
/// (or whitespace-only) label removes the override.
NavCustomization renameNavItem(NavCustomization cfg, String id, String label) {
  final trimmed = label.trim();
  final renamed = {...cfg.renamed};
  if (trimmed.isNotEmpty) {
    renamed[id] = trimmed;
  } else {
    renamed.remove(id);
  }
  return cfg.copyWith(renamed: renamed);
}

/// A fresh, empty customization — the web `resetNavCustomization`.
NavCustomization resetNavCustomization() => const NavCustomization();
