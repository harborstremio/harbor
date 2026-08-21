import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/iptv_controllers.dart';
import '../../app/iptv_providers.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/iptv/country_prefs.dart';
import '../../domain/iptv/epg_resolver.dart' show computeTvgIdCounts;
import '../../domain/iptv/group_prefs.dart';
import '../../domain/iptv/live_home.dart';
import '../../domain/iptv/m3u.dart';
import '../../domain/iptv/playlist.dart';
import '../../domain/iptv/xmltv.dart';
import 'country_bar.dart';
import 'live_channel_card.dart';
import 'live_hero.dart';
import 'sports/sports_rail.dart';

/// The 12-hour "h:mm AM/PM" clock for the Live Home header. Ports `fmtClock`.
String fmtLiveClock(int ms) {
  final d = DateTime.fromMillisecondsSinceEpoch(ms);
  final ap = d.hour >= 12 ? 'PM' : 'AM';
  final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
  return '$h:${d.minute.toString().padLeft(2, '0')} $ap';
}

/// The curated Live Home — "Your TV" header, the now-playing spotlight, sports,
/// the "On now" guide row, the personal rails (Continue watching / favorites /
/// pinned), the country filter and the category rails. Ports web `LiveHome`,
/// assembling from [buildLiveHome].
class LiveHomeView extends ConsumerWidget {
  const LiveHomeView({
    super.key,
    required this.tokens,
    required this.tr,
    required this.source,
    required this.playlist,
    required this.epg,
    required this.nowMs,
    required this.onPlay,
    required this.onMenu,
  });

  final HarborTokens tokens;
  final Translations tr;
  final IptvPlaylistSource source;
  final IptvPlaylist playlist;
  final EpgIndex? epg;
  final int nowMs;
  final void Function(IptvChannel) onPlay;
  final void Function(IptvChannel) onMenu;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = tokens;
    final g = pageGutter(Idiom.of(context));
    final stats = ref.read(channelStatsStoreProvider);
    final favorites = ref.watch(favoritesProvider);
    final groupPrefs =
        ref.watch(groupPrefsProvider)[playlist.id] ?? const GroupPrefs();
    final countryPrefs =
        ref.watch(countryPrefsProvider)[source.id] ?? const CountryPrefs();
    ref.watch(channelStatsVersionProvider); // rebuild after a play is recorded
    final tvgCounts = computeTvgIdCounts(playlist.channels);

    final data = buildLiveHome(
      channels: playlist.channels,
      epg: epg,
      nowMs: nowMs,
      sourceId: source.id,
      tvgCounts: tvgCounts,
      recentStats: stats.recentChannels(20, sourceId: source.id),
      topStats: stats.topChannels(20, sourceId: source.id),
      favorites: favorites,
      pinnedGroups: groupPrefs.pinned,
      selectedCountries: countryPrefs.selected,
    );

    return ListView(
      padding: EdgeInsets.only(
        top: 6,
        bottom: 32 + overscanInset(Idiom.of(context)).bottom,
      ),
      children: [
        _title(t, g),
        // The featured hero — rotates through the now-playing spotlight.
        if (data.spotlight.isNotEmpty)
          LiveHero(
            tokens: t,
            tr: tr,
            items: data.spotlight,
            nowMs: nowMs,
            onPlay: onPlay,
          ),
        const SportsRail(),
        // The "On now" guide row — every channel with a live programme.
        if (data.guide.isNotEmpty)
          _nowItemRail(t, tr.t('On now'), data.guide, tvgCounts, g),
        for (final rail in data.rails)
          _channelRail(t, tr.t(rail.title), rail.channels, tvgCounts, g),
        CountryBar(
          tokens: t,
          tr: tr,
          countries: data.countries,
          selected: countryPrefs.selected,
          onToggle: (code) =>
              ref.read(countryPrefsProvider.notifier).toggle(source.id, code),
          onClear: () =>
              ref.read(countryPrefsProvider.notifier).clear(source.id),
          gutter: g,
        ),
        for (final rail in data.categoryRails)
          _channelRail(t, rail.title, rail.channels, tvgCounts, g),
      ],
    );
  }

  Widget _title(HarborTokens t, double g) => Padding(
    padding: EdgeInsets.fromLTRB(g, 8, g, 14),
    child: Row(
      textBaseline: TextBaseline.alphabetic,
      crossAxisAlignment: CrossAxisAlignment.baseline,
      children: [
        Text(
          tr.t('Your TV'),
          style: TextStyle(
            color: t.ink,
            fontSize: 30,
            fontWeight: FontWeight.w500,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(width: 10),
        Text(
          tr.t('at {time}', {'time': fmtLiveClock(nowMs)}),
          style: TextStyle(color: t.inkSubtle, fontSize: 16),
        ),
      ],
    ),
  );

  Widget _sectionLabel(HarborTokens t, String title, double g) => Padding(
    padding: EdgeInsets.fromLTRB(g, 6, g, 10),
    child: Text(
      title,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(color: t.ink, fontSize: 19, fontWeight: FontWeight.w700),
    ),
  );

  Widget _nowItemRail(
    HarborTokens t,
    String title,
    List<NowItem> items,
    Map<String, int> tvgCounts,
    double g,
  ) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionLabel(t, title, g),
        SizedBox(
          height: 196,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsets.symmetric(horizontal: g),
            itemCount: items.length,
            separatorBuilder: (_, _) => const SizedBox(width: 14),
            itemBuilder: (context, i) {
              final it = items[i];
              return SizedBox(
                width: 230,
                child: LiveChannelCard(
                  tokens: t,
                  channel: it.channel,
                  current: it.current,
                  next: it.next,
                  nowMs: nowMs,
                  tr: tr,
                  onPressed: () => onPlay(it.channel),
                  onLongPress: () => onMenu(it.channel),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 22),
      ],
    );
  }

  Widget _channelRail(
    HarborTokens t,
    String title,
    List<IptvChannel> channels,
    Map<String, int> tvgCounts,
    double g,
  ) {
    if (channels.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionLabel(t, title, g),
        SizedBox(
          height: 196,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsets.symmetric(horizontal: g),
            itemCount: channels.length,
            separatorBuilder: (_, _) => const SizedBox(width: 14),
            itemBuilder: (context, i) {
              final ch = channels[i];
              final it = buildNowItem(ch, epg, tvgCounts, nowMs);
              return SizedBox(
                width: 210,
                child: LiveChannelCard(
                  tokens: t,
                  channel: ch,
                  current: it.current,
                  next: it.next,
                  nowMs: nowMs,
                  tr: tr,
                  onPressed: () => onPlay(ch),
                  onLongPress: () => onMenu(ch),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 22),
      ],
    );
  }
}
