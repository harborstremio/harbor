import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/profiles/curfew.dart';
import 'profiles_providers.dart';
import 'providers.dart';

/// Tracks the active profile's daily watch-time record — reloaded (and reset to
/// a fresh day) whenever the active profile changes. The [CurfewGuard] widget
/// drives [tick] once a second while the player is open, and [unlock] clears the
/// lock for the rest of the day after a parent PIN. Ported from the web
/// `CurfewGuard` state.
class CurfewController extends Notifier<CurfewRecord> {
  @override
  CurfewRecord build() {
    final id = ref.watch(activeProfileProvider)?.id;
    final now = DateTime.now();
    if (id == null) {
      return CurfewRecord(
        date: curfewTodayKey(now),
        seconds: 0,
        unlocked: false,
      );
    }
    return loadCurfew(ref.watch(kvStoreProvider), id, now);
  }

  /// Adds a watched second and persists it.
  void tick() {
    final id = ref.read(activeProfileProvider)?.id;
    if (id == null) return;
    final next = state.copyWith(seconds: state.seconds + 1);
    saveCurfew(ref.read(kvStoreProvider), id, next);
    state = next;
  }

  /// Clears the lock for the rest of the day (after a verified parent PIN).
  void unlock() {
    final id = ref.read(activeProfileProvider)?.id;
    if (id == null) return;
    final next = state.copyWith(unlocked: true);
    saveCurfew(ref.read(kvStoreProvider), id, next);
    state = next;
  }
}

final curfewControllerProvider =
    NotifierProvider<CurfewController, CurfewRecord>(CurfewController.new);
