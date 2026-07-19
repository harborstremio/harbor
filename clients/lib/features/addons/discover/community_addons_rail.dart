import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/addons_providers.dart';
import '../../../core/net/safe_launch.dart';
import '../../../app/providers.dart';
import '../../../app/theme_controller.dart';
import '../../../design/focus/focusable.dart';
import '../../../design/layout/idiom.dart';
import '../../../design/tokens.dart';
import '../../../domain/addons/addon_url.dart';
import '../../../domain/addons/stremio_addons_client.dart';
import '../addon_utils.dart';

const String _siteName = 'stremio-addons.net';
const String _siteUrl = 'https://stremio-addons.net';

const List<({String id, String label})> _tabs = [
  (id: 'stars', label: 'Top rated'),
  (id: 'createdAt', label: 'Just added'),
];

Future<void> _launch(String url) => launchExternalUrl(url);

/// The Discover "Community ratings" rail — the top stremio-addons.net addons for
/// a sort mode, in a focusable horizontal scroller. Ported 1:1 from
/// `CommunityAddonsRail`.
class CommunityAddonsRail extends ConsumerStatefulWidget {
  const CommunityAddonsRail({
    super.key,
    required this.installedIds,
    required this.onOpen,
    this.onChange,
  });

  final Set<String> installedIds;
  final void Function(String manifestId) onOpen;
  final VoidCallback? onChange;

  @override
  ConsumerState<CommunityAddonsRail> createState() =>
      _CommunityAddonsRailState();
}

class _CommunityAddonsRailState extends ConsumerState<CommunityAddonsRail> {
  String _sortMode = 'stars';

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final async = ref.watch(communityAddonsRailProvider(_sortMode));

    return Padding(
      padding: const EdgeInsets.only(bottom: 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // On a phone the tab bar + "Browse all" would crush the title column
          // to a sliver, so drop the controls onto their own line under the
          // header; tablet/tv keep them side by side.
          if (Idiom.of(context).isPhone) ...[
            _header(t),
            const SizedBox(height: 12),
            Align(alignment: Alignment.centerLeft, child: _controls(t)),
          ] else
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(child: _header(t)),
                const SizedBox(width: 12),
                _controls(t),
              ],
            ),
          const SizedBox(height: 16),
          async.when(
            loading: () => _SkeletonRow(tokens: t),
            error: (_, _) => _Notice(
              tokens: t,
              child: RichText(
                textAlign: TextAlign.center,
                text: TextSpan(
                  style: TextStyle(fontSize: 12.5, color: t.inkSubtle),
                  children: [
                    TextSpan(
                      text:
                          '$_siteName should be reachable in a moment. Refresh '
                          'once their docs go live.',
                    ),
                  ],
                ),
              ),
            ),
            data: (items) => items.isEmpty
                ? _Notice(
                    tokens: t,
                    child: Text(
                      'No addons match these filters right now.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12.5, color: t.inkSubtle),
                    ),
                  )
                : _RailScroller(
                    items: items,
                    installedIds: widget.installedIds,
                    onOpen: widget.onOpen,
                    onChange: widget.onChange,
                  ),
          ),
        ],
      ),
    );
  }

  Widget _header(HarborTokens t) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Focusable(
        onPressed: () => _launch(_siteUrl),
        tokens: t,
        borderRadius: 28,
        scale: 1.05,
        child: Container(
          width: 56,
          height: 56,
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: t.edgeSoft),
          ),
          child: Image.asset(
            'assets/brand/stremio-addons-net.png',
            fit: BoxFit.cover,
          ),
        ),
      ),
      const SizedBox(width: 16),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'COMMUNITY RATINGS',
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.bold,
                letterSpacing: 2.31,
                color: t.accent,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Top on $_siteName',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w500,
                letterSpacing: -0.3,
                color: t.ink,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Ranked by the $_siteName community from their public index.',
              style: TextStyle(fontSize: 12.5, color: t.inkMuted),
            ),
          ],
        ),
      ),
    ],
  );

  Widget _controls(HarborTokens t) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      _TabBar(
        tokens: t,
        value: _sortMode,
        onChange: (v) => setState(() => _sortMode = v),
      ),
      const SizedBox(width: 8),
      Focusable(
        onPressed: () => _launch(_siteUrl),
        tokens: t,
        borderRadius: 999,
        child: Container(
          height: 36,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: t.edgeSoft),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.north_east, size: 12, color: t.inkMuted),
              const SizedBox(width: 6),
              Text(
                'Browse all',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: t.inkMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    ],
  );
}

