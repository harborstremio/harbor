/// A catalog extra (`genre=Action`, `skip=20`, `search=foo`). Stremio encodes
/// extras as a single path segment, not a query string.
class CatalogExtra {
  const CatalogExtra(this.name, this.value);
  final String name;
  final String value;
}

/// Addon-protocol URL construction, transcribed 1:1 from `src/lib/addons.ts`.
/// The `base` is the transportUrl with a trailing `/manifest.json` removed.
String addonBase(String transportUrl) =>
    transportUrl.replaceFirst(RegExp(r'/manifest\.json$'), '');

String _extrasSegment(List<CatalogExtra> extras) => extras
    .map(
      (e) => '${Uri.encodeComponent(e.name)}=${Uri.encodeComponent(e.value)}',
    )
    .join('&');

/// Neutralises the path-structural characters in an addon content id while
/// preserving Stremio's `id:season:episode` separator (a blanket
/// [Uri.encodeComponent] would encode `:` and break addon id matching). The id
/// can come from a *different* (malicious) addon than the one being queried, so
/// a raw `../`, `?`, or `#` would otherwise traverse or inject into the request
/// the app makes to a co-installed addon.
String _encodePathId(String id) => id
    .replaceAll('%', '%25') // must be first
    .replaceAll('/', '%2F')
    .replaceAll('?', '%3F')
    .replaceAll('#', '%23');

/// `${base}/catalog/${type}/${id}.json`, or with extras as a `&`-joined path
/// segment: `${base}/catalog/${type}/${id}/${name=value&...}.json`.
String catalogUrl(
  String base,
  String type,
  String id, [
  List<CatalogExtra> extras = const [],
]) {
  final safeId = _encodePathId(id);
  if (extras.isEmpty) return '$base/catalog/$type/$safeId.json';
  return '$base/catalog/$type/$safeId/${_extrasSegment(extras)}.json';
}

/// `${base}/meta/${type}/${encodeURIComponent(id)}.json`.
String metaUrl(String base, String type, String id) =>
    '$base/meta/$type/${Uri.encodeComponent(id)}.json';

/// `${base}/stream/${type}/${id}.json`. The id's path-structural characters are
/// encoded ([_encodePathId]) so a crafted id from a co-installed addon can't
/// traverse or inject into this addon's request.
String streamUrl(String base, String type, String id) =>
    '$base/stream/$type/${_encodePathId(id)}.json';

/// `${base}/subtitles/${type}/${id}.json`, or with extras
/// (`videoHash=…&videoSize=…&filename=…`) as a `&`-joined path segment.
String subtitlesUrl(
  String base,
  String type,
  String id, [
  List<CatalogExtra> extras = const [],
]) {
  final safeId = _encodePathId(id);
  if (extras.isEmpty) return '$base/subtitles/$type/$safeId.json';
  return '$base/subtitles/$type/$safeId/${_extrasSegment(extras)}.json';
}

/// The addon's configure page, ported from `manifestToConfigureUrl`: a trailing
/// `manifest.json` (with any query string) becomes `configure`.
String configureUrlOf(String transportUrl) => transportUrl.replaceFirst(
  RegExp(r'manifest\.json(\?.*)?$', caseSensitive: false),
  'configure',
);

/// The scheme a shared addon link uses.
enum AddonShareScheme { https, stremio }

/// A shareable addon link, ported from `manifestToShareUrl`: the `stremio`
/// scheme rewrites the `http(s)://` prefix to `stremio://`; `https` returns the
/// transportUrl unchanged.
String shareUrlOf(
  String transportUrl, {
  AddonShareScheme scheme = AddonShareScheme.https,
}) {
  if (scheme == AddonShareScheme.stremio) {
    return transportUrl.replaceFirst(
      RegExp(r'^https?://', caseSensitive: false),
      'stremio://',
    );
  }
  return transportUrl;
}
