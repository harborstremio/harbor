import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/shell/launch_picker_gate.dart';
import 'deep_link_providers.dart';
import 'i18n_providers.dart';
import 'sfx_providers.dart';
import 'stremio_auth.dart';
import 'theme_controller.dart';

class HarborApp extends ConsumerStatefulWidget {
  const HarborApp({super.key});

  @override
  ConsumerState<HarborApp> createState() => _HarborAppState();
}

class _HarborAppState extends ConsumerState<HarborApp>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Start the deep-link bridge once the app is up (guarded — a no-op on hosts
    // without the platform channel).
    ref.read(deepLinkServiceProvider).start();
    // Refresh the Stremio-library continue-watching on launch so a returning
    // user (session restored, not freshly signed in) gets a fresh CW shelf.
    ref.read(stremioSessionProvider.notifier).refreshLibrary();
    // Warm the SFX player ring + audio context once at start (no user gesture
    // needed on native). Silent until a sound theme is enabled in settings.
    ref.read(sfxServiceProvider).init();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState lifecycle) {
    // Foregrounding re-pulls the library continue-watching (the web home's
    // focus / visibility refresh), so playback started on another device shows
    // up here promptly.
    if (lifecycle == AppLifecycleState.resumed) {
      ref.read(stremioSessionProvider.notifier).refreshLibrary();
    }
  }

  @override
  Widget build(BuildContext context) {
    // Arabic lays the whole app out right-to-left (`docs/60-…` RTL).
    final rtl = ref.watch(isRtlProvider);
    // Keep the SFX service synced to soundTheme / sfxVolume (web App effect).
    ref.watch(sfxSyncProvider);
    return MaterialApp(
      title: 'Harbor',
      debugShowCheckedModeBanner: false,
      theme: ref.watch(themeDataProvider),
      builder: (context, child) => Directionality(
        textDirection: rtl ? TextDirection.rtl : TextDirection.ltr,
        child: child ?? const SizedBox.shrink(),
      ),
      home: const LaunchPickerGate(),
    );
  }
}
