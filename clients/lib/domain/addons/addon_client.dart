import '../../core/http/json_transport.dart';
import '../../core/result.dart';
import 'addon_url.dart';
import 'models.dart';

/// Fetches addon-protocol resources (manifest, catalog, meta, stream) over the
/// direct JSON transport and parses them into the protocol models.
class AddonClient {
  AddonClient(this._t);

  final JsonTransport _t;

  Future<Result<Manifest>> manifest(String transportUrl) =>
      _get(transportUrl, (data) => Manifest(data));

  Future<Result<List<MetaPreview>>> catalog(
    String base,
    String type,
    String id, {
    List<CatalogExtra> extras = const [],
  }) => _get(
    catalogUrl(base, type, id, extras),
    (data) => ((data['metas'] as List?) ?? const [])
        .whereType<Map>()
        .map((m) => MetaPreview(m.cast<String, dynamic>()))
        .toList(),
  );

  Future<Result<Meta?>> meta(String base, String type, String id) => _get(
    metaUrl(base, type, id),
    (data) => data['meta'] is Map
        ? Meta((data['meta'] as Map).cast<String, dynamic>())
        : null,
  );

  Future<Result<List<AddonStream>>> streams(
    String base,
    String type,
    String id,
  ) => _get(
    streamUrl(base, type, id),
    (data) => ((data['streams'] as List?) ?? const [])
        .whereType<Map>()
        .map((s) => AddonStream(s.cast<String, dynamic>()))
        .toList(),
  );

  Future<Result<T>> _get<T>(
    String url,
    T Function(Map<String, dynamic> data) parse,
  ) async {
    try {
      final res = await _t.getJson(url);
      if (!res.ok) {
        return Err(Failure('Addon request failed (HTTP ${res.statusCode})'));
      }
      final data = res.data;
      if (data is Map) return Ok(parse(data.cast<String, dynamic>()));
      return const Err(Failure('Malformed addon response'));
    } on TransportException catch (e) {
      return Err(Failure(e.message, cause: e));
    }
  }
}
