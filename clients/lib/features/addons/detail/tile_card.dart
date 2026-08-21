import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme_controller.dart';
import '../../../design/addons/addon_logo.dart';
import '../../../design/focus/focusable.dart';
import '../../../design/tokens.dart';
import '../../../domain/addons/resolved_addon.dart';
import '../addon_utils.dart';
import '../widgets/card_art_backdrop.dart';
import 'addon_star_badge.dart';

const _emerald300 = Color(0xFF6EE7B7);
const _emerald500 = Color(0xFF10B981);

/// An addon tile in a detail rail — logo, name, community stars, description,
/// and an install / set-up / installed action. Ported 1:1 from `TileCard`.
class TileCard extends ConsumerStatefulWidget {
  const TileCard({
    super.key,
    required this.resolved,
    required this.onOpen,
    required this.onInstall,
    required this.installed,
  });

  final ResolvedAddon resolved;
  final VoidCallback onOpen;
  final Future<void> Function() onInstall;
  final bool installed;

  @override
  ConsumerState<TileCard> createState() => _TileCardState();
}

class _TileCardState extends ConsumerState<TileCard> {
  bool _installing = false;

  bool get _configurable =>
      widget.resolved.manifest?.needsConfiguration ?? false;

  Future<void> _handle() async {
    if (widget.installed || _installing) return;
    if (_configurable) {
      widget.onOpen();
      return;
    }
    setState(() => _installing = true);
    try {
      await widget.onInstall();
    } finally {
      if (mounted) setState(() => _installing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final m = widget.resolved.manifest;
    final description = (m?.description?.isNotEmpty ?? false)
        ? m!.description!
        : subtitleFromManifest(widget.resolved);
    final logoUrl = resolveAddonLogo(m?.logo, widget.resolved.transportUrl);

    return Focusable(
      onPressed: widget.onOpen,
      tokens: t,
      borderRadius: 16,
      scale: 1.02,
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
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      AddonLogo(
                        addonId: idOf(widget.resolved),
                        addonName: nameOf(widget.resolved),
                        manifestLogo: logoUrl,
                        size: AddonLogoSize.tile,
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              nameOf(widget.resolved),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 15.5,
                                fontWeight: FontWeight.w600,
                                height: 1.1,
                                color: t.ink,
                              ),
                            ),
                            const SizedBox(height: 4),
                            AddonStarBadge(
                              manifestId: m?.id,
                              size: AddonStarBadgeSize.xs,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
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
                  const SizedBox(height: 16),
                  const Spacer(),
                  _button(t),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _button(HarborTokens t) {
    final installed = widget.installed;
    final (bg, fg, child) = installed
        ? (
            _emerald500.withValues(alpha: 0.15),
            _emerald300,
            _label(Icons.check, 'Installed'),
          )
        : _installing
        ? (
            t.ink.withValues(alpha: 0.8),
            t.canvas,
            _label(null, 'Installing', spin: true),
          )
        : _configurable
        ? (t.ink, t.canvas, _label(Icons.settings, 'Set up'))
        : (t.ink, t.canvas, _label(null, 'Install'));

    final enabled = !installed && !_installing;
    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: enabled ? _handle : null,
        child: SizedBox(
          height: 44,
          child: Center(
            child: DefaultTextStyle(
              style: TextStyle(
                color: fg,
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
              ),
              child: IconTheme(
                data: IconThemeData(color: fg, size: 14),
                child: child,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _label(IconData? icon, String text, {bool spin = false}) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      if (spin)
        const SizedBox(
          width: 14,
          height: 14,
          child: CircularProgressIndicator(strokeWidth: 2),
        )
      else if (icon != null)
        Icon(icon),
      if (spin || icon != null) const SizedBox(width: 6),
      Text(text),
    ],
  );
}
