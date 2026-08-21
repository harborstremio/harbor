import 'parsed_stream.dart';

/// A user-defined, saved stream filter — a named conjunction of optional axis
/// constraints applied to the play-picker's ranked list. An empty filter matches
/// everything. Ported 1:1 from web `custom-filters.ts` (`CustomStreamFilter`);
/// the axis fields hold the same display labels the web persists, so a filter
/// round-trips through `settings.customStreamFilters` with the web app.
class CustomStreamFilter {
  const CustomStreamFilter({
    required this.id,
    required this.name,
    this.resolution = const [],
    this.source = const [],
    this.codec = const [],
    this.audio = const [],
    this.requireHdr = false,
    this.cachedOnly = false,
    this.minSeeders,
    this.maxSizeGb,
  });

  final String id;
  final String name;

  /// Accepted resolution labels ([resolutionOptions]); empty means any.
  final List<String> resolution;

  /// Accepted source labels ([sourceOptions]); empty means any.
  final List<String> source;

  /// Accepted video-codec labels ([codecOptions]); empty means any.
  final List<String> codec;

  /// Accepted audio-codec labels ([audioOptions]); empty means any.
  final List<String> audio;

  /// Require an HDR stream (any HDR format).
  final bool requireHdr;

  /// Require the stream be cached on a debrid service (or already in-library).
  final bool cachedOnly;

  /// Minimum torrent seeders; null/≤0 means unconstrained.
  final int? minSeeders;

  /// Maximum size in GB; null/≤0 means unconstrained.
  final num? maxSizeGb;

  CustomStreamFilter copyWith({
    String? name,
    List<String>? resolution,
    List<String>? source,
    List<String>? codec,
    List<String>? audio,
    bool? requireHdr,
    bool? cachedOnly,
    Object? minSeeders = _sentinel,
    Object? maxSizeGb = _sentinel,
  }) => CustomStreamFilter(
    id: id,
    name: name ?? this.name,
    resolution: resolution ?? this.resolution,
    source: source ?? this.source,
    codec: codec ?? this.codec,
    audio: audio ?? this.audio,
    requireHdr: requireHdr ?? this.requireHdr,
    cachedOnly: cachedOnly ?? this.cachedOnly,
    minSeeders: identical(minSeeders, _sentinel)
        ? this.minSeeders
        : minSeeders as int?,
    maxSizeGb: identical(maxSizeGb, _sentinel)
        ? this.maxSizeGb
        : maxSizeGb as num?,
  );

  factory CustomStreamFilter.fromJson(Map<String, dynamic> json) =>
      CustomStreamFilter(
        id: (json['id'] ?? '').toString(),
        name: (json['name'] ?? '').toString(),
        resolution: _strList(json['resolution']),
        source: _strList(json['source']),
        codec: _strList(json['codec']),
        audio: _strList(json['audio']),
        requireHdr: json['requireHdr'] == true,
        cachedOnly: json['cachedOnly'] == true,
        minSeeders: (json['minSeeders'] as num?)?.toInt(),
        maxSizeGb: json['maxSizeGb'] as num?,
      );

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'resolution': resolution,
    'source': source,
    'codec': codec,
    'audio': audio,
    'requireHdr': requireHdr,
    'cachedOnly': cachedOnly,
    'minSeeders': minSeeders,
    'maxSizeGb': maxSizeGb,
  };
}

const _sentinel = Object();

List<String> _strList(Object? v) =>
    v is List ? [for (final e in v) e.toString()] : const [];

