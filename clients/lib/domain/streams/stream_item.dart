/// A stream returned by an addon's `stream` resource, plus the annotations the
/// fetch layer attaches (which addon it came from, its rank/priority). Mirrors
/// the `Stream` type in `src/lib/streams/types.ts`.
///
/// Backed by the raw protocol map so every optional field round-trips, with
/// [infoHash] / [fileIdx] / [sources] promoted to fields because the fetch layer
/// resolves them (lowercasing, magnet derivation, source merging).
class StreamItem {
  StreamItem({
    required this.raw,
    String? infoHash,
    int? fileIdx,
    List<String>? sources,
    this.addonId = '',
    this.addonName = '',
    this.addonUrl,
    this.addonRanked = false,
    this.addonPriority,
    this.addonReturnIdx,
  }) : infoHash = infoHash ?? (raw['infoHash'] as String?)?.toLowerCase(),
       fileIdx = fileIdx ?? _asInt(raw['fileIdx']),
       sources = sources ?? _stringList(raw['sources']);

  final Map<String, dynamic> raw;

  /// The 40-hex info-hash (lowercased), possibly derived from `url`/`sources`.
  final String? infoHash;

  /// The file index within a multi-file torrent.
  final int? fileIdx;

  /// `sources` entries (trackers, `dht:<hash>`), merged across duplicates.
  final List<String> sources;

  final String addonId;
  final String addonName;
  final String? addonUrl;

  /// True when the addon pre-ranks its own output (its order is authoritative).
  final bool addonRanked;

  /// The installed-order index of the addon that produced this stream.
  final int? addonPriority;

  /// This stream's position within its addon's response.
  final int? addonReturnIdx;

  String? get name => raw['name']?.toString();
  String? get title => raw['title']?.toString();
  String? get description => raw['description']?.toString();
  String? get url => raw['url']?.toString();
  String? get ytId => raw['ytId']?.toString();
  String? get externalUrl => raw['externalUrl']?.toString();
  String? get nzbUrl => raw['nzbUrl']?.toString();
  String? get fileMustInclude => raw['fileMustInclude']?.toString();
  num? get availability => raw['availability'] as num?;

  Map<String, dynamic> get behaviorHints =>
      ((raw['behaviorHints'] as Map?) ?? const {}).cast<String, dynamic>();

  String? get bingeGroup => behaviorHints['bingeGroup']?.toString();
  int? get videoSize => _asInt(behaviorHints['videoSize']);
  String? get filename =>
      (behaviorHints['filename'] ?? behaviorHints['fileName'])?.toString();

  /// Combined display text used by the parser (filename + title + description +
  /// name), matching `parseStream`'s field order.
  String get displayText => [
    filename,
    title,
    description,
    name,
  ].where((s) => s != null && s.isNotEmpty).join(' ');

  StreamItem copyWith({
    String? infoHash,
    int? fileIdx,
    List<String>? sources,
    String? addonId,
    String? addonName,
    String? addonUrl,
    bool? addonRanked,
    int? addonPriority,
    int? addonReturnIdx,
  }) => StreamItem(
    raw: raw,
    infoHash: infoHash ?? this.infoHash,
    fileIdx: fileIdx ?? this.fileIdx,
    sources: sources ?? this.sources,
    addonId: addonId ?? this.addonId,
    addonName: addonName ?? this.addonName,
    addonUrl: addonUrl ?? this.addonUrl,
    addonRanked: addonRanked ?? this.addonRanked,
    addonPriority: addonPriority ?? this.addonPriority,
    addonReturnIdx: addonReturnIdx ?? this.addonReturnIdx,
  );
}

int? _asInt(dynamic v) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  if (v is String) return int.tryParse(v);
  return null;
}

List<String> _stringList(dynamic v) =>
    ((v as List?) ?? const []).map((e) => e.toString()).toList();
