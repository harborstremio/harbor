import 'sports_espn.dart';

/// The match-detail model and the pure parse of ESPN's team-sport `summary`
/// payload, ported from `lib/sports/espn.ts`. The network orchestration and the
/// combat (MMA) branch drive these on top.

/// The classification of a key match event.
enum MatchEventType { goal, yellowCard, redCard, substitution, other }

/// One player on a team sheet.
class MatchPlayer {
  const MatchPlayer({
    required this.id,
    required this.name,
    required this.jersey,
    required this.position,
    required this.starter,
    required this.substitutedIn,
    required this.substitutedOut,
    required this.goals,
    required this.yellowCards,
    required this.redCards,
    required this.image,
  });

  final String id;
  final String name;
  final String jersey;
  final String position;
  final bool starter;
  final bool substitutedIn;
  final bool substitutedOut;
  final int goals;
  final int yellowCards;
  final int redCards;
  final String image;
}

/// A team's headline match statistics (soccer). Null fields mean the boxscore
/// had nothing for that team.
class MatchTeamStats {
  const MatchTeamStats({
    this.possession,
    this.shots,
    this.shotsOnTarget,
    this.corners,
    this.fouls,
    this.yellowCards,
    this.redCards,
  });

  final String? possession;
  final String? shots;
  final String? shotsOnTarget;
  final String? corners;
  final String? fouls;
  final String? yellowCards;
  final String? redCards;

  bool get isEmpty =>
      possession == null &&
      shots == null &&
      shotsOnTarget == null &&
      corners == null &&
      fouls == null &&
      yellowCards == null &&
      redCards == null;
}

/// A timeline event — a goal, card, substitution, or other.
class MatchEvent {
  const MatchEvent({
    required this.id,
    required this.time,
    required this.type,
    required this.text,
    this.teamId,
    this.participantName,
  });

  final String id;
  final String time;
  final MatchEventType type;
  final String text;
  final String? teamId;
  final String? participantName;
}

/// A head-to-head statistic row.
class MatchTeamStatRow {
  const MatchTeamStatRow({
    required this.label,
    required this.homeValue,
    required this.awayValue,
  });

  final String label;
  final String homeValue;
  final String awayValue;
}

/// A fighter's "tale of the tape" profile (MMA).
class MMAFighterProfile {
  const MMAFighterProfile({
    required this.age,
    required this.height,
    required this.weight,
    required this.reach,
    required this.stance,
    required this.fullImage,
  });

  final String age;
  final String height;
  final String weight;
  final String reach;
  final String stance;
  final String fullImage;
}

/// The fully-resolved detail for one game — its base [game] plus rosters, team
/// stats, the event timeline, formations, and (for MMA) fighter profiles.
class SportsMatchDetail {
  const SportsMatchDetail({
    required this.game,
    this.homeFormation,
    this.awayFormation,
    required this.homeRoster,
    required this.awayRoster,
    required this.homeStats,
    required this.awayStats,
    required this.allStats,
    required this.events,
    this.homeProfile,
    this.awayProfile,
  });

  final SportsGame game;
  final String? homeFormation;
  final String? awayFormation;
  final List<MatchPlayer> homeRoster;
  final List<MatchPlayer> awayRoster;
  final MatchTeamStats homeStats;
  final MatchTeamStats awayStats;
  final List<MatchTeamStatRow> allStats;
  final List<MatchEvent> events;
  final MMAFighterProfile? homeProfile;
  final MMAFighterProfile? awayProfile;
}

// ── JSON helpers (file-private) ──────────────────────────────────────────────

Map<String, dynamic> _asMap(Object? v) =>
    v is Map ? v.cast<String, dynamic>() : const {};

String? _str(Object? v) => v is String ? v : null;

/// A required string with a fallback — coerces numbers to their text.
String _coerce(Object? v, [String fallback = '']) =>
    v == null ? fallback : (v is String ? v : '$v');

T? _find<T>(Iterable<T> items, bool Function(T) test) {
  for (final it in items) {
    if (test(it)) return it;
  }
  return null;
}

List<Map<String, dynamic>> _mapList(Object? v) => [
  if (v is List)
    for (final x in v)
      if (x is Map) x.cast<String, dynamic>(),
];

Map<String, dynamic>? _firstMap(Object? v) =>
    v is List && v.isNotEmpty && v.first is Map
    ? (v.first as Map).cast<String, dynamic>()
    : null;

int _intOf(Object? v) =>
    v is num ? v.toInt() : (v is String ? (num.tryParse(v)?.toInt() ?? 0) : 0);

// ── Parsers ──────────────────────────────────────────────────────────────────

