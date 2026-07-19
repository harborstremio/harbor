import '../addons/models.dart';

/// The external services a custom list can be imported from. Ported from
/// `ListSource` in `src/lib/lists/types.ts`.
enum ListSource {
  mdblist('MDBList'),
  trakt('Trakt'),
  tmdb('TMDB'),
  letterboxd('Letterboxd'),
  imdb('IMDb'),
  mal('MyAnimeList');

  const ListSource(this.label);

  /// The human-readable service name (the web `SOURCE_LABELS`).
  final String label;
}

/// Why a list failed to resolve. Ported from `ListErrorReason`.
enum ListErrorReason { missingKey, notFound, network, unparseable }

/// A list that could not be resolved, carrying the [reason] and [source] so the
/// UI can explain it. Ported from `ListResolveError`.
class ListResolveError implements Exception {
  const ListResolveError(this.reason, this.source);

  final ListErrorReason reason;
  final ListSource source;

  @override
  String toString() => 'ListResolveError(${source.name}: ${reason.name})';
}

/// A saved external list the user imported by URL, identified by its [source]
/// and [ref] and resolved on demand. Ported from the web `lists/types.ts`
/// `CustomList`; renamed here so it does not collide with the unrelated
/// manually-curated item-collection `CustomList` in `library/custom_lists.dart`.
class ImportedList {
  const ImportedList({
    required this.id,
    required this.name,
    required this.source,
    required this.ref,
    required this.addedAt,
  });

  final String id;
  final String name;
  final ListSource source;
  final String ref;

  /// Epoch milliseconds the list was added, used for ordering.
  final int addedAt;

  @override
  bool operator ==(Object other) =>
      other is ImportedList &&
      other.id == id &&
      other.name == name &&
      other.source == source &&
      other.ref == ref &&
      other.addedAt == addedAt;

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'source': source.name,
    'ref': ref,
    'addedAt': addedAt,
  };

  /// Rebuilds an [ImportedList] from a persisted map, or null if the map is
  /// malformed (missing string fields or an unknown source) so a corrupt entry
  /// is dropped rather than crashing the whole list.
  static ImportedList? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final id = raw['id'];
    final name = raw['name'];
    final ref = raw['ref'];
    final sourceName = raw['source'];
    if (id is! String ||
        name is! String ||
        ref is! String ||
        sourceName is! String) {
      return null;
    }
    final ListSource source;
    try {
      source = ListSource.values.byName(sourceName);
    } on ArgumentError {
      return null;
    }
    return ImportedList(
      id: id,
      name: name,
      source: source,
      ref: ref,
      addedAt: (raw['addedAt'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  int get hashCode => Object.hash(id, name, source, ref, addedAt);

  @override
  String toString() =>
      'ImportedList($id, $name, ${source.name}, $ref, $addedAt)';
}

/// The outcome of resolving a list: its resolved [items] and an optional
/// [title] (a name discovered while resolving). Ported from `ResolveResult`.
class ResolveResult {
  const ResolveResult({required this.items, this.title});

  final List<MetaPreview> items;
  final String? title;
}

/// A detected list: which [source] it belongs to and the opaque [ref] that
/// identifies it within that source (a user/slug pair, a numeric id, etc.).
/// Ported from `DetectResult`.
class DetectResult {
  const DetectResult(this.source, this.ref);

  final ListSource source;
  final String ref;

  @override
  bool operator ==(Object other) =>
      other is DetectResult && other.source == source && other.ref == ref;

  @override
  int get hashCode => Object.hash(source, ref);

  @override
  String toString() => 'DetectResult(${source.name}, $ref)';
}
