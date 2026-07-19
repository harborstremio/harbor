import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme_controller.dart';
import '../../../design/focus/focusable.dart';
import '../addon_utils.dart';

const _installMinMs = 650;
const _uninstallMinMs = 450;

/// The shared install control for every addon card, ported 1:1 from
/// `InstallPill`. Four mutually-exclusive states — busy / installed (hover to
/// Remove) / needs-configure / install — each guaranteeing a minimum spinner
/// duration. Its own tap wins the gesture arena so it never bubbles to the
/// card's open handler.
class InstallPill extends ConsumerStatefulWidget {
  const InstallPill({
    super.key,
    required this.installed,
    required this.needsConfigure,
    required this.onInstall,
    required this.onUninstall,
    required this.onOpen,
  });

  final bool installed;
  final bool needsConfigure;
  final Future<void> Function() onInstall;
  final Future<void> Function() onUninstall;
  final VoidCallback onOpen;

  @override
  ConsumerState<InstallPill> createState() => _InstallPillState();
}

class _InstallPillState extends ConsumerState<InstallPill> {
  bool _busy = false;
  bool _hover = false;

  Future<void> _run(Future<void> Function() fn, int minMs) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await withMinDuration(fn(), Duration(milliseconds: minMs));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);

    if (_busy) {
      return _pill(
        bg: t.ink.withValues(alpha: 0.8),
        fg: t.canvas,
        onTap: null,
        child: _content(t.canvas, icon: null, label: 'Installing', spin: true),
      );
    }

    if (widget.installed) {
      final removing = _hover;
      return MouseRegion(
        onEnter: (_) => setState(() => _hover = true),
        onExit: (_) => setState(() => _hover = false),
        child: _pill(
          bg: removing
              ? t.danger.withValues(alpha: 0.15)
              : t.elevated.withValues(alpha: 0.7),
          fg: removing ? t.danger : t.ink,
          ring: removing ? t.danger.withValues(alpha: 0.3) : t.edgeSoft,
          onTap: () => _run(widget.onUninstall, _uninstallMinMs),
          child: _content(
            removing ? t.danger : t.accent,
            icon: removing ? Icons.close : Icons.check,
            label: removing ? 'Remove' : 'Installed',
            labelColor: removing ? t.danger : t.ink,
          ),
        ),
      );
    }

    if (widget.needsConfigure) {
      return _pill(
        bg: t.ink,
        fg: t.canvas,
        onTap: widget.onOpen,
        child: _content(t.canvas, icon: Icons.settings, label: 'Set up'),
      );
    }

    return _pill(
      bg: t.ink,
      fg: t.canvas,
      onTap: () => _run(widget.onInstall, _installMinMs),
      child: _content(t.canvas, icon: Icons.add, label: 'Install'),
    );
  }

  Widget _pill({
    required Color bg,
    required Color fg,
    required Widget child,
    Color? ring,
    required VoidCallback? onTap,
  }) {
    final pill = Container(
      height: 36,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: ring != null ? Border.all(color: ring) : null,
      ),
      child: child,
    );
    if (onTap == null) return pill;
    // A Focusable (not a bare GestureDetector) so a TV remote can focus the
    // pill separately from its card and Select it — its own activation wins the
    // gesture arena so it never bubbles to the card's open handler.
    return Focusable(
      tokens: ref.read(tokensProvider),
      scale: 1.0,
      borderRadius: 999,
      onPressed: onTap,
      child: pill,
    );
  }

  Widget _content(
    Color iconColor, {
    required IconData? icon,
    required String label,
    bool spin = false,
    Color? labelColor,
  }) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      if (spin)
        SizedBox(
          width: 14,
          height: 14,
          child: CircularProgressIndicator(strokeWidth: 2, color: iconColor),
        )
      else if (icon != null)
        Icon(icon, size: 14, color: iconColor),
      if (spin || icon != null) const SizedBox(width: 6),
      Text(
        label,
        style: TextStyle(
          fontSize: 13.5,
          fontWeight: FontWeight.w600,
          color: labelColor ?? iconColor,
        ),
      ),
    ],
  );
}
