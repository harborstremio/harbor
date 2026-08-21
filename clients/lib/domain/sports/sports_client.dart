import '../../core/http/json_transport.dart';
import 'sports_espn.dart';
import 'sports_match_detail.dart';
import 'sports_parse.dart';

/// Fetches live scoreboards from ESPN's public site API. Ported from the network
/// half of `lib/sports/espn.ts`: each league's scoreboard is fetched, and when
/// nothing is on today the most recent past matchday is found via the response
/// calendar (falling back to a day-by-day walk back). Results are cached for a
/// short window and in-flight requests are de-duplicated. Inject [clock] for
/// tests. Raw direct HTTP — no proxy.
class SportsClient {
  SportsClient(
    this._transport, {
    DateTime Function() clock = DateTime.now,
    this.cacheTtl = const Duration(seconds: 10),
  }) : _clock = clock;

  final JsonTransport _transport;
  final DateTime Function() _clock;
  final Duration cacheTtl;

  static const _base = 'https://site.api.espn.com/apis/site/v2/sports';

  final Map<String, ({int at, List<SportsGame> games})> _cache = {};
  final Map<String, Future<List<SportsGame>>> _inflight = {};

  /// Fetches and merges the scoreboards for [leagues], ordered for display.
  /// A league that fails contributes nothing rather than failing the batch.
  Future<List<SportsGame>> fetchSports(List<String> leagues) async {
    final lists = await Future.wait(
      leagues.map((l) => _fetchLeague(l).catchError((_) => <SportsGame>[])),
    );
    return sortGames([for (final l in lists) ...l]);
  }

  /// Fetches the full detail for one game. Combat bouts read the scoreboard
  /// directly (the MMA summary endpoint is broken upstream) and pull each
  /// fighter's deep profile; every other sport reads the `summary` endpoint.
  /// Ported from `fetchMatchSummary`.
  Future<SportsMatchDetail?> fetchMatchSummary(
    String leagueTag,
    String eventId,
  ) async {
    final def = leagueByTag(leagueTag);
    if (def == null) return null;

    if (def.group == 'combat') {
      final res = await _get('$_base/${def.path}/scoreboard');
      if (res == null || !res.ok || res.data is! Map) return null;
      final combat = parseCombatMatch(
        (res.data as Map).cast<String, dynamic>(),
        def,
        eventId,
      );
      if (combat == null) return null;
      final profiles = await Future.wait([
        _fetchMmaProfile(combat.homeId),
        _fetchMmaProfile(combat.awayId),
      ]);
      return SportsMatchDetail(
        game: combat.game,
        homeRoster: const [],
        awayRoster: const [],
        homeStats: const MatchTeamStats(),
        awayStats: const MatchTeamStats(),
        allStats: combat.allStats,
        events: const [],
        homeProfile: profiles[0],
        awayProfile: profiles[1],
      );
    }

    final actualEventId = eventId.contains('|')
        ? eventId.split('|').first
        : eventId;
    final res = await _get('$_base/${def.path}/summary?event=$actualEventId');
    if (res == null || !res.ok || res.data is! Map) return null;
    return parseTeamSummary(
      (res.data as Map).cast<String, dynamic>(),
      def,
      eventId,
    );
  }

  Future<MMAFighterProfile?> _fetchMmaProfile(String id) async {
    if (id.isEmpty) return null;
    final r = await _get(
      'https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/athletes/$id',
    );
    if (r == null || !r.ok || r.data is! Map) return null;
    return parseMmaProfile((r.data as Map).cast<String, dynamic>(), id);
  }

