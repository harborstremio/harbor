import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/awards/award_page.dart';
import '../domain/awards/awards_history.dart';
import '../domain/awards/wikidata_awards.dart';
import 'providers.dart';

/// The awards (wins + nominations) for a title or person by IMDb id, fetched
/// from Wikidata. Cached for the session (keyed by imdb id); empty for a
/// non-IMDb id or when Wikidata is unreachable.
final awardsProvider = FutureProvider.family<List<AwardEntry>, String>(
  (ref, imdbId) => fetchAwards(ref.watch(jsonTransportProvider), imdbId),
);

/// The bundled historical awards dataset (`assets/data/awards.json`), loaded
/// once and parsed into an [AwardsHistory]. Backs the Award view and the
/// bundled-award merge on the detail/person pages.
final awardsHistoryProvider = FutureProvider<AwardsHistory>((ref) async {
  final raw = await rootBundle.loadString('assets/data/awards.json');
  return AwardsHistory.fromJson(jsonDecode(raw) as Map<String, dynamic>);
});

/// The un-enriched film/people seeds for an award body, built from the bundled
/// history.
final awardSeedsProvider = FutureProvider.family<AwardSeeds, AwardType>((
  ref,
  type,
) async {
  final history = await ref.watch(awardsHistoryProvider.future);
  return buildAwardSeeds(history, type);
});

/// The resolved actors/directors/writers for an award body's people rails,
/// enriched from TMDB. Empty without a TMDB key.
final awardPeopleProvider = FutureProvider.family<AwardPeople, AwardType>((
  ref,
  type,
) async {
  final client = ref.watch(tmdbClientProvider);
  if (!client.hasKey) return kEmptyAwardPeople;
  final seeds = await ref.watch(awardSeedsProvider(type).future);
  return resolveAllAwardPeople(client, seeds);
});
