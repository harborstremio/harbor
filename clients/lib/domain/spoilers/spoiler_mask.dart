import '../settings/settings.dart';

/// Which parts of an episode card to blur to avoid spoilers. Ported from
/// `spoilers.ts` (`spoilerMaskFor`).
class SpoilerMask {
  const SpoilerMask({
    required this.thumb,
    required this.title,
    required this.desc,
  });

  final bool thumb;
  final bool title;
  final bool desc;

  static const clear = SpoilerMask(thumb: false, title: false, desc: false);

  /// Whether anything is blurred.
  bool get active => thumb || title || desc;
}

/// Computes the spoiler mask for an episode given the spoiler settings and the
/// episode's watched / next-up state — a direct port of `spoilerMaskFor`:
/// nothing is blurred when spoilers are off, the episode is watched, or it is
/// the next-up episode and the viewer chose to keep that one visible.
SpoilerMask spoilerMaskFor(
  Settings s, {
  required bool watched,
  required bool isNextUp,
}) {
  if (!s.getBool('hideSpoilers')) return SpoilerMask.clear;
  if (watched) return SpoilerMask.clear;
  if (s.getBool('spoilerSkipNext') && isNextUp) return SpoilerMask.clear;
  return SpoilerMask(
    thumb: s.getBool('spoilerHideThumbnails'),
    title: s.getBool('spoilerHideTitles'),
    desc: s.getBool('spoilerHideDescriptions'),
  );
}
