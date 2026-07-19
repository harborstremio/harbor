import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/arabic/arabic_home_rows.dart';
import '../domain/catalog/catalog_row.dart';
import 'i18n_providers.dart';
import 'providers.dart';

/// The Arabic home rows (Ramadan, Drama, Movies, Egyptian classics, Gulf,
/// Comedy, Trending). Shown only when the UI language is Arabic and the home is
/// in curated mode — mirroring the web gate `uiLang === 'ar' && homeMode !==
/// 'classic'` — so it is a no-op cost for everyone else.
final arabicHomeRowsProvider = FutureProvider<List<CatalogRow>>((ref) async {
  if (ref.watch(uiLanguageProvider) != 'ar') return const [];
  final classic =
      ref.watch(settingsProvider).getString('homeMode') == 'classic';
  if (classic) return const [];
  return buildArabicHomeRows(ref.watch(tmdbClientProvider));
});