class _TabBar extends StatelessWidget {
  const _TabBar({
    required this.tokens,
    required this.value,
    required this.onChange,
  });

  final HarborTokens tokens;
  final String value;
  final void Function(String) onChange;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: t.canvas.withValues(alpha: 0.4),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final tab in _tabs)
            Focusable(
              onPressed: () => onChange(tab.id),
              tokens: t,
              borderRadius: 999,
              child: Container(
                height: 32,
                alignment: Alignment.center,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(999),
                  color: value == tab.id ? t.ink : Colors.transparent,
                ),
                child: Text(
                  tab.label,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: value == tab.id ? t.canvas : t.inkMuted,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _RailScroller extends StatelessWidget {
  const _RailScroller({
    required this.items,
    required this.installedIds,
    required this.onOpen,
    required this.onChange,
  });

  final List<SAAddon> items;
  final Set<String> installedIds;
  final void Function(String manifestId) onOpen;
  final VoidCallback? onChange;

  bool _installed(SAAddon a) {
    final id = a.manifest?.id;
    return id != null && id.isNotEmpty && installedIds.contains(id);
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 244,
      child: FocusTraversalGroup(
        policy: ReadingOrderTraversalPolicy(),
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: items.length,
          separatorBuilder: (_, _) => const SizedBox(width: 12),
          itemBuilder: (context, i) => _CommunityCard(
            addon: items[i],
            installed: _installed(items[i]),
            onOpen: onOpen,
            onChange: onChange,
          ),
        ),
      ),
    );
  }
}

class _CommunityCard extends ConsumerStatefulWidget {
  const _CommunityCard({
    required this.addon,
    required this.installed,
    required this.onOpen,
    required this.onChange,
  });

  final SAAddon addon;
  final bool installed;
  final void Function(String manifestId) onOpen;
  final VoidCallback? onChange;

  @override
  ConsumerState<_CommunityCard> createState() => _CommunityCardState();
}

class _CommunityCardState extends ConsumerState<_CommunityCard> {
  bool _busy = false;

  String? get _manifestId {
    final id = widget.addon.manifest?.id;
    return (id != null && id.isNotEmpty) ? id : null;
  }

  void _open() {
    final id = _manifestId;
    if (id != null) {
      widget.onOpen(id);
    } else {
      _launch(addonSiteUrl(widget.addon.slug));
    }
  }

