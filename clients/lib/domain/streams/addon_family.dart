import '../addons/models.dart';

/// Addon "family" classification, ported from `src/lib/streams/addon-detect.ts`.
/// Drives per-addon behavior: which addons are pre-ranked (their native order
/// is authoritative), which are status-only (never queried for streams), and
/// slow-timeout selection.
enum AddonFamily { aiostreams, aiostatus, mediafusion, torrentio, comet, other }

/// Classifies an addon by its manifest id/name and transport URL.
AddonFamily detectAddonFamily({
  required Manifest? manifest,
  required String transportUrl,
}) {
  final id = (manifest?.id ?? '').toLowerCase();
  final name = (manifest?.name ?? '').toLowerCase();
  final url = transportUrl.toLowerCase();
  final haystack = '$id $name $url';
  if (RegExp(
    r'aiostatus|aio[\s\-]?status|--status--|stremio[\s\-]?status',
  ).hasMatch(haystack)) {
    return AddonFamily.aiostatus;
  }
  if (RegExp(r'aiostreams|aio[\s\-]?streams').hasMatch(haystack)) {
    return AddonFamily.aiostreams;
  }
  if (RegExp(r'mediafusion').hasMatch(haystack)) return AddonFamily.mediafusion;
  if (RegExp(r'comet').hasMatch(haystack)) return AddonFamily.comet;
  if (RegExp(r'torrentio').hasMatch(haystack)) return AddonFamily.torrentio;
  return AddonFamily.other;
}

/// AIOStreams pre-ranks its own output; its native order is preserved.
bool isAddonRanked({
  required Manifest? manifest,
  required String transportUrl,
}) =>
    detectAddonFamily(manifest: manifest, transportUrl: transportUrl) ==
    AddonFamily.aiostreams;

/// AIOStatus is a status/diagnostic addon — never queried for playable streams.
bool isStatusOnlyAddon({
  required Manifest? manifest,
  required String transportUrl,
}) =>
    detectAddonFamily(manifest: manifest, transportUrl: transportUrl) ==
    AddonFamily.aiostatus;
