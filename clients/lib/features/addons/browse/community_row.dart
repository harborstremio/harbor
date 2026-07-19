import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/addons_providers.dart';
import '../../../core/net/safe_launch.dart';
import '../../../app/providers.dart';
import '../../../app/theme_controller.dart';
import '../../../design/addons/addon_logo.dart';
import '../../../design/focus/focusable.dart';
import '../../../design/tokens.dart';
import '../../../domain/addons/addon_url.dart';
import '../../../domain/addons/stremio_addons_client.dart';
import '../addon_utils.dart';
import '../widgets/card_art_backdrop.dart';

const _rose = Color(0xFFFDA4AF);
const _rose500 = Color(0xFFF43F5E);
const _emerald300 = Color(0xFF6EE7B7);
const _emerald500 = Color(0xFF10B981);

/// A browse-list row backed by a stremio-addons.net [SAAddon], ported 1:1 from
/// `CommunityRow`. Shows the addon with its star, rising, and new badges plus an
/// Install / Installed control; opens the detail (or the addon url) on select.
class CommunityRow extends ConsumerStatefulWidget {
  const CommunityRow({
    super.key,
    required this.addon,
    required this.installed,
    required this.onOpen,
    this.showRising = false,
    this.showNew = false,
    this.risingDelta,
    this.risingWindow,
    this.onChange,
  });

  final SAAddon addon;
  final bool installed;
  final bool showRising;
  final bool showNew;
  final num? risingDelta;
  final num? risingWindow;
  final void Function(String manifestId) onOpen;
  final VoidCallback? onChange;

  @override
  ConsumerState<CommunityRow> createState() => _CommunityRowState();
}

class _CommunityRowState extends ConsumerState<CommunityRow> {
  bool _busy = false;

  String? get _manifestId {
    final id = widget.addon.manifest?.id;
    return (id != null && id.isNotEmpty) ? id : null;
  }

  Future<void> _launch(String url) => launchExternalUrl(url);

  void _open() {
    final id = _manifestId;
    if (id != null) {
      widget.onOpen(id);
    } else {
      _launch(widget.addon.url);
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
    final logoUrl = resolveAddonLogo(m?.logo, widget.addon.manifestUrl);

    return Focusable(
      onPressed: _open,
      tokens: t,
      borderRadius: 16,
      scale: 1.01,
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: t.elevated,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: t.edgeSoft),
        ),
        child: Stack(
          children: [
            Positioned.fill(child: CardArtBackdrop(logoUrl: logoUrl)),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AddonLogo(
                    addonId: _manifestId ?? widget.addon.slug,
                    addonName: name,
                    manifestLogo: logoUrl,
                    size: AddonLogoSize.tile,
                  ),
                  const SizedBox(width: 20),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Wrap(
                          spacing: 8,
                          runSpacing: 6,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Text(
                              name,
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: t.ink,
                              ),
                            ),
                            if (widget.addon.stars > 0) _starBadge(t),
                            if (widget.showRising && widget.risingDelta != null)
                              _risingBadge(),
                            if (widget.showNew) _newBadge(),
                          ],
                        ),
                        if (description.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(
                            description,
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 13.5,
                              height: 1.55,
                              color: t.inkMuted,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  _action(t),
                  const SizedBox(width: 8),
                  Icon(Icons.chevron_right, size: 16, color: t.inkSubtle),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _action(HarborTokens t) {
    if (widget.installed) {
      return Container(
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: t.accent.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          'Installed',
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: t.accent,
          ),
        ),
      );
    }
    if (_manifestId == null) return const SizedBox.shrink();
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: _busy ? null : _install,
      child: Container(
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: t.ink,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_busy)
              SizedBox(
                width: 12,
                height: 12,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: t.canvas,
                ),
              )
            else
              Icon(Icons.add, size: 12, color: t.canvas),
            const SizedBox(width: 6),
            Text(
              'Install',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: t.canvas,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _starBadge(HarborTokens t) => _badge(
    bg: t.canvas.withValues(alpha: 0.7),
    fg: t.accent,
    ring: t.accent.withValues(alpha: 0.3),
    icon: Icons.star,
    label: formatThousands(widget.addon.stars),
  );

  Widget _risingBadge() {
    final window = widget.risingWindow;
    final windowLabel = window == null
        ? ''
        : ' / ${window == 1 ? '24h' : '${window.toInt()}d'}';
    return _badge(
      bg: _rose500.withValues(alpha: 0.15),
      fg: _rose,
      ring: _rose500.withValues(alpha: 0.4),
      icon: Icons.trending_up,
      label: '+${widget.risingDelta!.toInt()}$windowLabel',
    );
  }

  Widget _newBadge() => _badge(
    bg: _emerald500.withValues(alpha: 0.15),
    fg: _emerald300,
    ring: _emerald500.withValues(alpha: 0.3),
    icon: Icons.auto_awesome,
    label: 'NEW',
  );

  Widget _badge({
    required Color bg,
    required Color fg,
    required Color ring,
    required IconData icon,
    required String label,
  }) => Container(
    height: 20,
    padding: const EdgeInsets.symmetric(horizontal: 6),
    // No `alignment`: the Row already centres its icon+label vertically inside
    // the height:20, and an alignment would make the badge expand to the full
    // column width inside the name Wrap (bounded-loose constraints), stacking
    // one badge per line. Content-size it instead.
    decoration: BoxDecoration(
      color: bg,
      borderRadius: BorderRadius.circular(999),
      border: Border.all(color: ring),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 9, color: fg),
        const SizedBox(width: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 10.5,
            fontWeight: FontWeight.w700,
            color: fg,
          ),
        ),
      ],
    ),
  );
}