MatchPlayer _parsePlayer(Map<String, dynamic> p) {
  final athlete = _asMap(p['athlete']);
  final stats = _mapList(p['stats']);
  int stat(String name) =>
      _intOf(_find(stats, (s) => s['name'] == name)?['value']);
  return MatchPlayer(
    id: _coerce(athlete['id']),
    name: _coerce(athlete['displayName']),
    jersey: _str(p['jersey']) ?? _str(athlete['jersey']) ?? '',
    position:
        _str(_asMap(p['position'])['abbreviation']) ??
        _str(_asMap(athlete['position'])['abbreviation']) ??
        '',
    starter: p['starter'] == true,
    substitutedIn: p['substitutedIn'] == true,
    substitutedOut: p['substitutedOut'] == true,
    goals: stat('goals'),
    yellowCards: stat('yellowCards'),
    redCards: stat('redCards'),
    image: _str(_asMap(athlete['headshot'])['href']) ?? '',
  );
}

List<MatchPlayer> _parseRoster(Map<String, dynamic>? rData) {
  if (rData == null || rData['roster'] is! List) return const [];
  return [for (final p in _mapList(rData['roster'])) _parsePlayer(p)];
}

MatchTeamStats _parseStats(Map<String, dynamic>? box) {
  if (box == null || box['statistics'] is! List) return const MatchTeamStats();
  final stats = _mapList(box['statistics']);
  String get(List<String> names) {
    for (final n in names) {
      final dv = _str(_find(stats, (x) => x['name'] == n)?['displayValue']);
      if (dv != null && dv.isNotEmpty) return dv;
    }
    return '0';
  }

  return MatchTeamStats(
    possession: get(['possessionPct', 'possession']),
    shots: get(['totalShots', 'shotsTotal', 'shots']),
    shotsOnTarget: get(['shotsOnTarget', 'shotsOnGoal']),
    corners: get(['wonCorners', 'corners', 'cornerKicks']),
    fouls: get(['foulsCommitted', 'fouls']),
    yellowCards: get(['yellowCards', 'totalYellowCards']),
    redCards: get(['redCards', 'totalRedCards']),
  );
}

MatchEvent _parseEvent(Map<String, dynamic> e) {
  final txt = (_str(_asMap(e['type'])['text']) ?? '').toLowerCase();
  final type = txt.contains('goal')
      ? MatchEventType.goal
      : txt.contains('yellow')
      ? MatchEventType.yellowCard
      : txt.contains('red')
      ? MatchEventType.redCard
      : txt.contains('substitution')
      ? MatchEventType.substitution
      : MatchEventType.other;
  final participant = _asMap(_firstMap(e['participants'])?['athlete']);
  return MatchEvent(
    id: _coerce(e['id']),
    time: _str(_asMap(e['clock'])['displayValue']) ?? '',
    type: type,
    text: _str(e['shortText']) ?? _str(e['text']) ?? '',
    teamId: _str(_asMap(e['team'])['id']),
    participantName: _str(participant['displayName']),
  );
}

/// Flattens ESPN's nested boxscore statistics into head-to-head rows, recursing
/// into stat categories. Ported 1:1 from `processStatItem`.
void _processStatItem(
  Map<String, dynamic> hStat,
  List<Map<String, dynamic>> aStats,
  List<MatchTeamStatRow> out,
) {
  if (hStat['stats'] is List) {
    final aCat = _find(aStats, (s) => s['name'] == hStat['name']);
    final aSub = aCat != null
        ? _mapList(aCat['stats'])
        : const <Map<String, dynamic>>[];
    for (final subH in _mapList(hStat['stats'])) {
      _processStatItem(subH, aSub, out);
    }
    return;
  }
  final name = hStat['name'];
  if (name == null || name == '') return;
  final label = _str(hStat['label']) ?? _str(hStat['displayName']) ?? '$name';
  final aStat = _find(aStats, (s) => s['name'] == name);
  out.add(
    MatchTeamStatRow(
      label: label,
      homeValue: _str(hStat['displayValue']) ?? '0',
      awayValue: (aStat != null ? _str(aStat['displayValue']) : null) ?? '0',
    ),
  );
}

