import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/addons_providers.dart';
import '../../app/deep_link_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/addons/install_resolve.dart';
import '../../domain/addons/models.dart';
import '../../domain/addons/resolved_addon.dart';
import '../../domain/addons/stremio_addons_client.dart';
import '../../domain/nav/frame.dart';
import 'addon_utils.dart';
import 'addons_tab.dart';
import 'browse/age_gate_modal.dart';
import 'browse/browse_pane.dart';
import 'discover/discover_pane.dart';
import 'install/install_modal.dart';
import 'installed/installed_pane.dart';
import 'widgets/add_by_url_bar.dart';
import 'widgets/addon_search_bar.dart';
import 'widgets/toaster.dart';

/// A browse mode with its chip label and icon.
typedef _Mode = ({BrowseMode id, String label, IconData icon});

const List<_Mode> _browseModes = [
  (id: BrowseMode.top, label: 'Top rated', icon: Icons.star),
  (id: BrowseMode.rising, label: 'Top rising', icon: Icons.trending_up),
  (id: BrowseMode.newest, label: 'Just added', icon: Icons.auto_awesome),
];

/// The addons page: a Browse / Installed tab bar with the community catalog and
/// the installed-addons manager. Ports the web addons page (the Discover tab
/// lands with its pane).
class AddonsView extends ConsumerStatefulWidget {
  const AddonsView({super.key});

  @override
  ConsumerState<AddonsView> createState() => _AddonsViewState();
}

class _AddonsViewState extends ConsumerState<AddonsView> {
  late AddonsTab _tab;
  String? _categoryFilter;
  BrowseMode _browseMode = BrowseMode.top;
  String _query = '';
  bool _filtersOpen = true;
  bool _ageGateOpen = false;
  AddonInstallMode? _installMode;

  @override
  void initState() {
    super.initState();
    _tab = consumeAddonsTab() ?? AddonsTab.discover;
  }

  String get _trimmedQuery => _query.trim();

  void _onSearch(String v) {
    setState(() {
      _query = v;
      if (v.trim().isNotEmpty && _tab != AddonsTab.installed) {
        _tab = AddonsTab.browse;
      }
    });
  }

  void _open(String id) => ref
      .read(navControllerProvider.notifier)
      .push(Frame(FrameKind.addonDetail, {'id': id}));

  void _onCategorySelect(String cat) => setState(() {
    _categoryFilter = cat;
    _tab = AddonsTab.browse;
  });

  Future<void> _installAddon(ResolvedAddon r) async {
    final toast = ref.read(toastControllerProvider.notifier);
    // A configurable addon opens its detail (where setup happens) rather than
    // installing blind — matching the web install flow.
    if (r.manifest?.needsConfiguration ?? false) {
      _open(idOf(r));
      return;
    }
    final error = await ref
        .read(installedAddonsProvider.notifier)
        .install(
          r.transportUrl,
          installedAt: DateTime.now().millisecondsSinceEpoch,
        );
    ref.invalidate(addonsCatalogProvider);
    if (error != null) {
      toast.show(ToastKind.error, error);
    } else {
      toast.show(ToastKind.ok, 'Installed', addonName: nameOf(r));
    }
  }

  Future<void> _uninstallAddon(ResolvedAddon r) async {
    await ref.read(installedAddonsProvider.notifier).uninstall(r.transportUrl);
    ref.invalidate(addonsCatalogProvider);
    ref
        .read(toastControllerProvider.notifier)
        .show(ToastKind.ok, 'Removed', addonName: nameOf(r));
  }

  void _openInstall(String url) =>
      setState(() => _installMode = InstallModeAdd(url));

  void _openManage(ResolvedAddon r) => setState(
    () => _installMode = InstallModeManage(
      ManageTarget(
        id: idOf(r),
        name: nameOf(r),
        transportUrl: r.transportUrl,
        logo: r.manifest?.logo,
      ),
    ),
  );

  /// Runs the modal's install: replacing an existing entry first when the paste
  /// is a re-configure, then installing. Returns null (and toasts) on failure so
  /// the modal resets rather than showing success.
  Future<InstallOutcome?> _runInstall(
    String url, {
    String? replaceTransportUrl,
  }) async {
    final notifier = ref.read(installedAddonsProvider.notifier);
    final before = ref.read(installedAddonsProvider);
    final replaced =
        replaceTransportUrl != null || before.any((a) => a.transportUrl == url);
    if (replaceTransportUrl != null && replaceTransportUrl != url) {
      await notifier.uninstall(replaceTransportUrl);
    }
    final error = await notifier.install(
      url,
      installedAt: DateTime.now().millisecondsSinceEpoch,
    );
    if (error != null) {
      ref.read(toastControllerProvider.notifier).show(ToastKind.error, error);
      return null;
    }
    ref.invalidate(addonsCatalogProvider);
    final entry = ref
        .read(installedAddonsProvider)
        .where((a) => a.transportUrl == url)
        .firstOrNull;
    return InstallOutcome(
      replaced: replaced,
      manifest: entry?.manifest ?? Manifest(const {}),
    );
  }

