import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../domain/addons/models.dart';
import '../../domain/nav/frame.dart';

const _nudgeKey = 'tmdb-nudge';

/// Manifest id/name patterns that mark an installed add-on as a TMDB metadata
/// provider — ported 1:1 from the web `TMDB_PROVIDER_ID_PATTERNS`.
final _tmdbProviderPatterns = <RegExp>[
  RegExp(r'^com\.aio\.metadata$', caseSensitive: false),
  RegExp('tmdb', caseSensitive: false),
  RegExp(r'^com\.stremio\.streaming-catalogs$', caseSensitive: false),
];

/// Whether any installed add-on already provides TMDB metadata (so the nudge to
/// add a personal key is unnecessary). Ported from `hasTmdbProviderAddon`.
bool hasTmdbProviderAddon(List<InstalledAddon> addons) => addons.any((a) {
  final id = a.manifest?.id ?? '';
  final name = a.manifest?.name ?? '';
  return _tmdbProviderPatterns.any(
    (re) => re.hasMatch(id) || re.hasMatch(name),
  );
});

/// Whether the TMDB nudge should be shown, ported from the web guard
/// `!settings.tmdbKey && !isDismissed(KEY) && !suppress` (with [suppress]
/// folding in classic mode + a TMDB-provider add-on). The caller gates the
/// prefix slot on this so a hidden nudge leaves no empty gap.
bool shouldShowTmdbNudge(WidgetRef ref, {required bool suppress}) {
  final hasKey = ref.watch(settingsProvider).tmdbKey.isNotEmpty;
  final dismissed = ref.watch(onboardingDismissedProvider).contains(_nudgeKey);
  final providedByAddon = hasTmdbProviderAddon(
    ref.watch(installedAddonsProvider),
  );
  return !hasKey && !dismissed && !suppress && !providedByAddon;
}

/// The "add a TMDB key" prompt at the top of Home, ported 1:1 from the web
/// `TmdbNudge`. Hidden once a key is set, the nudge is dismissed, a TMDB-provider
/// add-on is installed, or Home is in classic mode ([suppress]).
class TmdbNudge extends ConsumerWidget {
  const TmdbNudge({super.key, this.suppress = false});

  /// The classic-Home suppression (the web passes `homeMode === "classic"`).
  final bool suppress;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!shouldShowTmdbNudge(ref, suppress: suppress)) {
      return const SizedBox.shrink();
    }
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);

    return Container(
      decoration: BoxDecoration(
        color: t.raised.withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: t.edgeSoft),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          // A TMDB-branded badge stands in for the web logo asset.
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                colors: [Color(0xFF0D253F), Color(0xFF01B4E4)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: const Icon(
              Icons.local_movies_outlined,
              size: 20,
              color: Colors.white,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  tr.t('Add a TMDB key for the full Harbor'),
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  tr.t(
                    'Free key unlocks Trending, In Theaters, and per-service '
                    'catalogs. 60 seconds.',
                  ),
                  style: TextStyle(color: t.inkSubtle, fontSize: 12.5),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Focusable(
            tokens: t,
            borderRadius: 999,
            onPressed: () => ref
                .read(navControllerProvider.notifier)
                .setView(FrameKind.settings, {'category': 'library'}),
            child: Container(
              height: 36,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: t.ink,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    tr.t('Set up'),
                    style: TextStyle(
                      color: t.canvas,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Icon(Icons.arrow_forward, size: 14, color: t.canvas),
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),
          Focusable(
            tokens: t,
            borderRadius: 999,
            onPressed: () => ref
                .read(onboardingDismissedProvider.notifier)
                .dismiss(_nudgeKey),
            child: Container(
              width: 36,
              height: 36,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: t.surface.withValues(alpha: 0.6),
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.close, size: 16, color: t.inkSubtle),
            ),
          ),
        ],
      ),
    );
  }
}
