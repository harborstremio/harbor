import 'm3u.dart';

// Names that are visual separators/headers in a playlist rather than channels.
// Ported from `iptv/divider-filter.ts` `DIVIDER_PATTERNS`.
final List<RegExp> _dividerPatterns = [
  RegExp(r'^[#=\-~*_+]{3,}\s*\S.*?\S\s*[#=\-~*_+]{3,}$'),
  RegExp(r'^[<>]{2,}.+?[<>]{2,}$'),
  RegExp(r'^[▶◀▸◂►◄]+.+?[▶◀▸◂►◄]+$'),
  RegExp(r'^[─━═]{3,}.+?[─━═]{3,}$'),
  RegExp(r'^\.{3,}.+?\.{3,}$'),
  RegExp(r'^[#=\-~*_+.]{4,}$'),
];

final RegExp _symbolRe = RegExp(r'[^\p{L}\p{M}\p{N}\s]', unicode: true);

/// Whether a channel name is a decorative divider/header row. Ports
/// `isDividerChannel`.
bool isDividerChannel(String name) {
  final trimmed = name.trim();
  if (trimmed.isEmpty) return true;
  for (final re in _dividerPatterns) {
    if (re.hasMatch(trimmed)) return true;
  }
  final symbolRatio = _symbolRe.allMatches(trimmed).length / trimmed.length;
  if (symbolRatio > 0.55 && trimmed.length >= 5) return true;
  return false;
}

/// Drops divider rows from a channel list for display. Ports
/// `filterChannelsForDisplay`.
List<IptvChannel> filterChannelsForDisplay(List<IptvChannel> channels) => [
  for (final c in channels)
    if (!isDividerChannel(c.name)) c,
];
