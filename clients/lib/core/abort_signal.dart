import 'dart:async';

/// A cooperative cancellation token, the Dart analogue of the web `AbortSignal`
/// threaded through the debrid/resolve pipelines. Long-polling flows check
/// [isAborted] between steps and abort in-flight sleeps.
class AbortSignal {
  bool _aborted = false;
  final List<void Function()> _listeners = [];

  bool get isAborted => _aborted;

  /// A signal that never aborts — for callers with no cancellation source.
  static final AbortSignal never = AbortSignal();

  void abort() {
    if (_aborted) return;
    _aborted = true;
    for (final l in List.of(_listeners)) {
      l();
    }
    _listeners.clear();
  }

  /// Registers [cb] to run on abort (immediately if already aborted).
  void onAbort(void Function() cb) {
    if (_aborted) {
      cb();
    } else {
      _listeners.add(cb);
    }
  }

  /// Waits [ms] milliseconds, resolving early if the signal aborts.
  Future<void> sleep(int ms) {
    if (_aborted) return Future.value();
    final completer = Completer<void>();
    final timer = Timer(Duration(milliseconds: ms), () {
      if (!completer.isCompleted) completer.complete();
    });
    onAbort(() {
      timer.cancel();
      if (!completer.isCompleted) completer.complete();
    });
    return completer.future;
  }
}
