/// Base for the Stremio protocol objects: raw-backed so every optional field
/// round-trips, with typed accessors over the documented shape.
library;

/// Reads any JSON value as a list of strings (`null`/non-list → empty).
List<String> _strListOf(dynamic v) =>
    ((v as List?) ?? const []).map((e) => e.toString()).toList();

abstract class _Json {
  const _Json(this.json);
  final Map<String, dynamic> json;

  String? str(String k) => json[k]?.toString();

  /// Tolerant number read: Stremio/Cinemeta send numeric fields (imdbRating,
  /// season, episode) as either numbers or strings.
  num? number(String k) {
    final v = json[k];
    if (v is num) return v;
    if (v is String) return num.tryParse(v);
    return null;
  }

  bool boolean(String k) => json[k] == true;
  List<String> strList(String k) =>
      ((json[k] as List?) ?? const []).map((e) => e.toString()).toList();
  List<Map<String, dynamic>> objList(String k) =>
      ((json[k] as List?) ?? const [])
          .whereType<Map>()
          .map((e) => e.cast<String, dynamic>())
          .toList();
}

/// A catalog offered by an addon's manifest.
class CatalogDescriptor extends _Json {
  const CatalogDescriptor(super.json);

  String get type => str('type') ?? '';
  String get id => str('id') ?? '';
  String? get name => str('name');

  /// The declared `extra` inputs (genre/skip/search…), with which are required.
  List<CatalogExtraDef> get extra =>
      objList('extra').map(CatalogExtraDef.new).toList();
}

class CatalogExtraDef extends _Json {
  const CatalogExtraDef(super.json);
  String get name => str('name') ?? '';
  bool get isRequired => boolean('isRequired');
  List<String> get options => strList('options');
}

/// A manifest `resources` entry. Addons declare resources either as bare
/// strings (`"stream"`) or as objects (`{name, types, idPrefixes}`) that scope
/// the resource to specific content types / id prefixes. [isObject] preserves
/// that distinction, which `addonAcceptsId` relies on.
class ResourceEntry {
  const ResourceEntry({
    required this.name,
    required this.types,
    required this.idPrefixes,
    required this.isObject,
  });

  final String name;
  final List<String> types;
  final List<String> idPrefixes;
  final bool isObject;
}

/// An addon manifest.
class Manifest extends _Json {
  const Manifest(super.json);

  String get id => str('id') ?? '';
  String? get name => str('name');
  String? get version => str('version');
  String? get description => str('description');
  String? get logo => str('logo');
  String? get background => str('background');
  List<String> get types => strList('types');

  /// Resource names the addon serves. Entries may be strings or objects with a
  /// `name`; this normalizes to the names.
  List<String> get resources => ((json['resources'] as List?) ?? const [])
      .map((e) => e is Map ? (e['name']?.toString() ?? '') : e.toString())
      .where((e) => e.isNotEmpty)
      .toList();

  /// Structured `resources` entries, preserving the string-vs-object form and
  /// each object's `types` / `idPrefixes` scoping.
  List<ResourceEntry> get resourceEntries =>
      ((json['resources'] as List?) ?? const [])
          .map((e) {
            if (e is Map) {
              final m = e.cast<String, dynamic>();
              return ResourceEntry(
                name: m['name']?.toString() ?? '',
                types: _strListOf(m['types']),
                idPrefixes: _strListOf(m['idPrefixes']),
                isObject: true,
              );
            }
            return ResourceEntry(
              name: e.toString(),
              types: const [],
              idPrefixes: const [],
              isObject: false,
            );
          })
          .where((r) => r.name.isNotEmpty)
          .toList();

  /// Top-level id prefixes (`tt`, `kitsu`, …); empty means "no restriction".
  List<String> get idPrefixes => strList('idPrefixes');

  List<CatalogDescriptor> get catalogs =>
      objList('catalogs').map(CatalogDescriptor.new).toList();

  Map<String, dynamic> get _behaviorHints {
    final bh = json['behaviorHints'];
    return bh is Map ? bh.cast<String, dynamic>() : const {};
  }

  /// `behaviorHints.adult` — the addon serves adult content.
  bool get adult => _behaviorHints['adult'] == true;

  /// `behaviorHints.p2p` — the addon's streams are peer-to-peer (torrent).
  bool get p2p => _behaviorHints['p2p'] == true;

  /// `behaviorHints.configurable` — the addon offers a configuration page.
  bool get configurable => _behaviorHints['configurable'] == true;

