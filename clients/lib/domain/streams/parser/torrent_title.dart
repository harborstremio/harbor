/// A focused torrent-filename parser standing in for the web build's
/// `parse-torrent-title` dependency. It extracts exactly the fields the stream
/// parser/scoring pipeline consumes — title, year, season, episode, resolution
/// and codec tokens, release group, edition flags, and proper/repack/hardcoded
/// markers — from real-world release names.
library;

/// The structured result of parsing a release name.
class TorrentTitle {
  const TorrentTitle({
    required this.title,
    required this.resolution,
    required this.codec,
    required this.group,
    required this.year,
    required this.season,
    required this.episode,
    required this.extended,
    required this.unrated,
    required this.theatrical,
    required this.uncut,
    required this.remastered,
    required this.criterion,
    required this.openMatte,
    required this.proper,
    required this.repack,
    required this.hardcoded,
    required this.channels,
    required this.bitDepth,
  });

  /// The cleaned media title (dots/underscores → spaces, metadata trimmed).
  final String? title;

  /// The raw resolution token (`2160p`, `1080p`, …), or null.
  final String? resolution;

  /// The raw codec token (`x265`, `h264`, `av1`, …), or null.
  final String? codec;

  /// The release group (trailing `-GROUP` or leading `[Group]`).
  final String? group;

  final int? year;
  final int? season;
  final int? episode;

  final bool extended;
  final bool unrated;
  final bool theatrical;
  final bool uncut;
  final bool remastered;
  final bool criterion;
  final bool openMatte;
  final bool proper;
  final bool repack;
  final bool hardcoded;

  final int? channels;
  final int? bitDepth;
}

final RegExp _resolutionRx = RegExp(
  r'\b(2160p|1440p|1080[pi]|720[pi]|480[pi]|576[pi]|360p|240p|4k|uhd)\b',
  caseSensitive: false,
);
final RegExp _codecRx = RegExp(
  r'\b(x\.?265|h\.?265|hevc|x\.?264|h\.?264|avc|av1|vp9|mpeg-?2|xvid|divx)\b',
  caseSensitive: false,
);
final RegExp _yearRx = RegExp(r'\b(19\d{2}|20\d{2})\b');
final RegExp _sEpRx = RegExp(
  r'\bS(\d{1,2})[\s._\-]?E(\d{1,3})\b',
  caseSensitive: false,
);
final RegExp _seasonOnlyRx = RegExp(
  r'\bS(\d{1,2})\b(?![\s._\-]?E)',
  caseSensitive: false,
);
final RegExp _xEpRx = RegExp(r'\b(\d{1,2})x(\d{1,3})\b');
final RegExp _seasonWordRx = RegExp(
  r'\bseason[\s._\-]?(\d{1,2})\b',
  caseSensitive: false,
);
final RegExp _episodeWordRx = RegExp(
  r'\bepisode[\s._\-]?(\d{1,3})\b',
  caseSensitive: false,
);
final RegExp _episodeOnlyRx = RegExp(r'\bE(\d{1,3})\b', caseSensitive: false);
final RegExp _channelsRx = RegExp(r'\b(7\.1|6\.1|5\.1|2\.1|2\.0)\b');
final RegExp _bitDepthRx = RegExp(r'\b(8|10|12)\s*bit\b', caseSensitive: false);
final RegExp _groupTrailingRx = RegExp(
  r'-([A-Za-z0-9]{2,})(?:\.[A-Za-z0-9]{2,4})?$',
);
final RegExp _groupBracketRx = RegExp(r'^\[([^\]]+)\]');
final RegExp _containerExtRx = RegExp(
  r'\.(mkv|mp4|m4v|avi|webm|mov|ts|wmv)$',
  caseSensitive: false,
);

// Non-year tokens that mark the end of the title portion of a release name.
// Year handling is separate: a year that is part of the title (e.g. the "2049"
// in "Blade Runner 2049 2017") must not truncate the title, so the title ends
// at the *chosen* release year, not the first year token.
final RegExp _titleStopRx = RegExp(
  r'\b(2160p|1440p|1080[pi]|720[pi]|480[pi]|576[pi]|4k|uhd'
  r'|S\d{1,2}(?:E\d{1,3})?|\d{1,2}x\d{1,3}|season|episode|complete'
  r'|bluray|blu-ray|bdrip|brrip|web-?dl|webrip|hdrip|hdtv|remux|dvdrip'
  r'|hdcam|cam|telesync|telecine|x\.?264|x\.?265|h\.?264|h\.?265|hevc|avc|av1'
  r'|xvid|divx|aac|ac3|dts|ddp?5?|truehd|atmos|flac|hdr|hdr10|dv|dovi'
  r'|multi|dual|proper|repack|extended|unrated|remastered|imax)\b',
  caseSensitive: false,
);