/// Parses the team-sport `summary` payload into a [SportsMatchDetail], or null
/// when the header has no two competitors. Ported from the non-combat branch of
/// `fetchMatchSummary`.
SportsMatchDetail? parseTeamSummary(
  Map<String, dynamic> data,
  LeagueDef def,
  String eventId,
) {
  final header = _firstMap(_asMap(data['header'])['competitions']) ?? const {};
  final teams = _mapList(header['competitors']);
  if (teams.length < 2) return null;

  final homeHeader = _find(teams, (t) => t['homeAway'] == 'home') ?? teams[0];
  final awayHeader = _find(teams, (t) => t['homeAway'] == 'away') ?? teams[1];

  final statusType = _asMap(_asMap(header['status'])['type']);

  SportsSide side(Map<String, dynamic> h) {
    final team = _asMap(h['team']);
    return SportsSide(
      name: _str(team['displayName']) ?? '',
      abbr: _str(team['abbreviation']) ?? '',
      logo: _str(_firstMap(team['logos'])?['href']) ?? '',
      score: _str(h['score']) ?? '',
      winner: h['winner'] == true,
    );
  }

  final game = SportsGame(
    id: eventId,
    league: def.tag,
    state: SportsState.fromWire(_str(statusType['state']) ?? 'pre'),
    detail: _str(statusType['shortDetail']) ?? _str(statusType['detail']) ?? '',
    home: side(homeHeader),
    away: side(awayHeader),
    startMs: _startMs(header['date']),
  );

  final rosters = _mapList(data['rosters']);
  final homeId = _asMap(homeHeader['team'])['id'];
  final awayId = _asMap(awayHeader['team'])['id'];
  final homeRosterData = _find(
    rosters,
    (r) => r['homeAway'] == 'home' || _asMap(r['team'])['id'] == homeId,
  );
  final awayRosterData = _find(
    rosters,
    (r) => r['homeAway'] == 'away' || _asMap(r['team'])['id'] == awayId,
  );

  final boxTeams = _mapList(_asMap(data['boxscore'])['teams']);
  final homeBox = _find(boxTeams, (t) => _asMap(t['team'])['id'] == homeId);
  final awayBox = _find(boxTeams, (t) => _asMap(t['team'])['id'] == awayId);

  final allStats = <MatchTeamStatRow>[];
  if (homeBox != null && homeBox['statistics'] is List) {
    final awayStatList = awayBox != null
        ? _mapList(awayBox['statistics'])
        : const <Map<String, dynamic>>[];
    for (final hStat in _mapList(homeBox['statistics'])) {
      _processStatItem(hStat, awayStatList, allStats);
    }
  }

  return SportsMatchDetail(
    game: game,
    homeFormation: _str(homeRosterData?['formation']),
    awayFormation: _str(awayRosterData?['formation']),
    homeRoster: _parseRoster(homeRosterData),
    awayRoster: _parseRoster(awayRosterData),
    homeStats: _parseStats(homeBox),
    awayStats: _parseStats(awayBox),
    allStats: allStats,
    events: [for (final e in _mapList(data['keyEvents'])) _parseEvent(e)],
  );
}

int _startMs(Object? date) =>
    date is String ? (DateTime.tryParse(date)?.millisecondsSinceEpoch ?? 0) : 0;

// ── Combat (MMA) ─────────────────────────────────────────────────────────────

/// The scoreboard-derived pieces of a combat bout — its base [game], the
/// tale-of-the-tape rows built from the fighters' records, and the two athlete
/// ids whose deep profiles are fetched separately.
class CombatMatch {
  const CombatMatch({
    required this.game,
    required this.allStats,
    required this.homeId,
    required this.awayId,
  });

  final SportsGame game;
  final List<MatchTeamStatRow> allStats;
  final String homeId;
  final String awayId;
}

num _orderOf(Map<String, dynamic> c) {
  final o = c['order'];
  if (o == null) return 99;
  if (o is num) return o;
  return num.tryParse('$o') ?? 99;
}

/// `x || fallback` semantics — the fallback for falsy (null/empty/zero/false).
String _truthy(Object? v, String fallback) {
  if (v == null) return fallback;
  if (v is String) return v.isEmpty ? fallback : v;
  if (v is num) return v == 0 ? fallback : '$v';
  if (v is bool) return v ? '$v' : fallback;
  return '$v';
}

String _combatScore(Object? v) =>
    v is String ? v : (v is num && v != 0 ? '$v' : '');

String _headshot(String id) =>
    'https://a.espncdn.com/i/headshots/mma/players/full/$id.png';

