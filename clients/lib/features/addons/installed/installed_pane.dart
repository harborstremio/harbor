import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/addons_providers.dart';
import '../../../app/nav_controller.dart';
import '../../../app/providers.dart';
import '../../../app/theme_controller.dart';
import '../../../design/addons/addon_logo.dart';
import '../../../design/focus/focusable.dart';
import '../../../design/layout/idiom.dart';
import '../../../design/tokens.dart';
import '../../../domain/addons/resolved_addon.dart';
import '../../../domain/nav/frame.dart';
import '../addon_utils.dart';

/// The Installed tab — the user's installed addons with enable/disable, remove,
/// reorder (via the Organize page) and open-detail, filtered by the page search.
/// Ported 1:1 from `InstalledPane`.
class InstalledPane extends ConsumerWidget {
  const InstalledPane({
    super.key,
    required this.search,
    required this.onOpen,
    required this.onManage,
  });

  final String? search;
  final void Function(String id) onOpen;
  final void Function(ResolvedAddon) onManage;

  Future<void> _remove(WidgetRef ref, ResolvedAddon r) async {
    await ref.read(installedAddonsProvider.notifier).uninstall(r.transportUrl);
    await ref
        .read(disabledAddonsProvider.notifier)
        .prune(
          ref.read(installedAddonsProvider).map((a) => a.transportUrl).toSet(),
        );
    ref.invalidate(addonsCatalogProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tokensProvider);
    final rawInstalled = ref.watch(installedAddonsProvider);
    final disabled = ref.watch(disabledAddonsProvider);
    final resolved = ref.watch(installedResolvedProvider).value;
    final q = (search ?? '').trim().toLowerCase();

    if (rawInstalled.isEmpty) {
      return _emptyCard(t);
    }
    if (resolved == null) {
      return const Center(child: CircularProgressIndicator(strokeWidth: 2));
    }

    final filtered = q.isEmpty
        ? resolved
        : [
            for (final r in resolved)
              if (_matches(r, q)) r,
          ];

    if (filtered.isEmpty) {
      return _noMatchCard(t, rawInstalled.length);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: Alignment.centerRight,
          child: Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _reorderButton(ref, t),
          ),
        ),
        Expanded(
          child: SingleChildScrollView(
            // Clear the TV overscan crop at the bottom so the last row isn't
            // eaten by the bezel; phone/tablet keep the tight 20.
            padding: EdgeInsets.only(
              bottom: 20 + overscanInset(Idiom.of(context)).bottom,
            ),
            child: LayoutBuilder(
              builder: (context, constraints) {
                // The 1:1 rule (web grid-cols-1 lg:grid-cols-2): reflow at the
                // pane's real width, not an ad-hoc 900px literal.
                final cols = gridColumnsFor(
                  AddonGrid.installed,
                  constraints.maxWidth,
                );
                return Column(
                  children: _rows(ref, t, disabled, filtered, cols),
                );
              },
            ),
          ),
        ),
      ],
    );
  }

  bool _matches(ResolvedAddon r, String q) {
    final m = r.manifest;
    final name = (m?.name ?? '').toLowerCase();
    final desc = (m?.description ?? '').toLowerCase();
    final id = idOf(r).toLowerCase();
    return name.contains(q) || desc.contains(q) || id.contains(q);
  }

  List<Widget> _rows(
    WidgetRef ref,
    HarborTokens t,
    Set<String> disabled,
    List<ResolvedAddon> items,
    int cols,
  ) {
    final rows = <Widget>[];
    for (var i = 0; i < items.length; i += cols) {
      final rowItems = items.skip(i).take(cols).toList();
      rows.add(
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var j = 0; j < cols; j++) ...[
                if (j > 0) const SizedBox(width: 8),
                Expanded(
                  child: j < rowItems.length
                      ? _InstalledRow(
                          resolved: rowItems[j],
                          tokens: t,
                          disabled: disabled.contains(rowItems[j].transportUrl),
                          onOpen: () => onOpen(idOf(rowItems[j])),
                          onManage:
                              (rowItems[j].manifest?.needsConfiguration ??
                                  false)
                              ? () => onManage(rowItems[j])
                              : null,
                          onToggle: () => ref
                              .read(disabledAddonsProvider.notifier)
                              .toggle(rowItems[j].transportUrl),
                          onRemove: () => _remove(ref, rowItems[j]),
                        )
                      : const SizedBox.shrink(),
                ),
              ],
            ],
          ),
        ),
      );
      if (i + cols < items.length) rows.add(const SizedBox(height: 8));
    }
    return rows;
  }

  Widget _reorderButton(WidgetRef ref, HarborTokens t) => Focusable(
    tokens: t,
    borderRadius: 999,
    onPressed: () => ref
        .read(navControllerProvider.notifier)
        .push(const Frame(FrameKind.organizeAddons)),
    child: Container(
      height: 36,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      // No alignment — the Row(min) centres vertically; an alignment would
      // stretch the pill full-width and defeat the enclosing right-align.
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.swap_vert, size: 13, color: t.inkSubtle),
          const SizedBox(width: 6),
          Text(
            'REORDER',
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

  Widget _emptyCard(HarborTokens t) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(48),
    decoration: BoxDecoration(
      color: t.elevated.withValues(alpha: 0.3),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: t.edgeSoft),
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'No addons installed yet',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w500,
            color: t.ink,
          ),
        ),
        const SizedBox(height: 8),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 448),
          child: Text(
            'Head to Discover. Cinemeta and OpenSubtitles cover the basics; '
            'Torrentio + a debrid key cover almost everything else.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13.5, height: 1.5, color: t.inkMuted),
          ),
        ),
      ],
    ),
  );

  Widget _noMatchCard(HarborTokens t, int total) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(40),
    decoration: BoxDecoration(
      color: t.canvas.withValues(alpha: 0.3),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: t.edgeSoft),
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'No installed addon matches that.',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w500,
            color: t.ink,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Clear the search to see all $total installed.',
          style: TextStyle(fontSize: 12.5, color: t.inkSubtle),
        ),
      ],
    ),
  );
}

