import 'parser/stream_enums.dart';
import 'stream_item.dart';

/// A [StreamItem] enriched with every field parsed from its release name, plus
/// per-debrid cache state. Mirrors `ParsedStream` in
/// `src/lib/streams/types.ts`. Origin fields (url, info-hash, addon annotations)
/// delegate to the wrapped [stream].
class ParsedStream {
  const ParsedStream({
    required this.stream,
    required this.parsedTitle,
    required this.episodeTitle,
    required this.resolution,
    required this.hdrFormat,
    required this.codec,
    required this.source,
    required this.audio,
    required this.audioLanguages,
    required this.size,
    required this.seeders,
    required this.cached,
    required this.inLibrary,
    required this.container,
    required this.releaseGroup,
    required this.releaseGroupNormalized,
    required this.remux,
    required this.edition,
    required this.year,
    required this.yearRange,
    required this.season,
    required this.episode,
    required this.seasonPack,
    required this.discIndex,
    required this.repackIteration,
    required this.proper,
    required this.hardcoded,
    required this.animeHash,
    required this.scamScore,
  });

  final StreamItem stream;

  final String parsedTitle;
  final String? episodeTitle;
  final StreamResolution resolution;
  final HdrFormat? hdrFormat;
  final VideoCodec codec;
  final StreamSource source;
  final AudioInfo audio;
  final List<String> audioLanguages;
  final int? size;
  final int? seeders;

  /// Per-debrid cache state: `true` cached, `false` explicitly uncached, absent
  /// unknown.
  final Map<DebridSlug, bool> cached;

  /// Per-debrid "already in your library" state.
  final Map<DebridSlug, bool> inLibrary;

  final StreamContainer? container;
  final String? releaseGroup;
  final String? releaseGroupNormalized;
  final bool remux;
  final String? edition;
  final int? year;
  final List<int>? yearRange;
  final int? season;
  final int? episode;
  final bool seasonPack;
  final int? discIndex;
  final int repackIteration;
  final bool proper;
  final bool hardcoded;
  final String? animeHash;
  final int scamScore;

  String? get url => stream.url;
  String? get infoHash => stream.infoHash;
  int? get fileIdx => stream.fileIdx;
  String get addonId => stream.addonId;
  String get addonName => stream.addonName;
  int? get addonPriority => stream.addonPriority;
  int? get addonReturnIdx => stream.addonReturnIdx;
  bool get addonRanked => stream.addonRanked;
}

/// The stream's filename for the picker's optional filename line, ported from
/// `torrentFilename` in `picker-utils.ts`: the `behaviorHints` filename when
/// present, else the first non-empty line of the raw title.
String torrentFilename(StreamItem s) {
  final fn = s.filename?.trim();
  if (fn != null && fn.isNotEmpty) return fn;
  for (final line in (s.title ?? '').split('\n')) {
    final t = line.trim();
    if (t.isNotEmpty) return t;
  }
  return '';
}