  Future<List<SportsGame>> _fetchLeague(String league) {
    final cached = _cache[league];
    if (cached != null &&
        _clock().millisecondsSinceEpoch - cached.at < cacheTtl.inMilliseconds) {
      return Future.value(cached.games);
    }
    final existing = _inflight[league];
    if (existing != null) return existing;

    final p = _fetchLeagueRaw(league)
        .then((games) {
          _cache[league] = (at: _clock().millisecondsSinceEpoch, games: games);
          return games;
        })
        .catchError((_) => _cache[league]?.games ?? const <SportsGame>[])
        .whenComplete(() {
          // A statement body (not `=> _inflight.remove`), so this returns void:
          // `Map.remove` returns the in-flight future itself, and returning it
          // from whenComplete would make the future await itself — a deadlock.
          _inflight.remove(league);
        });
    _inflight[league] = p;
    return p;
  }

  Future<List<SportsGame>> _fetchLeagueRaw(String league) async {
    final def = leagueByKey(league);
    if (def == null) return const [];

    final res = await _get('$_base/${def.path}/scoreboard');
    if (res == null || !res.ok) return const [];
    final data = res.data;
    final events = _events(data);
    if (events.isNotEmpty) return parseEvents(events, def);

    // Nothing on today — mine the response calendar for the most recent past
    // matchday(s). The calendar is either a list of ISO strings or a list of
    // `{ startDate, endDate }` objects (golf and similar).
    final nowMs = _clock().millisecondsSinceEpoch;
    final pastDates = <int>[];
    for (final entry in _calendar(data)) {
      if (entry is String) {
        final ms = DateTime.tryParse(entry)?.millisecondsSinceEpoch;
        if (ms != null && ms < nowMs) pastDates.add(ms);
      } else if (entry is Map) {
        final end = _ms(entry['endDate']);
        final start = _ms(entry['startDate']);
        final ref = end ?? start;
        if (ref != null && ref < nowMs) pastDates.add(ref);
      }
    }

    if (pastDates.isNotEmpty) {
      pastDates.sort((a, b) => b - a);
      // Dense calendars (tennis) list every day; sample to avoid hammering.
      final candidates = [
        for (var i = 0; i < pastDates.length; i++)
          if (i == 0 || i % 3 == 0) pastDates[i],
      ].take(10);
      for (final ms in candidates) {
        final r = await _get(
          '$_base/${def.path}/scoreboard?dates=${_yyyymmdd(DateTime.fromMillisecondsSinceEpoch(ms, isUtc: true))}',
        );
        if (r != null && r.ok) {
          final evs = _events(r.data);
          if (evs.isNotEmpty) return parseEvents(evs, def);
        }
      }
    }

    return _fetchLeagueLastResults(def);
  }

  /// Fallback when no calendar hint is available: walk back up to 60 days.
  Future<List<SportsGame>> _fetchLeagueLastResults(LeagueDef def) async {
    final now = _clock();
    for (var daysBack = 1; daysBack <= 60; daysBack++) {
      final dateStr = _yyyymmdd(now.subtract(Duration(days: daysBack)).toUtc());
      final r = await _get('$_base/${def.path}/scoreboard?dates=$dateStr');
      if (r == null || !r.ok) continue;
      final evs = _events(r.data);
      if (evs.isNotEmpty) return parseEvents(evs, def);
    }
    return const [];
  }

  Future<JsonResponse?> _get(String url) async {
    try {
      return await _transport.getJson(url);
    } catch (_) {
      return null;
    }
  }

  static List<dynamic> _events(Object? data) =>
      data is Map && data['events'] is List ? data['events'] as List : const [];

  static List<dynamic> _calendar(Object? data) {
    if (data is! Map || data['leagues'] is! List) return const [];
    final leagues = data['leagues'] as List;
    if (leagues.isEmpty || leagues.first is! Map) return const [];
    final cal = (leagues.first as Map)['calendar'];
    return cal is List ? cal : const [];
  }

  static int? _ms(Object? v) =>
      v is String ? DateTime.tryParse(v)?.millisecondsSinceEpoch : null;

  static String _yyyymmdd(DateTime date) {
    final d = date.toUtc();
    return '${d.year.toString().padLeft(4, '0')}'
        '${d.month.toString().padLeft(2, '0')}'
        '${d.day.toString().padLeft(2, '0')}';
  }
}
