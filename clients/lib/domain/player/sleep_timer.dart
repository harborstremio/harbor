import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The active sleep-timer mode, ported from `use-sleep-timer.ts`'s `SleepMode`.
/// It lives in a provider (not player state) so a minutes deadline and the
/// end-next-episode countdown survive the player being disposed and recreated
/// between episodes.
sealed class SleepMode {
  const SleepMode();
}

/// No sleep timer is armed.
class SleepOff extends SleepMode {
  const SleepOff();
}

/// Pause at [firesAt]; [total] is the chosen preset in minutes (for the label).
class SleepMinutes extends SleepMode {
  const SleepMinutes({required this.total, required this.firesAt});
  final int total;
  final DateTime firesAt;
}

/// Pause when the current episode ends.
class SleepEndEpisode extends SleepMode {
  const SleepEndEpisode();
}

/// Pause after [remaining] more episode ends (web `end_next_episode`, starts 2).
class SleepEndNextEpisode extends SleepMode {
  const SleepEndNextEpisode(this.remaining);
  final int remaining;
}

/// A sleep preset the picker offers, byte-identical to the web `SLEEP_PRESETS`
/// minutes/ids plus the two episode presets.
class SleepPreset {
  const SleepPreset({required this.id, required this.label, this.minutes});

  /// Stable id (`'30'`, `'ep'`, `'ep2'`).
  final String id;
  final String label;

  /// The minutes value, or null for the two episode presets.
  final int? minutes;
}

/// The curated sleep presets the menu shows, byte-identical to the web
/// `CURATED_SLEEP_IDS` (`30`, `60`, `ep`, `ep2`); other minute values are only
/// reached by adding a custom one, and merge in via `customSleepMinutes`.
const List<SleepPreset> kSleepPresets = [
  SleepPreset(id: '30', label: '30 min', minutes: 30),
  SleepPreset(id: '60', label: '1 hour', minutes: 60),
  SleepPreset(id: 'ep', label: 'End of episode'),
  SleepPreset(id: 'ep2', label: 'End of next episode'),
];

/// Holds the armed [SleepMode]. Kept app-wide so it outlives the per-episode
/// player instances. Ported from `use-sleep-timer.ts`.
class SleepTimerController extends Notifier<SleepMode> {
  @override
  SleepMode build() => const SleepOff();

  void cancel() => state = const SleepOff();

  /// Arms a minutes sleep firing [total] minutes from [now] (real time in the
  /// player; injectable for tests).
  void startMinutes(int total, {DateTime? now}) {
    final base = now ?? DateTime.now();
    state = SleepMinutes(
      total: total,
      firesAt: base.add(Duration(minutes: total)),
    );
  }

  void endEpisode() => state = const SleepEndEpisode();

  /// End-of-next-episode: finish the current episode, then pause after the next
  /// (web arms `remaining: 2`).
  void endNextEpisode() => state = const SleepEndNextEpisode(2);

  /// Whether [id] (a [SleepPreset.id]) is the armed mode — drives the picker's
  /// selected row.
  bool isSelected(String id) {
    final m = state;
    return switch (m) {
      SleepMinutes(:final total) => total.toString() == id,
      SleepEndEpisode() => id == 'ep',
      SleepEndNextEpisode() => id == 'ep2',
      SleepOff() => false,
    };
  }

  /// Advances the timer when an episode ends; returns true when playback should
  /// pause NOW (the caller must then suppress its auto-advance). A minutes/off
  /// timer never pauses on an episode boundary.
  bool onEpisodeEnded() {
    final m = state;
    if (m is SleepEndEpisode) {
      state = const SleepOff();
      return true;
    }
    if (m is SleepEndNextEpisode) {
      if (m.remaining > 1) {
        state = SleepEndNextEpisode(m.remaining - 1);
        return false;
      }
      state = const SleepOff();
      return true;
    }
    return false;
  }
}

final sleepTimerProvider = NotifierProvider<SleepTimerController, SleepMode>(
  SleepTimerController.new,
);
