import 'channel_stats.dart' show ChannelStat;
import 'country_detect.dart'
    show
        CountryCount,
        detectCountryFromGroup,
        indexChannelsByCountry,
        stripCountryPrefix;
import 'epg_resolver.dart' show epgProgramsForChannel;
import 'favorites.dart' show StoredFavorite;
import 'm3u.dart' show IptvChannel;
import 'xmltv.dart' show EpgIndex, EpgProgram, findCurrent;

/// A channel with its now/next EPG program and current-program progress. Ports
/// web `NowItem`.
class NowItem {
  const NowItem({
    required this.channel,
    required this.current,
    required this.next,
    required this.progress,
  });
  final IptvChannel channel;
  final EpgProgram? current;
  final EpgProgram? next;
  final double? progress;
}

/// A titled rail of channels on the Live Home. Ports web `ChannelRail`.
class ChannelRail {
  const ChannelRail({
    required this.key,
    required this.title,
    required this.group,
    required this.channels,
    this.flagCode,
  });
  final String key;
  final String title;
  final String? group;
  final String? flagCode;
  final List<IptvChannel> channels;
}

/// The assembled Live Home: the hero spotlight, the now-tiles, the guide cards,
/// the personal rails (recent / favorites / pinned) and the category rails
/// (country-selected groups or theme + top groups), plus the country list.
class LiveHomeData {
  const LiveHomeData({
    required this.spotlight,
    required this.tiles,
    required this.guide,
    required this.rails,
    required this.categoryRails,
    required this.countries,
  });
  final List<NowItem> spotlight;
  final List<IptvChannel> tiles;
  final List<NowItem> guide;
  final List<ChannelRail> rails;
  final List<ChannelRail> categoryRails;
  final List<CountryCount> countries;
}

const _uncategorized = 'Uncategorized';
const _minCountry = 4;
const _maxRails = 120;
const _themeCap = 60;

final _junkRe = RegExp(
  r'\b(xxx|adult|adults|porn|ppv|vip|sex|hardcore|nsfw)\b|18\s*\+|\+\s*18|^[\s#*\-=._|~>]+$',
  caseSensitive: false,
);

class _Theme {
  const _Theme(this.key, this.title, this.re);
  final String key;
  final String title;
  final RegExp re;
}

final List<_Theme> _themes = [
  _Theme(
    'sports',
    'Sports',
    RegExp(
      r'\b(sports?|espn|bein|sky\s?sport|nfl|nba|mlb|nhl|ufc|wwe|boxing|football|soccer|dazn|fubo|golf|tennis|nascar|motogp|formula)\b',
      caseSensitive: false,
    ),
  ),
  _Theme(
    'news',
    'News',
    RegExp(
      r'\b(news|cnn|bbc|msnbc|cnbc|bloomberg|newsmax|gb\s?news|al\s?jazeera|sky\s?news|fox\s?news)\b',
      caseSensitive: false,
    ),
  ),
  _Theme(
    'movies',
    'Movies',
    RegExp(
      r'\b(movies?|cinema|film|films|hbo|cinemax|starz|showtime|tcm|mgm|paramount)\b',
      caseSensitive: false,
    ),
  ),
  _Theme(
    'kids',
    'Kids & Family',
    RegExp(
      r'\b(kids?|cartoon|disney|nick|nickelodeon|junior|baby|boomerang|cbeebies|pbs\s?kids)\b',
      caseSensitive: false,
    ),
  ),
  _Theme(
    'entertainment',
    'Entertainment',
    RegExp(
      r'\b(entertain\w*|comedy|drama|lifestyle|reality|bravo|tlc|usa\s?network|tnt|fx|amc)\b',
      caseSensitive: false,
    ),
  ),
  _Theme(
    'docs',
    'Documentary',
    RegExp(
      r'\b(document\w*|discovery|history|nat\s?geo|national\s?geographic|science|animal|smithsonian)\b',
      caseSensitive: false,
    ),
  ),
  _Theme(
    'music',
    'Music',
    RegExp(
      r'\b(music|mtv|vevo|vh1|kerrang|stingray|trace|hits)\b',
      caseSensitive: false,
    ),
  ),
];

bool _isJunk(String group) => _junkRe.hasMatch(group);