  Future<void> _install() async {
    if (_manifestId == null || _busy) return;
    if (widget.addon.manifest?.needsConfiguration ?? false) {
      await _launch(configureUrlOf(widget.addon.manifestUrl));
      return;
    }
    setState(() => _busy = true);
    try {
      await ref
          .read(installedAddonsProvider.notifier)
          .install(
            widget.addon.manifestUrl,
            installedAt: DateTime.now().millisecondsSinceEpoch,
          );
      ref.invalidate(addonsCatalogProvider);
      widget.onChange?.call();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final m = widget.addon.manifest;
    final name = m?.name ?? widget.addon.slug;
    final description = m?.description ?? '';
    final logo = m?.logo;
    final background = m?.background;
    final types = (m?.types ?? const <String>[]).take(3).toList();

    return Focusable(
      onPressed: _open,
      tokens: t,
      borderRadius: 16,
      scale: 1.02,
      child: SizedBox(
        width: 280,
        child: Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            color: t.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: t.edgeSoft),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                height: 96,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (background != null && background.isNotEmpty)
                      CachedNetworkImage(
                        imageUrl: background,
                        fit: BoxFit.cover,
                      )
                    else
                      DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [t.elevated, t.raised],
                          ),
                        ),
                      ),
                    DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.bottomCenter,
                          end: Alignment.topCenter,
                          colors: [
                            t.surface,
                            t.surface.withValues(alpha: 0.3),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                    Positioned(
                      top: 10,
                      right: 10,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(999),
                          color: t.canvas.withValues(alpha: 0.7),
                          border: Border.all(
                            color: t.accent.withValues(alpha: 0.3),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.star, size: 10, color: t.accent),
                            const SizedBox(width: 4),
                            Text(
                              formatThousands(widget.addon.stars),
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: t.accent,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (logo != null && logo.isNotEmpty)
                      Positioned(
                        left: 10,
                        bottom: 10,
                        child: Container(
                          width: 40,
                          height: 40,
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(8),
                            color: t.canvas.withValues(alpha: 0.8),
                            border: Border.all(color: t.edgeSoft),
                          ),
                          child: CachedNetworkImage(
                            imageUrl: logo,
                            fit: BoxFit.contain,
                            errorWidget: (_, _, _) => const SizedBox.shrink(),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => _launch(addonSiteUrl(widget.addon.slug)),
                        child: Text(
                          name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            height: 1.15,
                            color: t.ink,
                          ),
                        ),
                      ),
                      if (description.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          description,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 11.5,
                            height: 1.3,
                            color: t.inkSubtle,
                          ),
                        ),
                      ],
                      const Spacer(),
                      Row(
                        children: [
                          Expanded(
                            child: Wrap(
                              spacing: 4,
                              runSpacing: 4,
                              children: [
                                for (final ty in types) _typeChip(t, ty),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          _action(t),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _typeChip(HarborTokens t, String ty) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(999),
      color: t.elevated.withValues(alpha: 0.6),
    ),
    child: Text(
      ty.toUpperCase(),
      style: TextStyle(
        fontSize: 9.5,
        fontWeight: FontWeight.w600,
        letterSpacing: 1.33,
        color: t.inkSubtle,
      ),
    ),
  );

  Widget _action(HarborTokens t) {
    // A comfortable touch target on a phone; the compact desktop size stays for
    // tablet/tv (pointer / remote).
    final btnHeight = Idiom.of(context).isPhone ? 44.0 : 32.0;
    if (widget.installed) {
      return Container(
        height: btnHeight,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          color: t.accent.withValues(alpha: 0.15),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.check, size: 11, color: t.accent),
            const SizedBox(width: 4),
            Text(
              'Installed',
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color: t.accent,
              ),
            ),
          ],
        ),
      );
    }
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: _manifestId == null ? null : _install,
      child: Opacity(
        opacity: _busy || _manifestId == null ? 0.4 : 1,
        child: Container(
          height: btnHeight,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            color: t.ink,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _busy
                  ? SizedBox(
                      width: 11,
                      height: 11,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation(t.canvas),
                      ),
                    )
                  : Icon(Icons.add, size: 11, color: t.canvas),
              const SizedBox(width: 4),
              Text(
                'Install',
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  color: t.canvas,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SkeletonRow extends StatelessWidget {
  const _SkeletonRow({required this.tokens});

  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 244,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: 6,
        separatorBuilder: (_, _) => const SizedBox(width: 12),
        itemBuilder: (_, _) => Container(
          width: 280,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color: tokens.elevated.withValues(alpha: 0.3),
            border: Border.all(color: tokens.edgeSoft),
          ),
        ),
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.tokens, required this.child});

  final HarborTokens tokens;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: tokens.canvas.withValues(alpha: 0.3),
        border: Border.all(color: tokens.edge, style: BorderStyle.solid),
      ),
      child: child,
    );
  }
}
