import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/i18n/languages.dart';
import '../domain/i18n/translations.dart';
import 'providers.dart';

/// The active UI language code (`en`/`ar`/`pt`), from the `uiLanguage` setting.
final uiLanguageProvider = Provider<String>(
  (ref) =>
      normalizeUiLanguage(ref.watch(settingsProvider).getString('uiLanguage')),
);

/// The translator for the active language — call `.t(key, vars)` to localize.
final translationsProvider = Provider<Translations>(
  (ref) => Translations(ref.watch(uiLanguageProvider)),
);

/// Whether the active language lays out right-to-left (Arabic).
final isRtlProvider = Provider<bool>(
  (ref) => isRtl(ref.watch(uiLanguageProvider)),
);
