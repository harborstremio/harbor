import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/nav_controller.dart';
import '../../app/profiles_providers.dart';
import '../../domain/nav/frame.dart';

/// Confines a kid profile to the kids surface, ported from the web `App.tsx`
/// kids routing effects: a kid session may only rest on the kids surface, a
/// title/detail, the play-picker, a grid, or a collection (and the player) —
/// anything else snaps back to the kids home. Leaving a kid profile while on the
/// kids surface returns to the normal home. Renders nothing; it only steers nav.
class KidsConfinementGuard extends ConsumerStatefulWidget {
  const KidsConfinementGuard({super.key});

  @override
  ConsumerState<KidsConfinementGuard> createState() =>
      _KidsConfinementGuardState();
}

class _KidsConfinementGuardState extends ConsumerState<KidsConfinementGuard> {
  /// The frames a kid session is allowed to sit on (the player is left alone so
  /// the curfew, not routing, governs playback).
  static const _kidAllowed = {
    FrameKind.kids,
    FrameKind.kidsFranchise,
    FrameKind.meta,
    FrameKind.picker,
    FrameKind.grid,
    FrameKind.collection,
    FrameKind.player,
  };

  @override
  Widget build(BuildContext context) {
    final isKid = ref.watch(activeProfileProvider)?.isKid ?? false;
    final kind = ref.watch(activeFrameProvider).kind;

    FrameKind? target;
    if (isKid) {
      if (!_kidAllowed.contains(kind)) target = FrameKind.kids;
    } else if (kind == FrameKind.kids || kind == FrameKind.kidsFranchise) {
      target = FrameKind.home;
    }

    if (target != null) {
      final next = target;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) ref.read(navControllerProvider.notifier).setView(next);
      });
    }
    return const SizedBox.shrink();
  }
}
