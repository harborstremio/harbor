import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme_controller.dart';
import '../../../design/addons/addon_logo.dart';
import '../../../design/focus/focusable.dart';
import '../../../domain/addons/resolved_addon.dart';
import '../addon_utils.dart';
import '../detail/addon_star_badge.dart';
import '../install/install_pill.dart';
import '../widgets/card_art_backdrop.dart';

/// A compact list-style addon card for the Discover pane, ported 1:1 from
/// `ListCard`: logo, name, star badge, a subtitle, and a trailing install pill.
class ListCard extends ConsumerWidget {
  const ListCard({
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
    final t = ref.watch(tokensProvider);
    final m = resolved.manifest;
    final logoUrl = resolveAddonLogo(m?.logo, resolved.transportUrl);
    final description = (m?.description?.isNotEmpty ?? false)
        ? m!.description!
        : subtitleFromManifest(resolved);

    return Focusable(
      onPressed: onOpen,
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
                    addonId: idOf(resolved),
                    addonName: nameOf(resolved),
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
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Text(
                              nameOf(resolved),
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: t.ink,
                              ),
                            ),
                            AddonStarBadge(
                              manifestId: m?.id,
                              size: AddonStarBadgeSize.sm,
                            ),
                          ],
                        ),
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
                    ),
                  ),
                  const SizedBox(width: 20),
                  InstallPill(
                    installed: installed,
                    needsConfigure: m?.needsConfiguration ?? false,
                    onInstall: onInstall,
                    onUninstall: onUninstall,
                    onOpen: onOpen,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