/// The now/next program and progress for a channel. Ports `buildNowItem`.
NowItem buildNowItem(
  IptvChannel ch,
  EpgIndex? epg,
  Map<String, int> tvgCounts,
  int nowMs,
) {
  final programs = epgProgramsForChannel(ch, epg, tvgCounts);
  if (programs == null) {
    return NowItem(channel: ch, current: null, next: null, progress: null);
  }
  final cn = findCurrent(programs, nowMs);
  final current = cn.current;
  final progress = (current != null && current.endMs > current.startMs)
      ? ((nowMs - current.startMs) / (current.endMs - current.startMs)).clamp(
          0.0,
          1.0,
        )
      : null;
  return NowItem(channel: ch, current: current, next: cn.next, progress: progress);
}

IptvChannel _statToChannel(ChannelStat s) => IptvChannel(
  id: s.id,
  name: s.name,
  logo: s.logo,
  group: s.group,
  url: s.url,
);

IptvChannel _favToChannel(StoredFavorite f) => IptvChannel(
  id: f.id,
  tvgId: f.tvgId,
  name: f.name,
  logo: f.logo,
  group: f.group,
  url: f.url,
);

ChannelRail _railFor(String g, List<IptvChannel> channels, [String? code]) =>
    ChannelRail(
      key: code != null ? 'co:$code:$g' : 'cat:$g',
      title: stripCountryPrefix(g),
      group: g,
      flagCode: code ?? detectCountryFromGroup(g)?.code,
      channels: channels.length > 30 ? channels.sublist(0, 30) : channels,
    );

