import '../ai/model_migrations.dart';
import '../i18n/languages.dart';
import '../language/language_names.dart';
import 'defaults.dart';
import 'seek_step.dart';
import 'settings.dart';
import 'theme_sanitize.dart';

final RegExp _hex6 = RegExp(r'^#[0-9a-f]{6}$', caseSensitive: false);

int? _num(String? s) {
  if (s == null) return null;
  return int.tryParse(s.trim());
}

/// Deep-merges a stored nested object over its default. A non-Map value on
/// either side is treated as empty — matching the non-throwing behavior of the
/// original's object spread (`{ ...DEFAULT.x, ...(parsed.x ?? {}) }`), so a
/// corrupt/injected nested field degrades to the default rather than throwing.
Map<String, dynamic> _mergeMap(Object? base, Object? over) => {
  if (base is Map) ...base.cast<String, dynamic>(),
  if (over is Map) ...over.cast<String, dynamic>(),
};

/// Faithful port of `loadStoredSettings` (`src/lib/settings/load.ts`): applies
/// the one-shot migrations, deletes legacy `scrapers*` keys, deep-merges nested
/// objects, forces `subProvidersEnabled.wyzie=false`/`opensubtitles=true`,
/// normalizes preferred languages, migrates the AI model id, sanitizes the
/// theme, validates constrained fields, and honors the legacy seek-step keys.
Settings loadStoredSettings(
  Map<String, dynamic>? parsed, {
  String? legacySeekBack,
  String? legacySeekForward,
  String? deviceUiLanguage,
}) {
  final d = buildDefaultSettings();

  if (parsed == null) {
    // First run: default the interface language to the device's OS language
    // when Harbor supports it (else English). The user can still change it in
    // Settings, and once settings are persisted their choice is respected — the
    // seed only applies while there is no stored blob.
    d['uiLanguage'] = normalizeUiLanguage(deviceUiLanguage);
    d['seekBackStepSec'] = sanitizeSeekStep(
      _num(legacySeekBack),
      d['seekBackStepSec'] as int,
    );
    d['seekForwardStepSec'] = sanitizeSeekStep(
      _num(legacySeekForward),
      d['seekForwardStepSec'] as int,
    );
    return Settings(d);
  }

  try {
    return _migrate(
      parsed,
      d,
      legacySeekBack: legacySeekBack,
      legacySeekForward: legacySeekForward,
    );
  } catch (_) {
    // Any throw during migration/merge on a syntactically-valid but type-corrupt
    // (or externally-injected) blob falls back to DEFAULT, mirroring the outer
    // try/catch in `load.ts`.
    return Settings(buildDefaultSettings());
  }
}

