import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:speech_to_text/speech_to_text.dart';

import '../domain/voice/speech_recognizer.dart';

/// [SpeechRecognizer] backed by the `speech_to_text` plugin — the platform
/// speech engine (Android `SpeechRecognizer`, iOS/tvOS `SFSpeechRecognizer`).
class SttSpeechRecognizer implements SpeechRecognizer {
  SttSpeechRecognizer([SpeechToText? stt]) : _stt = stt ?? SpeechToText();

  final SpeechToText _stt;
  bool _initialized = false;

  @override
  Future<bool> initialize() async {
    if (_initialized) return _stt.isAvailable;
    _initialized = await _stt.initialize(onError: (_) {}, onStatus: (_) {});
    return _initialized;
  }

  @override
  Future<bool> hasPermission() => _stt.hasPermission;

  @override
  Future<void> listen({
    required void Function(String transcript, bool isFinal) onResult,
    String? localeId,
  }) => _stt.listen(
    onResult: (r) => onResult(r.recognizedWords, r.finalResult),
    listenOptions: SpeechListenOptions(
      partialResults: true,
      localeId: localeId,
    ),
  );

  @override
  Future<void> stop() => _stt.stop();

  @override
  Future<void> cancel() => _stt.cancel();
}

/// The platform speech engine (overridable in tests with a fake).
final speechRecognizerProvider = Provider<SpeechRecognizer>(
  (ref) => SttSpeechRecognizer(),
);

/// The voice-search controller, one per app, disposed with the container.
final voiceSearchControllerProvider = Provider<VoiceSearchController>((ref) {
  final controller = VoiceSearchController(ref.watch(speechRecognizerProvider));
  ref.onDispose(controller.dispose);
  return controller;
});

/// A one-shot trigger set by the top-bar mic to make the Search view begin a
/// voice capture as soon as it is shown. The Search view consumes it (flips it
/// back to false) once it has started listening.
final voiceAutostartProvider = Provider<ValueNotifier<bool>>((ref) {
  final notifier = ValueNotifier(false);
  ref.onDispose(notifier.dispose);
  return notifier;
});
