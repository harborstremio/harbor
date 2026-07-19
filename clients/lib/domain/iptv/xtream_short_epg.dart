import '../../core/http/json_transport.dart';
import 'm3u.dart';
import 'playlist.dart';
import 'xmltv.dart';
import 'xtream.dart';

final RegExp _streamIdRe = RegExp(r'::xt::(\d+)$');

String? _streamIdOf(IptvChannel ch) => _streamIdRe.firstMatch(ch.id)?.group(1);

/// Fills EPG gaps for Xtream channels that have no XMLTV programmes, using the
/// per-stream `get_short_epg` endpoint. Returns the (possibly augmented) index,
/// or [base] unchanged when nothing was added. Ports
/// `iptv/xtream-short-epg.ts` `hydrateShortEpg`; the transport is injected and
/// [nowMs] overrides the fetch timestamp.
/// Augments [base] with per-stream now/next EPG for an Xtream [source] whose
/// XMLTV feed carries no programmes, using the first [maxChannels] channels.
/// Ports `views/live/hooks/use-xtream-epg-fallback.ts`: returns [base] unchanged
/// for a non-Xtream source, a source without credentials, or a base that
/// already has programmes.
Future<EpgIndex?> xtreamEpgFallback(
  JsonTransport t,
  IptvPlaylistSource source,
  List<IptvChannel> channels,
  EpgIndex? base, {
  int maxChannels = 120,
  int? nowMs,
}) async {
  if (source.kind != IptvSourceKind.xtream) return base;
  final x = source.xtream;
  if (x == null) return base;
  final creds = credsFromServer(x.server, x.username, x.password);
  if (creds == null) return base;
  final baseEmpty = base == null || base.byChannel.isEmpty;
  if (!baseEmpty || channels.isEmpty) return base;
  final subset = channels.take(maxChannels).toList();
  return hydrateShortEpg(t, creds, subset, base, nowMs: nowMs);
}

Future<EpgIndex?> hydrateShortEpg(
  JsonTransport t,
  XtreamCreds creds,
  List<IptvChannel> channels,
  EpgIndex? base, {
  int? nowMs,
}) async {
  final byChannel = <String, List<EpgProgram>>{...?base?.byChannel};
  var added = false;
  for (final ch in channels) {
    final tvgId = ch.tvgId;
    final key = (tvgId != null && tvgId.isNotEmpty) ? tvgId : ch.id;
    if (byChannel[key]?.isNotEmpty ?? false) continue;
    final streamId = _streamIdOf(ch);
    if (streamId == null) continue;
    final rows = await fetchXtreamShortEpg(t, creds, streamId);
    if (rows.isEmpty) continue;
    byChannel[key] = [
      for (final r in rows)
        EpgProgram(
          channelTvgId: key,
          title: r.title,
          description: r.description,
          startMs: r.startMs,
          endMs: r.endMs,
        ),
    ]..sort((a, b) => a.startMs.compareTo(b.startMs));
    added = true;
  }
  if (!added) return base;
  return EpgIndex(
    byChannel: byChannel,
    channelMeta: base?.channelMeta,
    fetchedAt: nowMs ?? DateTime.now().millisecondsSinceEpoch,
  );
}
