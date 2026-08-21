/// Whether the injected-ad report button should be offered, ported 1:1 from web
/// `src/views/player/should-show-adreport.ts`.
///
/// * A direct/live stream (`isDirectStream`) never shows the button — it can't
///   be fingerprinted for the corpus.
/// * `alwaysShow` (only surfaced once the feature is enabled) overrides.
/// * Otherwise the feature must be [enabled] and the title a [recentRelease].
library;

bool shouldShowAdReport({
  required bool enabled,
  required bool alwaysShow,
  required bool isDirectStream,
  required bool recentRelease,
}) {
  if (isDirectStream) return false;
  if (alwaysShow) return true;
  if (!enabled) return false;
  return recentRelease;
}
