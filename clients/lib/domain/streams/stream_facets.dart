/// The stream-picker facet dimensions — the axes a viewer can filter the ranked
/// stream list by (resolution, source, codec, HDR, audio, availability, and the
/// add-on that surfaced each stream). Ported 1:1 from web
/// `play-picker/stream-facets.ts` and `quality-filter.tsx`, with the add-on axis
/// folding in web `buildAddonOptions` as a dynamic-option dimension.
///
/// Each [FacetDim] buckets a [ScoredStream] onto one canonical value (or null
/// when the stream has none for that axis); [facetOptions] tallies the buckets
/// present in a stream list, and [matchesFacets] tests a stream against the
/// currently-selected facet values.
library;

import 'parser/stream_enums.dart';
import 'scoring/scored_stream.dart';

/// The resolution bucket of [s] — the plain video resolution, folding 480p and
/// anything lower into "SD". Ports `qualityTier`.
String qualityTier(ScoredStream s) {
  switch (s.parsed.resolution) {
    case StreamResolution.uhd:
      return '4K';
    case StreamResolution.p1080:
      return '1080p';
    case StreamResolution.p720:
      return '720p';
    case StreamResolution.p480:
    case StreamResolution.sd:
      return 'SD';
  }
}

/// The source-quality bucket of [s], or null for an unknown source. Ports
/// `sourceGroup`.
String? sourceGroup(ScoredStream s) {
  switch (s.parsed.source) {
    case StreamSource.remux:
      return 'Remux';
    case StreamSource.bluRay:
    case StreamSource.bdRip:
      return 'BluRay';
    case StreamSource.webDl:
      return 'WEB-DL';
    case StreamSource.webRip:
    case StreamSource.hdRip:
      return 'WEBRip';
    case StreamSource.hdtv:
    case StreamSource.dvdRip:
      return 'HDTV';
    case StreamSource.cam:
    case StreamSource.ts:
    case StreamSource.hdts:
    case StreamSource.tc:
    case StreamSource.scr:
      return 'CAM';
    case StreamSource.other:
      return null;
  }
}

String? _codecBucket(ScoredStream s) {
  switch (s.parsed.codec) {
    case VideoCodec.hevc:
      return 'HEVC';
    case VideoCodec.av1:
      return 'AV1';
    case VideoCodec.avc:
      return 'AVC';
    case VideoCodec.vp9:
    case VideoCodec.mpeg2:
    case VideoCodec.other:
      return null;
  }
}

String? _audioBucket(ScoredStream s) {
  switch (s.audio.codec) {
    case AudioCodec.atmos:
      return 'Atmos';
    case AudioCodec.trueHd:
      return 'TrueHD';
    case AudioCodec.dtsHdMa:
      return 'DTS-HD';
    case AudioCodec.dts:
      return 'DTS';
    case AudioCodec.ddPlus:
      return 'DD+';
    case AudioCodec.ac3:
    case AudioCodec.aac:
    case AudioCodec.opus:
    case AudioCodec.flac:
    case AudioCodec.other:
      return null;
  }
}

bool _isCached(ScoredStream s) => s.cached.values.any((v) => v);

/// One filterable axis: its stable [key], display [label], the [valueOf]
/// bucketing, and the canonical [order] its options appear in.
class FacetDim {
  const FacetDim({
    required this.key,
    required this.label,
    required this.valueOf,
    required this.order,
    this.dynamicOptions = false,
  });

  final String key;
  final String label;
  final String? Function(ScoredStream) valueOf;
  final List<String> order;

  /// When true the dimension's options are not a fixed set (e.g. the installed
  /// add-ons): [facetOptions] appends any value beyond [order] by descending
  /// count. Fixed dimensions keep dropping off-list values as before.
  final bool dynamicOptions;
}

/// The six facet dimensions, in display order. Ports `FACET_DIMS`.
final List<FacetDim> facetDims = [
  FacetDim(
    key: 'resolution',
    label: 'Resolution',
    valueOf: qualityTier,
    order: const ['4K', '1080p', '720p', 'SD'],
  ),
  FacetDim(
    key: 'source',
    label: 'Source',
    valueOf: sourceGroup,
    order: const ['Remux', 'BluRay', 'WEB-DL', 'WEBRip', 'HDTV', 'CAM'],
  ),
  FacetDim(
    key: 'codec',
    label: 'Codec',
    valueOf: _codecBucket,
    order: const ['HEVC', 'AV1', 'AVC'],
  ),
  FacetDim(
    key: 'hdr',
    label: 'HDR',
    valueOf: (s) => s.parsed.hdrFormat != null ? 'HDR' : 'SDR',
    order: const ['HDR', 'SDR'],
  ),
  FacetDim(
    key: 'audio',
    label: 'Audio',
    valueOf: _audioBucket,
    order: const ['Atmos', 'TrueHD', 'DTS-HD', 'DTS', 'DD+'],
  ),
  FacetDim(
    key: 'cached',
    label: 'Availability',
    valueOf: (s) => _isCached(s) ? 'Cached' : 'P2P',
    order: const ['Cached', 'P2P'],
  ),
  FacetDim(
    key: 'addon',
    label: 'Add-on',
    valueOf: _addonBucket,
    order: const [],
    dynamicOptions: true,
  ),
];

/// The add-on that surfaced a stream, or null when unnamed — the bucket for the
/// per-add-on filter (web `buildAddonOptions`).
String? _addonBucket(ScoredStream s) {
  final name = s.parsed.addonName.trim();
  return name.isEmpty ? null : name;
}

/// One available option within a facet dimension and how many streams carry it.
class FacetOption {
  const FacetOption({required this.key, required this.count});

  final String key;
  final int count;
}

/// The options of [dim] actually present in [streams], in canonical order, each
/// with its stream count. Ports `facetOptions`.
List<FacetOption> facetOptions(List<ScoredStream> streams, FacetDim dim) {
  final counts = <String, int>{};
  for (final s in streams) {
    final v = dim.valueOf(s);
    if (v == null) continue;
    counts[v] = (counts[v] ?? 0) + 1;
  }
  final ordered = [
    for (final k in dim.order)
      if (counts.containsKey(k)) FacetOption(key: k, count: counts[k]!),
  ];
  if (!dim.dynamicOptions) return ordered;
  // A dynamic dimension (the add-on list) has no fixed order — append every
  // value beyond [order], most-common first, then alphabetically.
  final rest = counts.keys.where((k) => !dim.order.contains(k)).toList()
    ..sort((a, b) {
      final byCount = counts[b]!.compareTo(counts[a]!);
      return byCount != 0
          ? byCount
          : a.toLowerCase().compareTo(b.toLowerCase());
    });
  return [
    ...ordered,
    for (final k in rest) FacetOption(key: k, count: counts[k]!),
  ];
}

/// Whether [s] satisfies every selected facet in [active] (keyed by dim key →
/// chosen value), skipping the dimension named [except] and any value that is
/// empty or `"all"`. Ports `matchesFacets`.
bool matchesFacets(
  ScoredStream s,
  Map<String, String> active, {
  String? except,
}) {
  for (final dim in facetDims) {
    if (dim.key == except) continue;
    final sel = active[dim.key];
    if (sel == null || sel.isEmpty || sel == 'all') continue;
    if (dim.valueOf(s) != sel) return false;
  }
  return true;
}
