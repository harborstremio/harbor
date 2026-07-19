import 'dart:async';

import 'package:flutter/foundation.dart';

/// The lifecycle of a voice-search capture.
enum VoiceStatus {
  /// Not capturing.
  idle,

  /// Actively capturing speech.
  listening,

  /// A phrase completed; [VoiceSearchController.transcript] holds the result.
  done,

  /// Speech recognition is not available on this device.
  unavailable,

  /// The microphone permission was denied.
  denied,

  /// The engine failed mid-capture.
  error,
}

/// A plugin-agnostic speech-to-text engine. The concrete implementation
/// (`SttSpeechRecognizer`, backed by the `speech_to_text` plugin) lives in the
/// app layer so the domain stays free of Flutter-plugin imports and the
/// controller is testable with a fake.
abstract interface class SpeechRecognizer {
  /// Prepares the engine (and prompts for permission on first use). Returns
  /// false when speech recognition is unavailable.
  Future<bool> initialize();

  /// Whether the microphone permission has been granted.
  Future<bool> hasPermission();

  /// Begins capture. [onResult] fires for each partial and the final result.
  Future<void> listen({
    required void Function(String transcript, bool isFinal) onResult,
    String? localeId,
  });

  /// Ends capture, keeping whatever was recognized.
  Future<void> stop();

  /// Ends capture and discards the result.
  Future<void> cancel();
}

/// Drives a voice-search capture and exposes its live state. The final
/// transcript is delivered once through [onFinal] so a consumer can feed it into
/// the same search query as typed input; the status/transcript back the live
/// UI. Ported from the web voice-search behaviour in `03-remote-and-voice.md`:
/// permission denial is a real, visible state, never a silent no-op.
class VoiceSearchController extends ChangeNotifier {
  VoiceSearchController(this._recognizer);

  final SpeechRecognizer _recognizer;

  VoiceStatus _status = VoiceStatus.idle;
  VoiceStatus get status => _status;

  String _transcript = '';
  String get transcript => _transcript;

  /// Called once with the trimmed final transcript when a phrase completes.
  void Function(String transcript)? onFinal;

  bool get isListening => _status == VoiceStatus.listening;

  /// Starts a capture. Sets [VoiceStatus.listening] immediately for feedback,
  /// then resolves to [VoiceStatus.unavailable]/[VoiceStatus.denied] when the
  /// engine or permission is missing.
  Future<void> start({String? localeId}) async {
    if (_status == VoiceStatus.listening) return;
    _transcript = '';
    _set(VoiceStatus.listening);

    bool available;
    try {
      available = await _recognizer.initialize();
    } catch (_) {
      _set(VoiceStatus.error);
      return;
    }
    if (!available) {
      _set(VoiceStatus.unavailable);
      return;
    }
    if (!await _recognizer.hasPermission()) {
      _set(VoiceStatus.denied);
      return;
    }
    // The user may have cancelled while permission resolved.
    if (_status != VoiceStatus.listening) return;

    try {
      await _recognizer.listen(
        localeId: localeId,
        onResult: (text, isFinal) {
          if (_status != VoiceStatus.listening) return;
          _transcript = text;
          if (isFinal) {
            _complete();
          } else {
            notifyListeners();
          }
        },
      );
    } catch (_) {
      _set(VoiceStatus.error);
    }
  }

  /// Ends capture. A non-empty partial transcript is treated as a completion so
  /// the query still runs; otherwise it returns to idle.
  Future<void> stop() async {
    if (_status != VoiceStatus.listening) return;
    try {
      await _recognizer.stop();
    } catch (_) {}
    if (_transcript.trim().isNotEmpty) {
      _complete();
    } else {
      _set(VoiceStatus.idle);
    }
  }

  /// Ends capture and discards the transcript.
  Future<void> cancel() async {
    try {
      await _recognizer.cancel();
    } catch (_) {}
    _transcript = '';
    _set(VoiceStatus.idle);
  }

  /// Clears state back to idle (e.g. after the result was consumed).
  void reset() {
    _transcript = '';
    _set(VoiceStatus.idle);
  }

  void _complete() {
    _set(VoiceStatus.done);
    final cb = onFinal;
    final q = _transcript.trim();
    if (cb != null && q.isNotEmpty) cb(q);
  }

  void _set(VoiceStatus s) {
    _status = s;
    notifyListeners();
  }

  @override
  void dispose() {
    unawaited(_recognizer.cancel());
    super.dispose();
  }
}
