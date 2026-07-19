import 'dart:io';
import 'dart:math' show Random;
import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:media_kit/media_kit.dart';

import 'app/app.dart';
import 'app/bug_report_providers.dart';
import 'app/providers.dart';
import 'core/storage/kv_store.dart';
import 'core/storage/secure_store.dart';
import 'design/layout/idiom.dart';
import 'domain/bug_report/bug_report.dart';

/// Resolves the TV flavor from the native `harbor/platform` channel before the
/// first frame, so [kPlatformIsTv] gates the ten-foot idiom and sender-only
/// features (Chromecast / PiP). Degrades to the width heuristic on failure.
Future<bool> _detectPlatformTv() async {
  if (!(Platform.isAndroid || Platform.isIOS)) return false;
  try {
    return await const MethodChannel(
          'harbor/platform',
        ).invokeMethod<bool>('isTv') ??
        false;
  } catch (_) {
    return false;
  }
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  MediaKit.ensureInitialized();
  kPlatformIsTv = await _detectPlatformTv();
  final kv = await HiveKvStore.open('harbor');
  final container = ProviderContainer(
    overrides: [
      kvStoreProvider.overrideWithValue(kv),
      // Secrets go to the platform keychain/keystore, never plaintext prefs.
      secureStoreProvider.overrideWithValue(FlutterSecureStore()),
    ],
  );

  // Auto-create the primary profile on first run, so the app is never entered
  // without one — the native counterpart of the web profiles-store initializer
  // (`profiles.tsx` seeds a primary when `profiles.length === 0`). It adopts the
  // stored Harbor identity (avatar/colour) and a "Guest NNNN" name, exactly like
  // web's `defaultPrimaryName`. A no-op once any profile exists.
  final settings = container.read(settingsProvider);
  await container
      .read(profilesRepoProvider)
      .ensureDefaultProfile(
        name: _defaultPrimaryName(),
        avatar: (settings.getString('harborAvatar')).isEmpty
            ? null
            : settings.getString('harborAvatar'),
        color: (settings.getString('harborColor')).isEmpty
            ? null
            : settings.getString('harborColor'),
      );

  // Feed the bug-report diagnostics buffer from framework + async errors
  // (web `installBugReportErrorCapture`), keeping the default handlers.
  final errors = container.read(bugReportErrorsProvider);
  _installErrorCapture(errors);

  runApp(
    UncontrolledProviderScope(container: container, child: const HarborApp()),
  );
}

/// The default primary-profile name — `Guest NNNN`, matching web's
/// `generateGuestName`.
String _defaultPrimaryName() => 'Guest ${1000 + Random().nextInt(9000)}';

void _installErrorCapture(BugReportErrors errors) {
  int now() => DateTime.now().millisecondsSinceEpoch;
  final priorFlutterError = FlutterError.onError;
  FlutterError.onError = (details) {
    errors.push(details.exceptionAsString(), src: 'FlutterError', nowMs: now());
    priorFlutterError?.call(details);
  };
  final priorPlatformError = PlatformDispatcher.instance.onError;
  PlatformDispatcher.instance.onError = (error, stack) {
    errors.push('$error', src: 'PlatformDispatcher', nowMs: now());
    return priorPlatformError?.call(error, stack) ?? false;
  };
}
