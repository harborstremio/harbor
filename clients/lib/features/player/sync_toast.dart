import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/sync_events.dart';
import '../../app/theme_controller.dart';

/// The anime-sync status pill, ported from `mal-sync-toast.tsx` +
/// `anilist-sync-toast.tsx`. It drops in at the bottom of the player while a
/// progress push runs — a spinner while syncing, then a checked "Synced to
/// AniList · Episode 5" that fades after [_dismiss]. Driven by [syncEventsProvider].
class SyncToast extends ConsumerStatefulWidget {
  const SyncToast({super.key});

  @override
  ConsumerState<SyncToast> createState() => _SyncToastState();
}

class _SyncToastState extends ConsumerState<SyncToast> {
  static const Duration _dismiss = Duration(milliseconds: 4200);

  SyncEvent? _event;
  Timer? _timer;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _onEvent(SyncEvent? next) {
    if (next == null) return;
    setState(() => _event = next);
    _timer?.cancel();
    // The transient "syncing" state persists until its terminal event; the
    // others fade on their own.
    if (next.kind != SyncKind.syncing) {
      _timer = Timer(_dismiss, () {
        if (mounted) setState(() => _event = null);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<SyncEvent?>(syncEventsProvider, (_, next) => _onEvent(next));
    final e = _event;
    if (e == null) return const SizedBox.shrink();

    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);
    final good = e.kind == SyncKind.synced || e.kind == SyncKind.watching;
    final syncing = e.kind == SyncKind.syncing;
    final tint = good
        ? t.success
        : syncing
        ? t.inkMuted
        : t.danger;

    final header = switch (e.kind) {
      SyncKind.syncing => tr.t('Syncing to {tracker}', {
        'tracker': e.tracker.displayName,
      }),
      SyncKind.synced => tr.t('Synced to {tracker}', {
        'tracker': e.tracker.displayName,
      }),
      SyncKind.watching => tr.t('Now watching on {tracker}', {
        'tracker': e.tracker.displayName,
      }),
      SyncKind.error => tr.t('{tracker} sync', {
        'tracker': e.tracker.displayName,
      }),
    };
    final body =
        (e.kind == SyncKind.syncing || e.kind == SyncKind.synced) &&
            e.episode != null
        ? '${e.title} · ${tr.t('Episode {n}', {'n': e.episode})}'
        : e.title;

    return Align(
      alignment: Alignment.bottomCenter,
      child: Padding(
        padding: const EdgeInsets.only(bottom: 96),
        child: Material(
          color: Colors.transparent,
          child: Container(
            constraints: const BoxConstraints(maxWidth: 360),
            padding: const EdgeInsets.fromLTRB(10, 8, 16, 8),
            decoration: BoxDecoration(
              color: t.surface.withValues(alpha: 0.98),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: t.edge),
              boxShadow: const [
                BoxShadow(
                  color: Color(0xB3000000),
                  blurRadius: 60,
                  offset: Offset(0, 24),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 24,
                  height: 24,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: tint.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: syncing
                      ? SizedBox(
                          width: 13,
                          height: 13,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: tint,
                          ),
                        )
                      : Icon(
                          good ? Icons.check : Icons.priority_high,
                          size: 14,
                          color: tint,
                        ),
                ),
                const SizedBox(width: 10),
                Flexible(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        header.toUpperCase(),
                        style: TextStyle(
                          color: t.inkSubtle,
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1.4,
                        ),
                      ),
                      Text(
                        body,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: t.ink,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