  /// `behaviorHints.configurationRequired` — the addon must be configured
  /// before it serves anything.
  bool get configurationRequired =>
      _behaviorHints['configurationRequired'] == true;

  /// Whether the addon exposes or demands configuration — the web's
  /// `configurable === true || configurationRequired === true` gate.
  bool get needsConfiguration => configurable || configurationRequired;

  factory Manifest.fromJson(Map<String, dynamic> json) => Manifest(json);
  Map<String, dynamic> toJson() => json;
}

/// A catalog row item / search result.
class MetaPreview extends _Json {
  const MetaPreview(super.json);

  String get id => str('id') ?? '';
  String get type => str('type') ?? '';
  String get name => str('name') ?? '';
  String? get poster => str('poster');
  String? get posterShape => str('posterShape');
  String? get background => str('background');
  String? get description => str('description');
  String? get releaseInfo => str('releaseInfo');
  String? get releaseDate => str('releaseDate');
  String? get originalLanguage => str('originalLanguage');
  /// Country of origin (e.g. `CN`/`KR`), used by the anime origin filter.
  String? get country => str('country');
  num? get imdbRating => number('imdbRating');
  List<String> get genres => strList('genres');

  /// TMDB `now_playing` rows tag their metas as currently in theaters.
  bool get inTheaters => boolean('inTheaters');

  factory MetaPreview.fromJson(Map<String, dynamic> json) => MetaPreview(json);
}

/// A full meta object (detail page).
class Meta extends _Json {
  const Meta(super.json);

  String get id => str('id') ?? '';
  String get type => str('type') ?? '';
  String get name => str('name') ?? '';
  String? get poster => str('poster');
  String? get background => str('background');
  String? get logo => str('logo');
  String? get description => str('description');
  String? get releaseInfo => str('releaseInfo');
  String? get runtime => str('runtime');
  String? get country => str('country');
  num? get imdbRating => number('imdbRating');
  List<String> get genres => strList('genres');
  List<String> get cast => strList('cast');
  List<String> get director => strList('director');
  List<String> get writer => strList('writer');
  List<VideoRef> get videos => objList('videos').map(VideoRef.new).toList();

  factory Meta.fromJson(Map<String, dynamic> json) => Meta(json);
}

/// An episode/video entry within a series meta.
class VideoRef extends _Json {
  const VideoRef(super.json);

  String get id => str('id') ?? '';
  String? get title => str('title') ?? str('name');
  int? get season => number('season')?.toInt();
  int? get episode => number('episode')?.toInt();
  String? get released => str('released');
  String? get thumbnail => str('thumbnail');
  String? get overview => str('overview');
}

/// A playable stream from an addon's `stream` resource.
class AddonStream extends _Json {
  const AddonStream(super.json);

  String? get url => str('url');
  String? get ytId => str('ytId');
  String? get infoHash => str('infoHash');
  int? get fileIdx => number('fileIdx')?.toInt();
  String? get name => str('name');
  String? get title => str('title') ?? str('description');
  Map<String, dynamic> get behaviorHints =>
      ((json['behaviorHints'] as Map?) ?? const {}).cast<String, dynamic>();

  factory AddonStream.fromJson(Map<String, dynamic> json) => AddonStream(json);
}

/// A user-installed addon: `{ id, transportUrl, installedAt, manifest? }`,
/// persisted under `harbor.installed-addons`.
class InstalledAddon {
  const InstalledAddon({
    required this.id,
    required this.transportUrl,
    required this.installedAt,
    this.manifest,
  });

  final String id;
  final String transportUrl;
  final int installedAt;
  final Manifest? manifest;

  factory InstalledAddon.fromJson(Map<String, dynamic> json) => InstalledAddon(
    id: (json['id'] ?? json['transportUrl']).toString(),
    transportUrl: json['transportUrl'] as String,
    installedAt: (json['installedAt'] as num?)?.toInt() ?? 0,
    manifest: json['manifest'] is Map
        ? Manifest((json['manifest'] as Map).cast<String, dynamic>())
        : null,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'transportUrl': transportUrl,
    'installedAt': installedAt,
    if (manifest != null) 'manifest': manifest!.toJson(),
  };
}

/// A directory-catalog addon entry: `{ transportUrl, manifest }`, the raw shape
/// the Stremio addon directories and the stremio-addons.net fallback return.
/// Ported 1:1 from the web `Addon` record.
class CommunityAddon {
  const CommunityAddon({required this.transportUrl, required this.manifest});

  final String transportUrl;
  final Manifest manifest;
}