Settings _migrate(
  Map<String, dynamic> parsed,
  Map<String, dynamic> d, {
  String? legacySeekBack,
  String? legacySeekForward,
}) {
  final p = {...parsed};

  if (p['_pickerLayoutStremioV2'] != true) {
    if (p['pickerLayout'] == 'condensed') p['pickerLayout'] = 'stremio';
    p['_pickerLayoutStremio'] = true;
    p['_pickerLayoutStremioV2'] = true;
  }
  if (p['_stremioDeeplinkOnByDefault'] != true) {
    p['stremioDeeplinkInstall'] = true;
    p['_stremioDeeplinkOnByDefault'] = true;
  }
  if (p['_anilistSyncOnV1'] != true) {
    p['anilistAutoSync'] = true;
    p['_anilistSyncOnV1'] = true;
  }
  if (p['_rememberLastStreamOnV1'] != true) {
    p['rememberLastStream'] = true;
    p['_rememberLastStreamOnV1'] = true;
  }
  if (p['_streamSortAddonV1'] != true) {
    if (p['streamSort'] == 'harbor') p['streamSort'] = 'addon';
    p['_streamSortAddonV1'] = true;
  }
  if (p['aiSearchModel'] is String &&
      (p['aiSearchModel'] as String).isNotEmpty) {
    p['aiSearchModel'] = migrateModelId(p['aiSearchModel'] as String);
  }
  if (p['_mpvEmbedV3'] != true) {
    p['playerMpvEmbed'] = true;
    p['_mpvEmbedV3'] = true;
  }
  if (p['_mpvEmbedV4'] != true) {
    p['playerMpvEmbed'] = true;
    p['_mpvEmbedV4'] = true;
  }
  if (p['_anime4kIndicatorOffV1'] != true) {
    p['playerAnime4kIndicator'] = false;
    p['_anime4kIndicatorOffV1'] = true;
  }
  if (p['_subStyleV2'] != true) {
    if (p['subFontSize'] == 55) p['subFontSize'] = d['subFontSize'];
    if (p['subBorderSize'] == 3) p['subBorderSize'] = d['subBorderSize'];
    if (p['subMarginY'] == 22) p['subMarginY'] = d['subMarginY'];
    p['_subStyleV2'] = true;
  }

  p.remove('scrapers');
  p.remove('scrapersAcknowledged');
  p.remove('_scrapersV2');

  final m = {...d, ...p};

  m['streaming'] = _mergeMap(d['streaming'], p['streaming']);
  m['subProvidersEnabled'] = {
    ..._mergeMap(d['subProvidersEnabled'], p['subProvidersEnabled']),
    'wyzie': false,
    'opensubtitles': true,
  };
  m['hideContent'] = _mergeMap(d['hideContent'], p['hideContent']);
  m['homeRows'] = _mergeMap(d['homeRows'], p['homeRows']);
  m['navCustomization'] = _mergeMap(
    d['navCustomization'],
    p['navCustomization'],
  );
  m['letterboxd'] = _mergeMap(d['letterboxd'], p['letterboxd']);

  m['preferredSubLangs'] =
      (p['preferredSubLangs'] is List
              ? p['preferredSubLangs'] as List
              : d['preferredSubLangs'] as List)
          .map((e) => languageName(e.toString()))
          .toList();
  m['preferredAudioLangs'] =
      (p['preferredAudioLangs'] is List
              ? p['preferredAudioLangs'] as List
              : d['preferredAudioLangs'] as List)
          .map((e) => languageName(e.toString()))
          .toList();

  m['castAlwaysTranscode'] =
      p['castAlwaysTranscode'] ?? d['castAlwaysTranscode'];
  m['showMalBadge'] = p['showMalBadge'] ?? d['showMalBadge'];
  m['badgePlacement'] =
      (p['badgePlacement'] == 'top' || p['badgePlacement'] == 'bottom')
      ? p['badgePlacement']
      : d['badgePlacement'];
  m['harborColor'] =
      (p['harborColor'] is String && _hex6.hasMatch(p['harborColor'] as String))
      ? p['harborColor']
      : d['harborColor'];
  m['traktClientId'] = p['traktClientId'] ?? d['traktClientId'];
  m['traktClientSecret'] = p['traktClientSecret'] ?? d['traktClientSecret'];
  m['traktAccessToken'] = p['traktAccessToken'] ?? d['traktAccessToken'];
  m['traktRefreshToken'] = p['traktRefreshToken'] ?? d['traktRefreshToken'];
  m['traktExpiresAt'] = p['traktExpiresAt'] ?? d['traktExpiresAt'];
  m['traktUsername'] = p['traktUsername'] ?? d['traktUsername'];
  m['seekBackStepSec'] = sanitizeSeekStep(
    p['seekBackStepSec'] ?? _num(legacySeekBack),
    d['seekBackStepSec'] as int,
  );
  m['seekForwardStepSec'] = sanitizeSeekStep(
    p['seekForwardStepSec'] ?? _num(legacySeekForward),
    d['seekForwardStepSec'] as int,
  );
  m['theme'] = sanitizeTheme(p['theme']);
  m['webhooks'] = {
    ..._mergeMap(d['webhooks'], p['webhooks']),
    'sources': _mergeMap(
      (d['webhooks'] as Map)['sources'],
      p['webhooks'] is Map ? (p['webhooks'] as Map)['sources'] : null,
    ),
  };

  final pc = p['customCalendar'] is Map ? p['customCalendar'] as Map : null;
  final pcTypes = pc?['mediaTypes'] as Map?;
  m['customCalendar'] = {
    ..._mergeMap(d['customCalendar'], pc),
    'trackedPeople': pc?['trackedPeople'] is List ? pc!['trackedPeople'] : [],
    'genres': pc?['genres'] is List ? pc!['genres'] : [],
    'watchProviders': pc?['watchProviders'] is List
        ? pc!['watchProviders']
        : [],
    'originCountries': pc?['originCountries'] is List
        ? pc!['originCountries']
        : [],
    'mediaTypes': {
      'movie': pcTypes?['movie'] != false,
      'tv': pcTypes?['tv'] != false,
      'anime': pcTypes?['anime'] != false,
    },
  };

  m['webhookRules'] = p['webhookRules'] is List ? p['webhookRules'] : [];
  m['customStreamFilters'] = p['customStreamFilters'] is List
      ? p['customStreamFilters']
      : d['customStreamFilters'];
  m['animeFavoriteGenres'] = p['animeFavoriteGenres'] is List
      ? (p['animeFavoriteGenres'] as List).whereType<num>().toList()
      : d['animeFavoriteGenres'];
  m['animePicksDismissedAt'] = p['animePicksDismissedAt'] is num
      ? p['animePicksDismissedAt']
      : d['animePicksDismissedAt'];
  m['animeAnilistRowsHidden'] = p['animeAnilistRowsHidden'] is List
      ? (p['animeAnilistRowsHidden'] as List).whereType<String>().toList()
      : d['animeAnilistRowsHidden'];
  m['tmdbImageLangs'] = p['tmdbImageLangs'] is List
      ? (p['tmdbImageLangs'] as List).whereType<String>().toList()
      : d['tmdbImageLangs'];

  return Settings(m);
}