/// Assembles the Live Home — ported 1:1 from `useLiveHome`. The ambient stores
/// (group pins, country prefs, channel stats, favorites) are read by the caller
/// and passed in, so this stays a pure, testable function.
LiveHomeData buildLiveHome({
  required List<IptvChannel> channels,
  required EpgIndex? epg,
  required int nowMs,
  required String sourceId,
  required Map<String, int> tvgCounts,
  required List<ChannelStat> recentStats,
  required List<ChannelStat> topStats,
  required Map<String, StoredFavorite> favorites,
  required List<String> pinnedGroups,
  required List<String> selectedCountries,
}) {
  // ── index (byId / byGroup / theme buckets / top groups) ───────────────────
  final byId = <String, IptvChannel>{};
  final byGroup = <String, List<IptvChannel>>{};
  final themeCh = {for (final t in _themes) t.key: <IptvChannel>[]};
  for (final ch in channels) {
    byId[ch.id] = ch;
    final g = ch.group ?? _uncategorized;
    (byGroup[g] ??= []).add(ch);
    for (final t in _themes) {
      final tc = themeCh[t.key]!;
      if (tc.length < _themeCap && (t.re.hasMatch(g) || t.re.hasMatch(ch.name))) {
        tc.add(ch);
      }
    }
  }
  final topGroups =
      (byGroup.entries.where((e) => !_isJunk(e.key) && e.value.length >= 4).toList()
            ..sort((a, b) => b.value.length.compareTo(a.value.length)))
          .map((e) => e.key)
          .toList();

  final countryIndex = indexChannelsByCountry(channels);
  final channelsByCountry = countryIndex.channelsByCountry;

  NowItem item(IptvChannel ch) => buildNowItem(ch, epg, tvgCounts, nowMs);

  final recentCh = [
    for (final s in recentStats) byId[s.id] ?? _statToChannel(s),
  ];
  final topCh = [for (final s in topStats) byId[s.id] ?? _statToChannel(s)];
  final favCh = [
    for (final f in favorites.values)
      if ((f.sourceId == sourceId || byId.containsKey(f.id)) &&
          ((byId[f.id]?.url ?? f.url).isNotEmpty))
        byId[f.id] ?? _favToChannel(f),
  ];

  // ── guide cards (channels with a current program) ─────────────────────────
  final guide = <NowItem>[];
  final gseen = <String>{};
  void pushGuide(IptvChannel ch) {
    if (gseen.contains(ch.id)) return;
    final it = item(ch);
    if (it.current == null) return;
    gseen.add(ch.id);
    guide.add(it);
  }

  for (final ch in [...recentCh, ...favCh, ...topCh]) {
    pushGuide(ch);
  }
  for (var i = 0; i < channels.length && i < 600 && guide.length < 16; i++) {
    pushGuide(channels[i]);
  }

  // ── now tiles (channels with a logo) ──────────────────────────────────────
  final tiles = <IptvChannel>[];
  final tseen = <String>{};
  void pushTile(IptvChannel? ch) {
    if (ch == null || (ch.logo ?? '').isEmpty || tseen.contains(ch.id)) return;
    tseen.add(ch.id);
    tiles.add(ch);
  }

  for (final ch in [...favCh, ...topCh]) {
    pushTile(ch);
  }
  for (var i = 0; i < channels.length && i < 400 && tiles.length < 18; i++) {
    pushTile(channels[i]);
  }

  // ── hero spotlight (scored top 6 of fav/top/recent) ───────────────────────
  final seen = <String>{};
  final pool = <IptvChannel>[];
  for (final ch in [...favCh, ...topCh, ...recentCh]) {
    if (seen.add(ch.id)) pool.add(ch);
  }
  int score(NowItem it) =>
      (it.current != null ? 4 : 0) +
      ((it.current?.iconUrl ?? '').isNotEmpty ? 2 : 0) +
      ((it.channel.logo ?? '').isNotEmpty ? 1 : 0);
  final scored = [
    for (var i = 0; i < pool.length; i++) (it: item(pool[i]), i: i),
  ]..sort((a, b) {
    final s = score(b.it) - score(a.it);
    return s != 0 ? s : a.i.compareTo(b.i);
  });
  final spotlight = [for (final x in scored.take(6)) x.it];
  if (spotlight.isEmpty) {
    spotlight.addAll(channels.take(6).map(item));
  }

  // ── personal rails: continue watching, favorites, pinned groups ───────────
  final rails = <ChannelRail>[];
  final used = <String>{};
  if (recentCh.isNotEmpty) {
    rails.add(
      ChannelRail(
        key: 'recent',
        title: 'Continue watching',
        group: null,
        channels: recentCh,
      ),
    );
  }
  if (favCh.isNotEmpty) {
    rails.add(
      ChannelRail(
        key: 'fav',
        title: 'Your favorites',
        group: null,
        channels: favCh,
      ),
    );
  }
  for (final g in pinnedGroups) {
    if (used.contains(g) || !byGroup.containsKey(g)) continue;
    rails.add(_railFor(g, byGroup[g] ?? const []));
    used.add(g);
  }

  // ── category rails: country-selected groups, else themes + top groups ─────
  final categoryRails = <ChannelRail>[];
  final selected = selectedCountries
      .where(channelsByCountry.containsKey)
      .toList();
  if (selected.isNotEmpty) {
    for (final code in selected.take(6)) {
      final inCountry = <String, List<IptvChannel>>{};
      for (final ch in channelsByCountry[code] ?? const <IptvChannel>[]) {
        (inCountry[ch.group ?? _uncategorized] ??= []).add(ch);
      }
      final ordered =
          inCountry.entries.where((e) => !_isJunk(e.key)).toList()
            ..sort((a, b) => b.value.length.compareTo(a.value.length));
      for (final e in ordered) {
        if (categoryRails.length >= _maxRails) break;
        categoryRails.add(_railFor(e.key, e.value, code));
      }
      if (categoryRails.length >= _maxRails) break;
    }
  } else {
    for (final t in _themes) {
      final chs = themeCh[t.key]!;
      if (chs.length >= 3) {
        categoryRails.add(
          ChannelRail(
            key: 'theme:${t.key}',
            title: t.title,
            group: null,
            channels: chs.length > 30 ? chs.sublist(0, 30) : chs,
          ),
        );
      }
    }
    for (final g in topGroups) {
      if (categoryRails.length >= _maxRails) break;
      if (used.contains(g)) continue;
      categoryRails.add(_railFor(g, byGroup[g] ?? const []));
    }
  }

  return LiveHomeData(
    spotlight: spotlight,
    tiles: tiles,
    guide: guide,
    rails: rails,
    categoryRails: categoryRails,
    countries: [
      for (final c in countryIndex.countries)
        if (c.count >= _minCountry) c,
    ],
  );
}