/// The canonical option labels for each filter axis — identical to the enum
/// labels so a saved filter's stored values match a parsed stream's attributes.
const List<String> resolutionOptions = ['4K', '1080p', '720p', '480p', 'SD'];
const List<String> sourceOptions = [
  'BluRay',
  'REMUX',
  'WEB-DL',
  'WEBRip',
  'BDRip',
  'HDRip',
  'DVDRip',
  'HDTV',
  'CAM',
  'TS',
  'HDTS',
  'TC',
  'SCR',
  'Other',
];
const List<String> codecOptions = [
  'HEVC',
  'AVC',
  'AV1',
  'VP9',
  'MPEG2',
  'Other',
];
const List<String> audioOptions = [
  'Atmos',
  'TrueHD',
  'DTS-HD MA',
  'DTS',
  'DD+',
  'AC3',
  'AAC',
  'Opus',
  'FLAC',
  'Other',
];

/// A fresh, empty filter named [name] with the caller-supplied [id]. Ports
/// `newCustomFilter` (the id is injected so this stays pure; the UI generates
/// one the way the rest of the app does).
CustomStreamFilter newCustomFilter(String name, {required String id}) =>
    CustomStreamFilter(id: id, name: name);

bool _isPositive(num? v) => v != null && v > 0;

/// Whether [filter] constrains nothing (so it matches every stream). Ports
/// `isFilterEmpty`.
bool isFilterEmpty(CustomStreamFilter filter) =>
    filter.resolution.isEmpty &&
    filter.source.isEmpty &&
    filter.codec.isEmpty &&
    filter.audio.isEmpty &&
    !filter.requireHdr &&
    !filter.cachedOnly &&
    !_isPositive(filter.minSeeders) &&
    !_isPositive(filter.maxSizeGb);

/// Whether [stream] satisfies every constraint of [filter]. Ports
/// `matchesCustomFilter`.
bool matchesCustomFilter(ParsedStream stream, CustomStreamFilter filter) {
  if (filter.resolution.isNotEmpty &&
      !filter.resolution.contains(stream.resolution.label)) {
    return false;
  }
  if (filter.source.isNotEmpty &&
      !filter.source.contains(stream.source.label)) {
    return false;
  }
  if (filter.codec.isNotEmpty && !filter.codec.contains(stream.codec.label)) {
    return false;
  }
  if (filter.audio.isNotEmpty &&
      !filter.audio.contains(stream.audio.codec.label)) {
    return false;
  }
  if (filter.requireHdr && stream.hdrFormat == null) return false;
  if (filter.cachedOnly) {
    final cached =
        stream.cached.values.any((v) => v) ||
        stream.inLibrary.values.any((v) => v);
    if (!cached) return false;
  }
  if (_isPositive(filter.minSeeders)) {
    if (stream.seeders == null || stream.seeders! < filter.minSeeders!) {
      return false;
    }
  }
  if (_isPositive(filter.maxSizeGb)) {
    if (stream.size != null &&
        stream.size! > filter.maxSizeGb! * 1024 * 1024 * 1024) {
      return false;
    }
  }
  return true;
}

String? _summarizeMulti(List<String> values) {
  if (values.isEmpty) return null;
  if (values.length == 1) return values.first;
  return '${values.first} +${values.length - 1}';
}

/// A short human-readable summary of [filter] (`"Any"` when empty), e.g.
/// `"4K / BluRay / HDR"`. Ports `summarizeFilter`.
String summarizeFilter(CustomStreamFilter filter) {
  if (isFilterEmpty(filter)) return 'Any';
  final parts = <String>[];
  final res = _summarizeMulti(filter.resolution);
  if (res != null) parts.add(res);
  final src = _summarizeMulti(filter.source);
  if (src != null) parts.add(src);
  final codec = _summarizeMulti(filter.codec);
  if (codec != null) parts.add(codec);
  final audio = _summarizeMulti(filter.audio);
  if (audio != null) parts.add(audio);
  if (filter.requireHdr) parts.add('HDR');
  if (filter.cachedOnly) parts.add('Cached');
  if (_isPositive(filter.minSeeders)) parts.add('${filter.minSeeders}+ seeds');
  if (_isPositive(filter.maxSizeGb)) parts.add('<= ${filter.maxSizeGb} GB');
  return parts.join(' / ');
}
