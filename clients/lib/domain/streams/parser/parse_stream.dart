import '../parsed_stream.dart';
import '../stream_item.dart';
import 'audio.dart';
import 'cache_flags.dart';
import 'codec.dart';
import 'filename.dart';
import 'hdr.dart';
import 'language.dart';
import 'metadata.dart';
import 'resolution.dart';
import 'source.dart';
import 'stream_enums.dart';
import 'torrent_title.dart';

final RegExp _remuxRx = RegExp(r'\bRemux\b', caseSensitive: false);
final RegExp _hardcodedRx = RegExp(
  r'\b(HC|HARDCODED|HARDSUB)\b',
  caseSensitive: false,
);

/// Parses a fetched [s] into a [ParsedStream], ported from
/// `src/lib/streams/parser/parser-stream.ts`. Parsing runs against the best
/// filename line, falling back to the combined display text.
ParsedStream parseStream(StreamItem s) {
  final filenameLine = extractFilenameLine(
    title: s.title,
    filename: s.filename,
    description: s.description,
    name: s.name,
  );
  final text = [
    filenameLine,
    s.title,
    s.description,
    s.name,
  ].where((v) => v != null && v.isNotEmpty).join(' ');
  final ptt = parseTorrentTitle(filenameLine.isNotEmpty ? filenameLine : text);

  final resolution = mapResolution(ptt.resolution);
  final source = detectSource(text);
  final size = parseSize(text, hint: s.videoSize);
  final releaseGroup = ptt.group;

  return ParsedStream(
    stream: s,
    parsedTitle: ptt.title ?? _slice(filenameLine, 100),
    episodeTitle: parseEpisodeTitle(filenameLine, ptt.season, ptt.episode),
    resolution: resolution,
    hdrFormat: detectHdr(text),
    codec: mapCodec(ptt.codec ?? ''),
    source: source,
    audio: parseAudio(text, ptt),
    audioLanguages: parseLanguages(text),
    size: size,
    seeders: parseSeeders(text),
    cached: parseCacheFlags(
      text,
      bingeGroup: s.bingeGroup,
      addonName: s.addonName,
      url: s.url,
    ),
    inLibrary: const <DebridSlug, bool>{},
    container: parseContainer(s.filename, filenameLine, text),
    releaseGroup: releaseGroup,
    releaseGroupNormalized: releaseGroup?.toUpperCase().replaceAll(
      RegExp('[^A-Z0-9]'),
      '',
    ),
    remux: _remuxRx.hasMatch(text),
    edition: parseEdition(text, ptt),
    year: ptt.year,
    yearRange: parseYearRange(text),
    season: ptt.season,
    episode: ptt.episode,
    seasonPack: parseSeasonPack(text, ptt),
    discIndex: parseDisc(text),
    repackIteration: parseRepackIteration(text, ptt),
    proper: ptt.proper,
    hardcoded: _hardcodedRx.hasMatch(text) || ptt.hardcoded,
    animeHash: parseAnimeHash(text),
    scamScore: computeScamScore(source, resolution, size),
  );
}

String _slice(String s, int max) => s.length <= max ? s : s.substring(0, max);
