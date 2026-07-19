/// Injected-ad-skip fingerprints, ported 1:1 from web
/// `src/lib/skip-intro/fingerprint.ts`. A source is identified by a *content*
/// key (which title) and a *source* key (which exact release), so a
/// community-marked ad range applies only to the matching rip.
library;

/// The content key: the IMDb id when it is a real `tt…` id, else the meta id.
String adContentKey(String metaId, String? imdbId) {
  if (imdbId != null && imdbId.startsWith('tt')) return imdbId;
  return metaId;
}

/// The source key identifying the exact release:
/// * `ih_<infohash>_<fileIdx>` for a torrent (the strongest signal),
/// * else `rg_<group>_<size>_<title>` for a parsed release,
/// * else `u_<host+path>` for a bare direct URL.
///
/// Only `ih_`/`rg_` keys are ever matched against the corpus or reported; a
/// `u_` key is a non-identifying fallback.
String adSourceKey({
  String? infoHash,
  int? fileIdx,
  String? releaseGroup,
  int? size,
  String? parsedTitle,
  required String url,
}) {
  final hash = infoHash?.toLowerCase();
  if (hash != null && hash.isNotEmpty) return 'ih_${hash}_${fileIdx ?? 0}';
  final group = releaseGroup?.toLowerCase().trim() ?? '';
  final sz = size ?? 0;
  final title = parsedTitle?.toLowerCase().trim() ?? '';
  if (group.isNotEmpty || sz != 0 || title.isNotEmpty) {
    return 'rg_${group}_${sz}_$title';
  }
  return 'u_${_urlRip(url)}';
}

String _urlRip(String url) {
  final u = Uri.tryParse(url);
  if (u != null && u.host.isNotEmpty) {
    return '${u.host}${u.path}'.toLowerCase();
  }
  final cut = url.length < 120 ? url.length : 120;
  return url.substring(0, cut).toLowerCase();
}

/// Whether [sourceKey] is one the corpus/report accept (torrent or parsed
/// release, never a bare-URL `u_` key). Ports the web `startsWith` guards.
bool adSourceReportable(String sourceKey) =>
    sourceKey.startsWith('ih_') || sourceKey.startsWith('rg_');
