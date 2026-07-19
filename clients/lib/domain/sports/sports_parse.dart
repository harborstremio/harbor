import 'sports_espn.dart';

/// Parses the ESPN scoreboard payload into [SportsGame]s. These are the pure
/// half of the fetch pipeline in `lib/sports/espn.ts` — `toSide` and
/// `parseEvents` — with no network or clock; the fetchers drive them.

T? _find<T>(Iterable<T> items, bool Function(T) test) {
  for (final it in items) {
    if (test(it)) return it;
  }
  return null;
}

Map<String, dynamic> _asMap(Object? v) =>
    v is Map ? v.cast<String, dynamic>() : const {};

String? _str(Object? v) => v is String ? v : null;

/// The ordinal suffix ESPN-style: 1st, 2nd, 3rd, 4th…
String _ordinal(int n) => switch (n) {
  1 => '${n}st',
  2 => '${n}nd',
  3 => '${n}rd',
  _ => '${n}th',
};

/// Maps a raw competitor into a [SportsSide]. Athletes (MMA, racing, tennis,
/// golf) resolve their name/flag from the `athlete` node; teams from `team`.
/// Racing entries with no score fall back to their finishing order (1st, 2nd),
/// and combat athletes get their ESPN headshot. Ported 1:1 from `toSide`.
SportsSide toSide(Map<String, dynamic>? c, {String? group}) {
  final team = _asMap(c?['team']);
  final athlete = _asMap(c?['athlete']);
  final isAthlete = c?['type'] == 'athlete';

  final rawScore = c?['score'];
  var scoreValue = rawScore is String
      ? rawScore
      : (rawScore == null ? '' : '$rawScore');
  if (scoreValue.isEmpty && c?['order'] is num) {
    scoreValue = _ordinal((c!['order'] as num).toInt());
  }

  if (isAthlete) {
    var logoUrl = '';
    final flag = athlete['flag'];
    if (flag is Map && flag['href'] is String) logoUrl = flag['href'] as String;
    if (group == 'combat' && c?['id'] != null) {
      logoUrl =
          'https://a.espncdn.com/i/headshots/mma/players/full/${c!['id']}.png';
    }
    return SportsSide(
      name: _str(athlete['displayName']) ?? _str(athlete['fullName']) ?? '',
      abbr: _str(athlete['shortName']) ?? '',
      logo: logoUrl,
      score: scoreValue,
      winner: c?['winner'] == true,
    );
  }
  return SportsSide(
    name: _str(team['displayName']) ?? _str(team['name']) ?? '',
    abbr: _str(team['abbreviation']) ?? '',
    logo: _str(team['logo']) ?? '',
    score: scoreValue,
    winner: c?['winner'] == true,
  );
}

String? _typeAbbr(Map<String, dynamic> comp) =>
    _str(_asMap(comp['type'])['abbreviation'])?.toUpperCase();

/// The competitions to render for one event. Combat cards surface every bout;
/// every other sport collapses to a single competition — the featured one, the
/// main race for F1/NASCAR (race > qualifying > sprint), or the first.
List<Map<String, dynamic>> _competitionsFor(
  LeagueDef def,
  List<Map<String, dynamic>> allComps,
) {
  if (def.group == 'combat') return allComps;

  var comp = _find(allComps, (c) => c['featured'] == true);
  if (comp == null && (def.key == 'F1' || def.key == 'NASCAR')) {
    final race = _find(allComps, (c) {
      final a = _typeAbbr(c);
      return a == 'RACE' || a == 'R' || (a?.contains('MAIN') ?? false);
    });
    final qual = _find(allComps, (c) {
      final a = _typeAbbr(c);
      return (a?.contains('QUAL') ?? false) || a == 'Q';
    });
    final sprint = _find(allComps, (c) {
      final a = _typeAbbr(c);
      return (a?.contains('SPRINT') ?? false) || a == 'S';
    });
    comp = race ?? qual ?? sprint ?? allComps.last;
  } else {
    comp ??= allComps.first;
  }
  return [comp];
}

num _orderOf(Map<String, dynamic> c) {
  final o = c['order'];
  if (o == null) return 99;
  if (o is num) return o;
  return num.tryParse('$o') ?? 99;
}

int _startMs(Object? date) =>
    date is String ? (DateTime.tryParse(date)?.millisecondsSinceEpoch ?? 0) : 0;

List<Map<String, dynamic>> _mapList(Object? v) => [
  if (v is List)
    for (final x in v)
      if (x is Map) x.cast<String, dynamic>(),
];

/// Parses a scoreboard `events` array into games for [def]. Handles tennis/golf
/// groupings, combat multi-bout cards, athlete vs team sides, and skips TBD
/// matchups. Ported 1:1 from `parseEvents`.
List<SportsGame> parseEvents(List<dynamic> events, LeagueDef def) {
  final out = <SportsGame>[];
  for (final evRaw in events) {
    if (evRaw is! Map) continue;
    final ev = evRaw.cast<String, dynamic>();

    // Tennis / golf nest their competitions under groupings; flatten them.
    final flatComps = <Map<String, dynamic>>[];
    final groupings = ev['groupings'];
    if (groupings is List) {
      for (final g in groupings) {
        if (g is Map) flatComps.addAll(_mapList(g['competitions']));
      }
    }
    final directComps = _mapList(ev['competitions']);
    final allComps = flatComps.isNotEmpty ? flatComps : directComps;
    if (allComps.isEmpty) continue;

    for (final comp in _competitionsFor(def, allComps)) {
      final cs = _mapList(comp['competitors']);
      if (cs.length < 2) continue;

      final isAthleteType = cs.any((x) => x['type'] == 'athlete');
      Map<String, dynamic> home;
      Map<String, dynamic> away;
      if (isAthleteType) {
        final sorted = [...cs]
          ..sort((a, b) => _orderOf(a).compareTo(_orderOf(b)));
        home = sorted[0];
        away = sorted[1];
      } else {
        home = _find(cs, (x) => x['homeAway'] == 'home') ?? cs[0];
        away = _find(cs, (x) => x['homeAway'] == 'away') ?? cs[1];
      }

      final statusType = _asMap(_asMap(comp['status'])['type']);
      final rawState = statusType['state'];

      // Skip TBD matchups (both ids negative).
      final homeId = '${home['id'] ?? ''}';
      final awayId = '${away['id'] ?? ''}';
      if (homeId.startsWith('-') && awayId.startsWith('-')) continue;

      final idStr = def.group == 'combat'
          ? '${ev['id']}|${comp['id']}'
          : '${ev['id'] ?? '${def.key}-${out.length}'}';

      out.add(
        SportsGame(
          id: idStr,
          league: def.tag,
          state: SportsState.fromWire(rawState is String ? rawState : 'pre'),
          detail:
              _str(statusType['shortDetail']) ??
              _str(statusType['detail']) ??
              '',
          home: toSide(home, group: def.group),
          away: toSide(away, group: def.group),
          startMs: _startMs(ev['date']),
        ),
      );
    }
  }
  return out;
}
