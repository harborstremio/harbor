import 'channel_stats.dart';
import 'country_prefs.dart';
import 'epg_map.dart';
import 'epg_store.dart';
import 'group_prefs.dart';
import 'pins.dart';
import 'playlist_store.dart';

/// Purges every per-source IPTV cache and preference when a playlist source is
/// removed. Ports `iptv/source-cleanup.ts` `purgePlaylistState`; favorites are
/// an injected callback (as in the web source) since that subsystem removes a
/// source's entries through its own store.
Future<void> purgePlaylistState({
  required String sourceId,
  required IptvPlaylistStore playlistStore,
  required EpgStore epgStore,
  required ChannelStatsStore statsStore,
  required ChannelPinsStore pinsStore,
  required GroupPrefsStore groupPrefsStore,
  required CountryPrefsStore countryPrefsStore,
  required EpgOverrideStore epgOverrideStore,
  Future<void> Function(String sourceId)? removeFavoritesForSource,
}) async {
  if (sourceId.isEmpty) return;
  playlistStore.clear(sourceId);
  epgStore.clear(sourceId);
  await statsStore.removeForSource(sourceId);
  await pinsStore.removeForSource(sourceId);
  await groupPrefsStore.removeForSource(sourceId);
  await countryPrefsStore.removeForSource(sourceId);
  await epgOverrideStore.removeForSource(sourceId);
  await removeFavoritesForSource?.call(sourceId);
}
