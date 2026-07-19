/// Subtitle search models, ported from `src/lib/subtitles/types.ts`.
library;

/// Where a subtitle came from. [priority] drives source interleaving.
enum SubSource {
  addon('addon', 3),
  opensubtitles('opensubtitles', 2),
  wyzie('wyzie', 2),
  jimaku('jimaku', 1);

  const SubSource(this.label, this.priority);
  final String label;
  final int priority;
}

/// A single subtitle search result.
class SubResult {
  const SubResult({
    required this.id,
    required this.url,
    required this.lang,
    required this.source,
    this.langName,
    this.title,
    this.format,
    this.encoding,
    this.fps,
    this.hearingImpaired = false,
    this.forced = false,
    this.release,
    this.downloads,
    this.hash,
  });

  final String id;
  final String url;
  final String lang;
  final SubSource source;
  final String? langName;
  final String? title;

  /// `srt`, `vtt`, `ass`, `ssa`, `sub`.
  final String? format;
  final String? encoding;
  final num? fps;
  final bool hearingImpaired;
  final bool forced;
  final String? release;
  final int? downloads;
  final String? hash;
}

/// A subtitle search request.
class SubSearchQuery {
  const SubSearchQuery({
    this.imdbId,
    this.tmdbId,
    this.stremioId,
    this.type,
    this.title,
    this.season,
    this.episode,
    this.langs,
    this.videoHash,
    this.videoSize,
    this.filename,
  });

  final String? imdbId;
  final String? tmdbId;
  final String? stremioId;

  /// `movie` or `series`.
  final String? type;
  final String? title;
  final int? season;
  final int? episode;
  final List<String>? langs;
  final String? videoHash;
  final int? videoSize;
  final String? filename;
}

/// Hints about the playing stream, used to rank subtitles that match the same
/// release/source/resolution more highly.
class SubStreamHints {
  const SubStreamHints({
    this.release,
    this.source,
    this.resolution,
    this.preferHearingImpaired = false,
  });
  final String? release;
  final String? source;
  final String? resolution;
  final bool preferHearingImpaired;
}
