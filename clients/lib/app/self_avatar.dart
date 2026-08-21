import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'providers.dart';
import 'stremio_auth.dart';

/// The identity-avatar fallback for the active ("self") profile chip — the part
/// of Harbor's `activeProfile?.avatar ?? harborAvatar ?? user?.avatar` chain
/// that comes *after* the profile's own avatar: the global `harborAvatar`
/// identity mirror, then the signed-in Stremio account avatar. Null when
/// neither is set (the chip then shows the initials/colour placeholder).
///
/// Only the self chip consumes this; every other avatar surface shows the
/// profile's own avatar, matching web (the picker tiles, PIN unlock, and the
/// editor preview never borrow another identity's picture).
final harborFallbackAvatarProvider = Provider<String?>((ref) {
  final harbor = ref.watch(settingsProvider)['harborAvatar'];
  // A reserved `/kids/avatars/…` path is treated as absent so the chain falls
  // through to the Stremio account avatar (web `profile-chip.tsx` does the same):
  // a kid avatar must never leak into the shared Harbor identity. (This is an
  // identity-isolation rule, not a rendering limit — ProfileAvatar can now render
  // catalog/kid asset paths, so a `/avatars/<id>.webp` harborAvatar shows fine.)
  if (harbor is String &&
      harbor.isNotEmpty &&
      !harbor.startsWith('/kids/avatars/')) {
    return harbor;
  }
  final user = ref.watch(stremioSessionProvider).asData?.value?.user;
  final avatar = user?.avatar;
  if (avatar != null && avatar.isNotEmpty) return avatar;
  return null;
});
