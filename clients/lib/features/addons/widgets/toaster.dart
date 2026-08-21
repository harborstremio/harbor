import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme_controller.dart';

enum ToastKind { ok, error }

/// A transient toast, ported from the web `ToastInfo` (only the addon name is
/// surfaced in the toast body).
class ToastInfo {
  const ToastInfo({required this.kind, required this.text, this.addonName});

  final ToastKind kind;
  final String text;
  final String? addonName;
}

/// Holds the current toast and auto-clears it — ok after 3s, error after 5s,
/// cancelling any prior timer. Ports the `showToast` logic from the web page.
class ToastController extends Notifier<ToastInfo?> {
  Timer? _timer;

  @override
  ToastInfo? build() {
    ref.onDispose(() => _timer?.cancel());
    return null;
  }

  void show(ToastKind kind, String text, {String? addonName}) {
    _timer?.cancel();
    state = ToastInfo(kind: kind, text: text, addonName: addonName);
    _timer = Timer(
      Duration(milliseconds: kind == ToastKind.error ? 5000 : 3000),
      () => state = null,
    );
  }
}

final toastControllerProvider = NotifierProvider<ToastController, ToastInfo?>(
  ToastController.new,
);

/// The toast pill, ported 1:1 from `Toaster`. Place it in a `Stack`; it
/// bottom-centers itself and renders nothing when there is no toast.
class Toaster extends ConsumerWidget {
  const Toaster({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final toast = ref.watch(toastControllerProvider);
    if (toast == null) return const SizedBox.shrink();
    final t = ref.watch(tokensProvider);
    final ok = toast.kind == ToastKind.ok;

    return Align(
      alignment: Alignment.bottomCenter,
      child: Padding(
        padding: const EdgeInsets.only(bottom: 24),
        child: Container(
          padding: const EdgeInsets.fromLTRB(6, 6, 16, 6),
          decoration: BoxDecoration(
            color: t.elevated,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: ok ? t.edgeSoft : t.danger.withValues(alpha: 0.4),
            ),
            boxShadow: const [
              BoxShadow(
                color: Color(0x66000000),
                blurRadius: 30,
                offset: Offset(0, 12),
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 28,
                height: 28,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: (ok ? t.accent : t.danger).withValues(alpha: 0.15),
                ),
                child: Icon(
                  ok ? Icons.check : Icons.close,
                  size: 13,
                  color: ok ? t.accent : t.danger,
                ),
              ),
              const SizedBox(width: 10),
              Text.rich(
                TextSpan(
                  text: toast.text,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w500,
                    color: t.ink,
                  ),
                  children: [
                    if (toast.addonName != null)
                      TextSpan(
                        text: ' · ${toast.addonName}',
                        style: TextStyle(color: t.inkMuted),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
