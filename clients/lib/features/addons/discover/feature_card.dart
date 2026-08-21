import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme_controller.dart';
import '../../../design/addons/addon_logo.dart';
import '../../../design/focus/focusable.dart';
import '../../../domain/addons/resolved_addon.dart';
import '../addon_utils.dart';
import '../detail/addon_star_badge.dart';
import '../detail/tag_row.dart';
import '../install/install_pill.dart';
import '../widgets/card_art_backdrop.dart';

/// A featured addon card for the Discover pane, ported 1:1 from `FeatureCard`:
/// logo, name, star badge, an install pill, a description, and the tag row.
class FeatureCard extends ConsumerWidget {
  const FeatureCard({
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
    final description = m?.description;

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
              padding: const EdgeInsets.all(24),
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
                        Row(
                          children: [
                            Expanded(
                              child: Row(
                                children: [
                                  Flexible(
                                    child: Text(
                                      nameOf(resolved),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 16.5,
                                        fontWeight: FontWeight.w600,
                                        color: t.ink,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  AddonStarBadge(
                                    manifestId: m?.id,
                                    size: AddonStarBadgeSize.sm,
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 12),
                            InstallPill(
                              installed: installed,
                              needsConfigure: m?.needsConfiguration ?? false,
                              onInstall: onInstall,
                              onUninstall: onUninstall,
                              onOpen: onOpen,
                            ),
                          ],
                        ),
                        if (description != null && description.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            description,
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 13,
                              height: 1.5,
                              color: t.inkMuted,
                            ),
                          ),
                        ],
                        TagRow(resolved: resolved),
                      ],
                    ),
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
