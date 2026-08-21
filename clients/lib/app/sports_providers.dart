import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/sports/sports_client.dart';
import '../domain/sports/sports_espn.dart';
import '../domain/sports/sports_match_detail.dart';
import 'providers.dart';

/// The ESPN sports client — the live-scoreboard fetcher behind the live-TV
/// sports rail and the match-detail view.
final sportsClientProvider = Provider<SportsClient>(
  (ref) => SportsClient(ref.watch(jsonTransportProvider)),
);

/// The scoreboard for a set of leagues, ordered live-first. Keyed by the sorted
/// league set so distinct rails don't collide. Auto-disposed with its watchers.
final sportsScoreboardProvider =
    FutureProvider.family<List<SportsGame>, List<String>>((ref, leagues) {
      return ref.watch(sportsClientProvider).fetchSports(leagues);
    });

/// The full detail for one game, keyed by its league tag and event id. Backs the
/// match-detail view; auto-disposed with its watchers.
final matchSummaryProvider =
    FutureProvider.family<
      SportsMatchDetail?,
      ({String leagueTag, String eventId})
    >((ref, key) {
      return ref
          .watch(sportsClientProvider)
          .fetchMatchSummary(key.leagueTag, key.eventId);
    });

/// The live-refreshing scoreboard for a comma-joined league set — an initial
/// fetch followed by a refresh every 12 seconds, mirroring `useSports`. Keyed by
/// the CSV (not a `List`, whose identity would defeat the family cache) and
/// auto-disposed, so it only polls while the sports rail is on screen.
final sportsGamesProvider = StreamProvider.family<List<SportsGame>, String>((
  ref,
  leaguesCsv,
) async* {
  final leagues = leaguesCsv.isEmpty ? const <String>[] : leaguesCsv.split(',');
  final client = ref.watch(sportsClientProvider);
  yield await client.fetchSports(leagues);
  await for (final _ in Stream<void>.periodic(const Duration(seconds: 12))) {
    yield await client.fetchSports(leagues);
  }
});

/// The league chip the user has selected on the sports rail (`all` or a league
/// key), persisted so it survives navigating away. Ported from the web's
/// `harbor.sports.league` localStorage state.
class SelectedSportsLeague extends Notifier<String> {
  static const _key = 'harbor.sports.league';

  @override
  String build() => ref.watch(kvStoreProvider).getString(_key) ?? 'all';

  void select(String leagueKey) {
    state = leagueKey;
    ref.read(kvStoreProvider).setString(_key, leagueKey);
  }
}

final selectedSportsLeagueProvider =
    NotifierProvider<SelectedSportsLeague, String>(SelectedSportsLeague.new);
