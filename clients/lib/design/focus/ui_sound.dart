/// A minimal sink for UI sound effects so low-level focus/design widgets (the
/// shared [Focusable]) can play sounds without importing the app/feature layers.
/// The SFX service implements this and registers itself in [uiSound] at startup;
/// every method is a no-op until then (and internally when no sound theme is
/// enabled), so callers can fire freely with `uiSound?.click()`.
abstract class UiSoundSink {
  void click();
  void open();
  void close();
  void navigate(String dir, {String soundType});
}

/// The live UI-sound sink, or null before the SFX service registers.
UiSoundSink? uiSound;

/// Which sound a [Focusable] plays on activation. Media cards use [open]
/// (mirroring the web media-card → `SFX.open`), most controls use [click], and
/// [none] opts a control out entirely.
enum SfxTap { click, open, none }