/// Parses a bout out of the MMA scoreboard payload (the combat summary endpoint
/// is broken upstream, so the scoreboard is read directly). Ported from the
/// combat branch of `fetchMatchSummary`. The compound [eventId] is
/// `<eventId>|<competitionId>`.
CombatMatch? parseCombatMatch(
  Map<String, dynamic> data,
  LeagueDef def,
  String eventId,
) {
  final parts = eventId.split('|');
  final actualEventId = parts.isNotEmpty ? parts[0] : eventId;
  final compId = parts.length > 1 ? parts[1] : '';

  final event = _find(
    _mapList(data['events']),
    (e) => '${e['id']}' == actualEventId,
  );
  if (event == null) return null;
  final comp = _find(
    _mapList(event['competitions']),
    (c) => '${c['id']}' == compId,
  );
  if (comp == null) return null;

  final cs = _mapList(comp['competitors']);
  final isAthleteType = cs.any((x) => x['type'] == 'athlete');
  Map<String, dynamic>? homeRaw;
  Map<String, dynamic>? awayRaw;
  if (isAthleteType) {
    final sorted = [...cs]..sort((a, b) => _orderOf(a).compareTo(_orderOf(b)));
    homeRaw = sorted.isNotEmpty ? sorted[0] : null;
    awayRaw = sorted.length > 1 ? sorted[1] : null;
  } else {
    homeRaw = cs.isNotEmpty ? cs[0] : null;
    awayRaw = cs.length > 1 ? cs[1] : null;
  }
  if (homeRaw == null || awayRaw == null) return null;

  SportsSide side(Map<String, dynamic> c) {
    final id = _coerce(c['id']);
    return SportsSide(
      name: _str(_asMap(c['athlete'])['displayName']) ?? '',
      abbr: _str(_asMap(c['athlete'])['shortName']) ?? '',
      score: _combatScore(c['score']),
      winner: c['winner'] == true,
      logo: id.isNotEmpty ? _headshot(id) : '',
    );
  }

  final allStats = <MatchTeamStatRow>[];
  final aRecords = _mapList(awayRaw['records']);
  for (final hr in _mapList(homeRaw['records'])) {
    final ar = _find(aRecords, (a) => a['name'] == hr['name']);
    allStats.add(
      MatchTeamStatRow(
        label: hr['name'] == 'overall' ? 'Overall Record' : _coerce(hr['name']),
        homeValue: _str(hr['summary']) ?? '0',
        awayValue: (ar != null ? _str(ar['summary']) : null) ?? '0',
      ),
    );
  }

  final statusType = _asMap(_asMap(comp['status'])['type']);
  final game = SportsGame(
    id: eventId,
    league: def.tag,
    state: SportsState.fromWire(_str(statusType['state']) ?? 'pre'),
    detail: _str(statusType['shortDetail']) ?? _str(statusType['detail']) ?? '',
    home: side(homeRaw),
    away: side(awayRaw),
    startMs: _startMs(event['date']),
  );

  return CombatMatch(
    game: game,
    allStats: allStats,
    homeId: _coerce(homeRaw['id']),
    awayId: _coerce(awayRaw['id']),
  );
}

/// Arranges a soccer starting XI into pitch rows, back to front. With a
/// [formation] string ("4-3-3") the field players are split by its counts and
/// reversed so the forwards sit on top, the keeper on the bottom; without one
/// they are grouped by position (defenders / midfielders+unknowns / forwards)
/// over the keeper. Ported 1:1 from the `TeamPitch` `pitchRows`.
List<List<MatchPlayer>> pitchRows(List<MatchPlayer> roster, String formation) {
  final starters = roster.where((p) => p.starter).take(11).toList();
  if (starters.isEmpty) return const [];
  final keeper = starters.firstWhere(
    (p) => p.position.toUpperCase().contains('G'),
    orElse: () => starters.first,
  );
  final field = starters.where((p) => p.id != keeper.id).toList();

  if (formation.isEmpty) {
    bool has(MatchPlayer p, String c) => p.position.toUpperCase().contains(c);
    final defs = field.where((p) => has(p, 'D')).toList();
    final mids = field.where((p) => has(p, 'M')).toList();
    final fwds = field
        .where((p) => has(p, 'F') || has(p, 'A') || has(p, 'S'))
        .toList();
    final unknowns = field
        .where(
          (p) => !defs.contains(p) && !mids.contains(p) && !fwds.contains(p),
        )
        .toList();
    return [
      [keeper],
      defs,
      [...mids, ...unknowns],
      fwds,
    ].where((row) => row.isNotEmpty).toList();
  }

  final counts = formation
      .split('-')
      .map((s) => s.isEmpty ? 0 : num.tryParse(s)?.toInt())
      .whereType<int>()
      .toList();
  if (counts.isEmpty) {
    return [
      [keeper],
      field,
    ];
  }
  final rows = <List<MatchPlayer>>[];
  var offset = 0;
  for (final c in counts) {
    final start = offset.clamp(0, field.length).toInt();
    final end = (offset + c).clamp(0, field.length).toInt();
    rows.add(field.sublist(start, end));
    offset += c;
  }
  return [
    ...rows.reversed,
    [keeper],
  ];
}

/// Parses a fighter's deep-profile payload into their tale of the tape. Ported
/// from the combat `fetchProfile` mapping. Falls back to the headshot for the
/// full image using [id].
MMAFighterProfile parseMmaProfile(Map<String, dynamic> d, String id) {
  final href = _str(_firstMap(d['images'])?['href']);
  return MMAFighterProfile(
    age: _truthy(d['age'], '-'),
    height: _truthy(d['displayHeight'], '-'),
    weight: _truthy(d['displayWeight'], '-'),
    reach: _truthy(d['displayReach'], '-'),
    stance: _truthy(_asMap(d['stance'])['text'], '-'),
    fullImage: (href == null || href.isEmpty) ? _headshot(id) : href,
  );
}
