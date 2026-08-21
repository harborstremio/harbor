import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/nav/deep_link.dart';
import '../domain/nav/frame.dart';
import 'nav_controller.dart';
import 'providers.dart';

/// The incoming-link source behind the deep-link bridge, abstracted so tests can
/// feed links without the platform channel.
abstract interface class AppLinksSource {
  Future<Uri?> getInitialLink();
  Stream<Uri> get uriStream;
}

class _AppLinksAdapter implements AppLinksSource {
  final AppLinks _links = AppLinks();

  @override
  Future<Uri?> getInitialLink() => _links.getInitialLink();

  @override
  Stream<Uri> get uriStream => _links.uriLinkStream;
}

final appLinksSourceProvider = Provider<AppLinksSource>(
  (ref) => _AppLinksAdapter(),
);

/// The addon-install URL captured from a deep link, awaiting confirmation. The
/// addons view consumes it to open the install modal, then clears it.
class PendingInstallController extends Notifier<String?> {
  @override
  String? build() => null;

  void set(String? url) => state = url;
}

final pendingDeepLinkInstallProvider =
    NotifierProvider<PendingInstallController, String?>(
      PendingInstallController.new,
    );

/// A "Who's watching?" picker request captured from a deep link
/// (`harbor://profiles`) or an assistant phrase. The link bridge has no
/// `BuildContext`, and the profile picker needs one, so the request is parked
/// here for the [LaunchPickerGate] to present, then cleared.
class PendingProfilePickerController extends Notifier<bool> {
  @override
  bool build() => false;

  void request() => state = true;

  void clear() => state = false;
}

final pendingProfilePickerProvider =
    NotifierProvider<PendingProfilePickerController, bool>(
      PendingProfilePickerController.new,
    );

/// The deep-link bridge: classifies incoming `stremio://` / addon links and
/// either opens the title's detail or routes to the addons view with the
/// install URL pending. Ported from `startDeepLinkBridge`'s dispatch; the
/// platform Tauri wiring becomes an [AppLinksSource] stream.
class DeepLinkService {
  DeepLinkService(this._ref);

  final Ref _ref;
  StreamSubscription<Uri>? _sub;

  static const _quickActionChannel = MethodChannel('harbor/quick_action');

  /// Begins listening for links (and handles the launch link). All platform
  /// access is guarded so an unsupported platform or test host is a no-op.
  Future<void> start() async {
    try {
      final source = _ref.read(appLinksSourceProvider);
      final initial = await source.getInitialLink();
      if (initial != null) handle(initial.toString());
      _sub = source.uriStream.listen(
        (uri) => handle(uri.toString()),
        onError: (_) {},
      );
    } catch (_) {}

    // iOS Home-Screen quick actions (UIApplicationShortcutItem) arrive over a
    // separate channel — the launch shortcut is queried once, later taps stream
    // in — but resolve to the same `harbor://` routes as every other deep link.
    try {
      final initialAction = await _quickActionChannel.invokeMethod<String>(
        'getInitialQuickAction',
      );
      if (initialAction != null && initialAction.isNotEmpty) {
        handle(initialAction);
      }
      _quickActionChannel.setMethodCallHandler((call) async {
        if (call.method == 'handle' && call.arguments is String) {
          handle(call.arguments as String);
        }
        return null;
      });
    } catch (_) {}
  }

  /// Dispatches one link. Public so the bridge can be driven in tests.
  void handle(String url) {
    switch (classifyDeepLink(url)) {
      case DeepLinkOpenDetail(open: final open):
        _ref
            .read(navControllerProvider.notifier)
            .push(Frame(FrameKind.meta, {'type': open.type, 'id': open.id}));
      case DeepLinkInstall(rawUrl: final raw):
        _ref.read(navControllerProvider.notifier).setView(FrameKind.addons);
        _ref.read(pendingDeepLinkInstallProvider.notifier).set(raw);
      case DeepLinkAppAction(target: final target):
        switch (target) {
          case DeepLinkTarget.search:
            _ref.read(searchOpenProvider.notifier).open();
          case DeepLinkTarget.continueWatching:
            _ref.read(navControllerProvider.notifier).setView(FrameKind.home);
          case DeepLinkTarget.profiles:
            // The picker needs a BuildContext (LaunchPickerGate presents it).
            _ref.read(pendingProfilePickerProvider.notifier).request();
        }
      case DeepLinkIgnore():
        break;
    }
  }

  void dispose() {
    _sub?.cancel();
    _sub = null;
  }
}

final deepLinkServiceProvider = Provider<DeepLinkService>((ref) {
  final service = DeepLinkService(ref);
  ref.onDispose(service.dispose);
  return service;
});
