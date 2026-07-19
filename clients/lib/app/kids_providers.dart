import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/catalog/cinemeta.dart' show CinemetaHome;
import '../domain/catalog/cinemeta_catalog.dart' show fetchCinemetaKidsCatalog;
import '../domain/catalog/kids_catalog.dart' show fetchKidsCatalog;
import '../domain/catalog/tmdb_details.dart' show tmdbLogo;
import 'providers.dart' show addonClientProvider, tmdbClientProvider;

/// The Kids catalog (hero + kid-safe rows), ported from the `kids.tsx` build:
/// the keyed TMDB kids catalog, falling back to the keyless Cinemeta
/// Animation/Family catalog when there is no key or the keyed rows are empty —
/// mirroring [movieCatalogProvider].
final kidsCatalogProvider = FutureProvider<CinemetaHome>((ref) async {
  final tmdb = ref.watch(tmdbClientProvider);
  if (tmdb.hasKey) {
    final built = await fetchKidsCatalog(tmdb);
    if (built.rows.isNotEmpty) return built;
  }
  return fetchCinemetaKidsCatalog(ref.watch(addonClientProvider));
});

/// The best localized logo URL for a Kids hero card, keyed by `(metaId,
/// originalLang)`. Resolves TMDB titles via [tmdbLogo]; non-TMDB ids (which the
/// Kids hero never produces — its titles are TMDB discover results) yield null
/// so the card falls back to its name. Null without a TMDB key.
final kidsLogoProvider =
    FutureProvider.family<String?, ({String metaId, String? originalLang})>((
      ref,
      args,
    ) async {
      final client = ref.watch(tmdbClientProvider);
      if (!client.hasKey || !args.metaId.startsWith('tmdb:')) return null;
      return tmdbLogo(client, args.metaId, originalLang: args.originalLang);
    });
