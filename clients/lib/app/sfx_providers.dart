import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../design/focus/ui_sound.dart';
import '../features/sfx/sfx_service.dart';
import 'providers.dart';

/// The app-wide SFX player. Constructed once; disposed with the container. Also
/// registers itself as the global [uiSound] sink so low-level widgets (the
/// shared Focusable) can play UI sounds without a Riverpod dependency.
final sfxServiceProvider = Provider<SfxService>((ref) {
  final svc = SfxService();
  uiSound = svc;
  ref.onDispose(() {
    if (identical(uiSound, svc)) uiSound = null;
    svc.dispose();
  });
  return svc;
});

/// Keeps the SFX service in sync with the `soundTheme` / `sfxVolume` settings.
/// Watching this (in the shell) applies the current values immediately and on
/// every subsequent change — mirroring the web App effect that calls
/// `SFX.setTheme` / `SFX.setVolume`. `sfxVolume` is stored on the web 0–100
/// scale, so it is divided by 100 here.
final sfxSyncProvider = Provider<void>((ref) {
  final svc = ref.watch(sfxServiceProvider);
  svc.setTheme(ref.watch(settingsProvider.select((s) => s.getString('soundTheme'))));
  svc.setVolume(
    ref.watch(settingsProvider.select((s) => s.getInt('sfxVolume') / 100)),
  );
});
