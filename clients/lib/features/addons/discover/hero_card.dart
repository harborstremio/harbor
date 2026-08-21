import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme_controller.dart';
import '../../../design/addons/addon_logo.dart';
import '../../../design/focus/focusable.dart';
import '../../../design/kids/kids_gradient.dart';
import '../../../design/layout/idiom.dart';
import '../../../design/tokens.dart';
import '../../../domain/addons/resolved_addon.dart';
import '../addon_utils.dart';
import '../detail/addon_star_badge.dart';
import 'torrentio_hero_art.dart';

/// The addon that gets the poster-mosaic hero treatment (`isTorrentio`).
const String _torrentioId = 'com.stremio.torrentio.addon';

/// The featured Discover hero — the Torrentio poster mosaic, or an accent-washed
/// banner with the addon's oversized logo — over an eyebrow, title, subtitle and
/// a Get / View-details action. Ported 1:1 from `HeroCard`; renders nothing when
/// the resolved addon carries no curated hero.
class HeroCard extends ConsumerWidget {
  const HeroCard({
    super.key,
    required this.resolved,
    required this.onOpen,
    required this.onInstall,
    required this.onUninstall,
    required this.installed,
  });

  final ResolvedAddon resolved;
  final VoidCallback onOpen;
  final Future<void> Function() onInstall;
  final Future<void> Function() onUninstall;
  final bool installed;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hero = resolved.curated?.hero;
    if (hero == null) return const SizedBox.shrink();
    final t = ref.watch(tokensProvider);
    final isTorrentio = idOf(resolved) == _torrentioId;

    return Focusable(
      onPressed: onOpen,
      tokens: t,
      borderRadius: 24,
      scale: 1.01,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final w = constraints.maxWidth;
          final wide = w >= 768;
          // On a phone the desktop 40px insets + 42px display title crowd the
          // narrow text column, so shrink both (matching the detail hero's phone
          // treatment); tablet/tv keep the roomy 1:1 sizing.
          final compact = Idiom.of(context).isPhone;
          final heroPad = compact ? 22.0 : 40.0;
          return Container(
            constraints: const BoxConstraints(minHeight: 260),
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: t.surface,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: t.edgeSoft),
            ),
            child: Stack(
              children: [
                if (isTorrentio) ...[
                  if (wide)
                    Positioned(
                      top: 0,
                      bottom: 0,
                      right: 0,
                      width: w * 0.62,
                      child: const TorrentioHeroArt(),
                    ),
                ] else
                  ..._accentArt(t, hero.accent, w, wide),
                Padding(
                  padding: EdgeInsets.symmetric(
                    horizontal: heroPad,
                    vertical: heroPad,
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // On the narrow (phone-width) pane the side art/logo is
                      // hidden, so anchor the card with the addon's logo at the
                      // top — matching the detail hero's stacked phone treatment
                      // so the featured card is never a bare block of text.
                      if (compact) ...[
                        AddonLogo(
                          addonId: resolved.curated?.id ?? '',
                          addonName: resolved.manifest?.name ?? hero.title,
                          manifestLogo: resolveAddonLogo(
                            resolved.manifest?.logo,
                            resolved.transportUrl,
                          ),
                          size: AddonLogoSize.tile,
                        ),
                        const SizedBox(height: 16),
                      ],
                      Wrap(
                        spacing: 8,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(
                            hero.eyebrow.toUpperCase(),
                            style: TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 3.36,
                              color: t.inkSubtle,
                            ),
                          ),
                          AddonStarBadge(
                            manifestId: resolved.manifest?.id,
                            size: AddonStarBadgeSize.md,
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        hero.title,
                        style: TextStyle(
                          fontSize: compact ? 28 : 42,
                          fontWeight: FontWeight.w500,
                          height: 1.05,
                          letterSpacing: -0.5,
                          color: t.ink,
                        ),
                      ),
                      const SizedBox(height: 12),
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 416),
                        child: Text(
                          hero.subtitle,
                          style: TextStyle(
                            fontSize: 14.5,
                            height: 1.55,
                            color: t.inkMuted,
                          ),
                        ),
                      ),
                      const SizedBox(height: 28),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _getButton(t),
                          const SizedBox(width: 8),
                          _viewDetails(t),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  List<Widget> _accentArt(HarborTokens t, String accent, double w, bool wide) {
    final pair = _parseAccent(accent);
    return [
      if (pair != null)
        Positioned(
          top: 0,
          bottom: 0,
          right: 0,
          width: w * 0.5,
          child: Opacity(
            opacity: 0.6,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.centerRight,
                  end: Alignment.centerLeft,
                  colors: [pair.$1, pair.$2],
                ),
              ),
            ),
          ),
        ),
      Positioned(
        top: 0,
        bottom: 0,
        right: 0,
        width: w * 2 / 3,
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.centerRight,
              end: Alignment.centerLeft,
              colors: [Colors.transparent, t.surface],
            ),
          ),
        ),
      ),
      if (wide)
        Positioned.fill(
          child: Align(
            alignment: const Alignment(0.84, 0),
            child: AddonLogo(
              addonId: resolved.curated?.id ?? '',
              addonName:
                  resolved.manifest?.name ??
                  resolved.curated?.hero?.title ??
                  '',
              manifestLogo: resolveAddonLogo(
                resolved.manifest?.logo,
                resolved.transportUrl,
              ),
              size: AddonLogoSize.xxxxl,
            ),
          ),
        ),
    ];
  }

  /// Parses a Tailwind accent like `from-amber-400/40 to-orange-500/30` into its
  /// two alpha-weighted stop colors, or null when a stop cannot be resolved.
  (Color, Color)? _parseAccent(String accent) {
    Color? from;
    Color? to;
    for (final part in accent.split(RegExp(r'\s+'))) {
      if (part.startsWith('from-')) {
        from = _stop(part.substring(5));
      } else if (part.startsWith('to-')) {
        to = _stop(part.substring(3));
      }
    }
    if (from == null || to == null) return null;
    return (from, to);
  }

  Color? _stop(String token) {
    var name = token;
    var alpha = 1.0;
    final slash = token.indexOf('/');
    if (slash >= 0) {
      final pct = int.tryParse(token.substring(slash + 1));
      if (pct != null) alpha = pct / 100;
      name = token.substring(0, slash);
    }
    final c = tailwindColor(name);
    return c?.withValues(alpha: alpha);
  }

  Widget _getButton(HarborTokens t) {
    final child = Container(
      height: 36,
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      decoration: BoxDecoration(
        color: installed ? t.elevated.withValues(alpha: 0.7) : t.ink,
        borderRadius: BorderRadius.circular(999),
        border: installed ? Border.all(color: t.edgeSoft) : null,
      ),
      child: Text(
        installed ? 'Installed' : 'Get',
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: installed ? t.ink : t.canvas,
        ),
      ),
    );
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => installed ? onUninstall() : onInstall(),
      child: child,
    );
  }

  Widget _viewDetails(HarborTokens t) => Container(
    height: 36,
    padding: const EdgeInsets.symmetric(horizontal: 16),
    alignment: Alignment.center,
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'View details',
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w500,
            color: t.inkMuted,
          ),
        ),
        const SizedBox(width: 4),
        Icon(Icons.chevron_right, size: 13, color: t.inkMuted),
      ],
    ),
  );
}