  void _toggleAdult() {
    final showing = ref.read(settingsProvider).getBool('showAdultAddons');
    if (showing) {
      ref.read(settingsProvider.notifier).setValue('showAdultAddons', false);
    } else {
      setState(() => _ageGateOpen = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    // A deep-link install routes here with a pending URL: open the confirm
    // modal for it, then clear the pending so it fires once.
    final pendingInstall = ref.watch(pendingDeepLinkInstallProvider);
    if (pendingInstall != null && _installMode == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        ref.read(pendingDeepLinkInstallProvider.notifier).set(null);
        setState(() => _installMode = InstallModeAdd(pendingInstall));
      });
    }
    final showAdult = ref.watch(
      settingsProvider.select((s) => s.getBool('showAdultAddons')),
    );
    final catalog = ref.watch(addonsCatalogProvider);
    final installedIds = catalog.value?.installedIds ?? const <String>{};

    final idiom = Idiom.of(context);
    final gutter = pageGutter(idiom);

    return Stack(
      children: [
        // While the age gate is open, take the whole page behind it out of the
        // focus tree so a TV D-pad cannot escape the quiz onto a tab or card
        // hidden behind the dim (the modal is a Stack sibling, not a route, so
        // it can only be trapped from here). The quiz autofocuses its first
        // answer, so focus lands inside it.
        ExcludeFocus(
          excluding: _ageGateOpen,
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              gutter,
              pageTopGutter(idiom),
              gutter,
              0,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _header(t, showAdult, installedIds.length),
                const SizedBox(height: 12),
                Expanded(child: _pane(showAdult, installedIds)),
              ],
            ),
          ),
        ),
        const Toaster(),
        if (_ageGateOpen)
          AgeGateModal(
            onClose: () => setState(() => _ageGateOpen = false),
            onPass: () => ref
                .read(settingsProvider.notifier)
                .setValue('showAdultAddons', true),
          ),
        if (_installMode != null)
          AddonInstallModal(
            mode: _installMode!,
            onClose: () => setState(() => _installMode = null),
            onInstall: _runInstall,
          ),
      ],
    );
  }

  Widget _pane(bool showAdult, Set<String> installedIds) {
    final query = _trimmedQuery;
    if (_tab == AddonsTab.discover) {
      return _discoverPane();
    }
    if (_tab == AddonsTab.installed) {
      return InstalledPane(
        search: query.isEmpty ? null : query,
        onOpen: _open,
        onManage: _openManage,
      );
    }
    return BrowsePane(
      mode: _browseMode,
      category: query.isEmpty ? _categoryFilter : null,
      search: query.isEmpty ? null : query,
      allowAdult: showAdult,
      installedIds: installedIds,
      onOpen: _open,
    );
  }

  Widget _discoverPane() {
    final t = ref.watch(tokensProvider);
    return ref
        .watch(discoverDataProvider)
        .when(
          loading: () =>
              const Center(child: CircularProgressIndicator(strokeWidth: 2)),
          error: (_, _) => Center(
            child: Text(
              "Couldn't load the catalog. Check your connection and try again.",
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13.5, color: t.inkMuted),
            ),
          ),
          data: (d) => SingleChildScrollView(
            padding: const EdgeInsets.only(top: 8, bottom: 80),
            child: DiscoverPane(
              hero: d.hero,
              rails: d.rails,
              installedIds: d.installedIds,
              authKey: d.authKey,
              onOpen: _open,
              onInstall: _installAddon,
              onUninstall: _uninstallAddon,
              onCategorySelect: _onCategorySelect,
              onRefetch: () => ref.invalidate(addonsCatalogProvider),
            ),
          ),
        );
  }

  Widget _header(HarborTokens t, bool showAdult, int installedCount) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      // The search / add-by-url inputs keep their web widths on wide layouts
      // but clamp to the pane width so they never overflow a phone (the Wrap
      // reflows each to its own line). The row stays fluid without a rail tax.
      LayoutBuilder(
        builder: (context, constraints) {
          final avail = constraints.maxWidth;
          return Wrap(
            spacing: 12,
            runSpacing: 12,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              _tabPill(t, AddonsTab.discover, 'Discover'),
              _tabPill(t, AddonsTab.browse, 'Browse'),
              _tabPill(
                t,
                AddonsTab.installed,
                'Installed',
                count: installedCount,
              ),
              SizedBox(
                width: avail < 260 ? avail : 260,
                child: AddonSearchBar(value: _query, onChanged: _onSearch),
              ),
              SizedBox(
                width: avail < 360 ? avail : 360,
                child: AddByUrlBar(
                  onSubmit: (url) async => _openInstall(url),
                  compact: true,
                ),
              ),
              _adultToggle(t, showAdult),
              if (_tab == AddonsTab.browse) _filtersToggle(t),
            ],
          );
        },
      ),
      if (_tab == AddonsTab.browse && _filtersOpen) ...[
        const SizedBox(height: 16),
        _filtersRow(t, showAdult),
      ],
    ],
  );

  Widget _tabPill(HarborTokens t, AddonsTab tab, String label, {int? count}) {
    final active = _tab == tab;
    return Focusable(
      // On a TV, land the remote on the active tab when the page opens so the
      // 10-foot session has a visible focus target instead of a blind first
      // press; a no-op once the viewer has moved focus.
      autofocus: kPlatformIsTv == true && active,
      onPressed: () => setState(() {
        _tab = tab;
        if (tab == AddonsTab.browse) _categoryFilter = null;
      }),
      tokens: t,
      borderRadius: 999,
      child: Container(
        // Sized by padding, not height+alignment: a Container with an alignment
        // expands to fill a Wrap's bounded width, which stretched these pills to
        // full width. Padding keeps each pill content-sized.
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        decoration: BoxDecoration(
          color: active ? t.ink : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (count != null) ...[
              Icon(Icons.check, size: 15, color: active ? t.canvas : t.accent),
              const SizedBox(width: 8),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: active ? t.canvas : t.inkMuted,
              ),
            ),
            if (count != null) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: active ? t.canvas.withValues(alpha: 0.15) : t.edge,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '$count',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    color: active ? t.canvas : t.inkMuted,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _adultToggle(HarborTokens t, bool showAdult) => Focusable(
    onPressed: _toggleAdult,
    tokens: t,
    borderRadius: 999,
    child: Container(
      height: 36,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      // No alignment — it would expand the pill to the header Wrap's full width
      // and drop it onto its own line; the Row(min) centres vertically already.
      decoration: BoxDecoration(
        color: showAdult ? t.ink.withValues(alpha: 0.1) : Colors.transparent,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: showAdult ? t.ink : t.edgeSoft),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 12,
            height: 12,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: showAdult ? t.ink : Colors.transparent,
              borderRadius: BorderRadius.circular(3),
              border: Border.all(color: showAdult ? t.ink : t.edge),
            ),
            child: showAdult
                ? Icon(Icons.check, size: 8, color: t.canvas)
                : null,
          ),
          const SizedBox(width: 6),
          Text(
            'ADULT',
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.6,
              color: showAdult ? t.ink : t.inkSubtle,
            ),
          ),
        ],
      ),
    ),
  );

  Widget _filtersToggle(HarborTokens t) => Focusable(
    onPressed: () => setState(() => _filtersOpen = !_filtersOpen),
    tokens: t,
    borderRadius: 999,
    child: Container(
      height: 36,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      // No alignment — see _adultToggle; content-size in the Wrap.
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            _filtersOpen ? Icons.expand_more : Icons.chevron_right,
            size: 14,
            color: t.inkSubtle,
          ),
          const SizedBox(width: 6),
          Text(
            _filtersOpen ? 'HIDE' : 'FILTERS',
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.6,
              color: t.inkSubtle,
            ),
          ),
        ],
      ),
    ),
  );

  Widget _filtersRow(HarborTokens t, bool showAdult) {
    final categories =
        ref.watch(categoriesProvider).value ?? kDefaultSaCategories;
    final chips = <Widget>[
      _chip(t, 'All', _categoryFilter == null, () {
        setState(() => _categoryFilter = null);
      }),
      for (final c in categories)
        if (showAdult || c.slug != 'nsfw')
          _chip(t, c.name, _categoryFilter == c.slug, () {
            setState(() => _categoryFilter = c.slug);
          }),
      Container(width: 1, height: 24, color: t.edgeSoft),
      for (final m in _browseModes) _modeChip(t, m),
    ];
    return Wrap(spacing: 8, runSpacing: 8, children: chips);
  }

  Widget _chip(HarborTokens t, String label, bool active, VoidCallback onTap) =>
      Focusable(
        onPressed: onTap,
        tokens: t,
        borderRadius: 999,
        child: Container(
          // Vertical padding (not height+alignment): a Text child under an
          // alignment would expand the pill to the Wrap's full width, one chip
          // per line. Padding content-sizes it (~40 tall) and stays centred.
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
          decoration: BoxDecoration(
            color: active ? t.ink : t.elevated.withValues(alpha: 0.4),
            borderRadius: BorderRadius.circular(999),
            border: active
                ? null
                : Border.all(color: t.edgeSoft.withValues(alpha: 0.6)),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w600,
              color: active ? t.canvas : t.inkMuted,
            ),
          ),
        ),
      );

  Widget _modeChip(HarborTokens t, _Mode m) {
    final active = _browseMode == m.id;
    return Focusable(
      onPressed: () => setState(() => _browseMode = m.id),
      tokens: t,
      borderRadius: 999,
      child: Container(
        height: 40,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        // No alignment — the Row(min) centres vertically; an alignment would
        // expand each mode chip to full width in the filters Wrap.
        decoration: BoxDecoration(
          color: active ? t.ink : t.elevated.withValues(alpha: 0.4),
          borderRadius: BorderRadius.circular(999),
          border: active
              ? null
              : Border.all(color: t.edgeSoft.withValues(alpha: 0.6)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(m.icon, size: 13, color: active ? t.canvas : t.accent),
            const SizedBox(width: 6),
            Text(
              m.label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: active ? t.canvas : t.inkMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