/// Parses [name] into a [TorrentTitle].
TorrentTitle parseTorrentTitle(String name) {
  final withoutExt = name.replaceFirst(_containerExtRx, '');

  int? season;
  int? episode;
  final sEp = _sEpRx.firstMatch(name);
  if (sEp != null) {
    season = int.tryParse(sEp.group(1)!);
    episode = int.tryParse(sEp.group(2)!);
  } else {
    final xEp = _xEpRx.firstMatch(name);
    if (xEp != null) {
      season = int.tryParse(xEp.group(1)!);
      episode = int.tryParse(xEp.group(2)!);
    } else {
      final sOnly =
          _seasonOnlyRx.firstMatch(name) ?? _seasonWordRx.firstMatch(name);
      if (sOnly != null) season = int.tryParse(sOnly.group(1)!);
      final eOnly =
          _episodeWordRx.firstMatch(name) ?? _episodeOnlyRx.firstMatch(name);
      if (eOnly != null) episode = int.tryParse(eOnly.group(1)!);
    }
  }

  // Year: the last plausible 19xx/20xx token — a leading year that is part of
  // the title (e.g. "1917 2019") is thus not mistaken for the release year.
  int? year;
  for (final m in _yearRx.allMatches(name)) {
    final y = int.tryParse(m.group(1)!);
    if (y != null && y <= 2099) year = y;
  }

  final resMatch = _resolutionRx.firstMatch(name);
  final codecMatch = _codecRx.firstMatch(name);
  final channelsMatch = _channelsRx.firstMatch(name);
  final bitDepthMatch = _bitDepthRx.firstMatch(name);

  String? group;
  final bracket = _groupBracketRx.firstMatch(name);
  if (bracket != null) {
    group = bracket.group(1)!.trim();
  } else {
    final trailing = _groupTrailingRx.firstMatch(withoutExt);
    if (trailing != null) group = trailing.group(1);
  }

  return TorrentTitle(
    title: _extractTitle(name),
    resolution: resMatch?.group(1),
    codec: codecMatch?.group(1),
    group: group,
    year: year,
    season: season,
    episode: episode,
    extended: RegExp(r'\bextended\b', caseSensitive: false).hasMatch(name),
    unrated: RegExp(r'\bunrated\b', caseSensitive: false).hasMatch(name),
    theatrical: RegExp(r'\btheatrical\b', caseSensitive: false).hasMatch(name),
    uncut: RegExp(r'\buncut\b', caseSensitive: false).hasMatch(name),
    remastered: RegExp(
      r'\bremaster(?:ed)?\b',
      caseSensitive: false,
    ).hasMatch(name),
    criterion: RegExp(r'\bcriterion\b', caseSensitive: false).hasMatch(name),
    openMatte: RegExp(
      r'\bopen[\s._\-]?matte\b',
      caseSensitive: false,
    ).hasMatch(name),
    proper: RegExp(r'\bproper\b', caseSensitive: false).hasMatch(name),
    repack: RegExp(r'\brepack\b', caseSensitive: false).hasMatch(name),
    hardcoded: RegExp(
      r'\b(hc|hardcoded|hardsub)\b',
      caseSensitive: false,
    ).hasMatch(name),
    channels: channelsMatch != null
        ? _mapChannels(channelsMatch.group(1)!)
        : null,
    bitDepth: bitDepthMatch != null
        ? int.tryParse(bitDepthMatch.group(1)!)
        : null,
  );
}

String? _extractTitle(String name) {
  var work = name;
  // Strip a leading bracketed group so the title itself is scored.
  final bracket = _groupBracketRx.firstMatch(work);
  if (bracket != null) work = work.substring(bracket.end);

  // The title ends at whichever comes first: the chosen release year (the last
  // plausible year token, so an in-title year does not truncate) or the first
  // non-year metadata token.
  int? yearEnd;
  for (final m in _yearRx.allMatches(work)) {
    final y = int.tryParse(m.group(1)!);
    if (y != null && y <= 2099) yearEnd = m.start;
  }
  final stop = _titleStopRx.firstMatch(work);
  int? end;
  if (yearEnd != null) end = yearEnd;
  if (stop != null) {
    end = end == null ? stop.start : (stop.start < end ? stop.start : end);
  }

  var titlePart = end != null ? work.substring(0, end) : work;
  titlePart = titlePart
      .replaceAll(RegExp(r'[._]+'), ' ')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
  return titlePart.isEmpty ? null : titlePart;
}

int _mapChannels(String label) {
  switch (label) {
    case '7.1':
      return 8;
    case '6.1':
      return 7;
    case '5.1':
      return 6;
    case '2.1':
      return 3;
    default:
      return 2;
  }
}