class _InstalledRow extends StatefulWidget {
  const _InstalledRow({
    required this.resolved,
    required this.tokens,
    required this.disabled,
    required this.onOpen,
    required this.onManage,
    required this.onToggle,
    required this.onRemove,
  });

  final ResolvedAddon resolved;
  final HarborTokens tokens;
  final bool disabled;
  final VoidCallback onOpen;
  final VoidCallback? onManage;
  final VoidCallback onToggle;
  final Future<void> Function() onRemove;

  @override
  State<_InstalledRow> createState() => _InstalledRowState();
}

class _InstalledRowState extends State<_InstalledRow> {
  bool _busy = false;

  Future<void> _remove() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await widget.onRemove();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final r = widget.resolved;
    final enabled = !widget.disabled;
    final subtitle = enabled
        ? subtitleFromManifest(r)
        : 'Off · catalogs and streams hidden';
    final logoUrl = resolveAddonLogo(r.manifest?.logo, r.transportUrl);

    return Opacity(
      opacity: _busy ? 0.6 : 1,
      child: Focusable(
        tokens: t,
        borderRadius: 12,
        onPressed: _busy ? () {} : widget.onOpen,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: t.elevated,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: t.edgeSoft),
          ),
          child: Builder(
            builder: (context) {
              final logo = Opacity(
                opacity: enabled ? 1 : 0.45,
                child: AddonLogo(
                  addonId: idOf(r),
                  addonName: nameOf(r),
                  manifestLogo: logoUrl,
                  size: AddonLogoSize.lg,
                ),
              );
              final info = Expanded(
                child: Opacity(
                  opacity: enabled ? 1 : 0.55,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        nameOf(r),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: t.ink,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 11.5, color: t.inkSubtle),
                      ),
                    ],
                  ),
                ),
              );
              final controls = <Widget>[
                if (!_busy) ...[
                  const SizedBox(width: 12),
                  _Toggle(tokens: t, on: enabled, onTap: widget.onToggle),
                ],
                if (!_busy && widget.onManage != null) ...[
                  const SizedBox(width: 8),
                  _managePill(t, widget.onManage!),
                ],
                const SizedBox(width: 10),
                _removePill(t),
              ];
              // On a phone the trailing controls (toggle + Manage + Remove) would
              // squeeze the name to a sliver, so drop them onto a second,
              // right-aligned line; tablet/tv keep the roomy inline row.
              if (!Idiom.of(context).isPhone) {
                return Row(
                  children: [
                    logo,
                    const SizedBox(width: 14),
                    info,
                    ...controls,
                  ],
                );
              }
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(children: [logo, const SizedBox(width: 14), info]),
                  const SizedBox(height: 12),
                  Row(children: [const Spacer(), ...controls]),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _managePill(HarborTokens t, VoidCallback onManage) => Focusable(
    tokens: t,
    borderRadius: 999,
    onPressed: onManage,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(
        color: t.raised,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.settings, size: 12, color: t.inkMuted),
          const SizedBox(width: 6),
          Text(
            'Manage',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: t.inkMuted,
            ),
          ),
        ],
      ),
    ),
  );

  Widget _removePill(HarborTokens t) {
    final child = Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(
        color: _busy
            ? t.danger.withValues(alpha: 0.15)
            : t.elevated.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: _busy ? t.danger.withValues(alpha: 0.3) : t.edgeSoft,
        ),
      ),
      child: Text(
        _busy ? 'Uninstalling…' : 'Installed',
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: _busy ? t.danger : t.ink,
        ),
      ),
    );
    if (_busy) return child;
    return Focusable(
      tokens: t,
      borderRadius: 999,
      onPressed: _remove,
      child: child,
    );
  }
}

/// The iOS-style enable switch on an installed addon, ported from the web toggle.
class _Toggle extends StatelessWidget {
  const _Toggle({required this.tokens, required this.on, required this.onTap});

  final HarborTokens tokens;
  final bool on;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Focusable(
      tokens: t,
      borderRadius: 999,
      onPressed: onTap,
      child: Container(
        width: 40,
        height: 22,
        decoration: BoxDecoration(
          color: on ? t.accent : t.edge.withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(999),
          border: on ? null : Border.all(color: t.edgeSoft),
        ),
        child: AnimatedAlign(
          duration: const Duration(milliseconds: 180),
          alignment: on ? Alignment.centerRight : Alignment.centerLeft,
          child: Padding(
            padding: const EdgeInsets.all(3),
            child: Container(
              width: 16,
              height: 16,
              decoration: BoxDecoration(
                color: t.ink,
                shape: BoxShape.circle,
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x80000000),
                    blurRadius: 2,
                    offset: Offset(0, 1),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
