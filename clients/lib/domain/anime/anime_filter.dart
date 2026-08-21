import '../addons/models.dart';

/// The origin countries the user can exclude from the anime rows. Ported 1:1
/// from `ORIGIN_OPTIONS` in `lib/anime-filter.ts`.
const animeOriginOptions = <({String code, String label})>[
  (code: 'CN', label: 'Chinese (Donghua)'),
  (code: 'KR', label: 'Korean (Aeni)'),
  (code: 'TW', label: 'Taiwanese'),
];

/// Whether [meta]'s country of origin is in the excluded set. Ported 1:1 from
/// `animeOriginExcluded`.
bool animeOriginExcluded(MetaPreview meta, List<String> excludeOrigins) {
  final country = meta.country;
  return excludeOrigins.isNotEmpty &&
      country != null &&
      excludeOrigins.contains(country);
}

/// True when [meta] should be filtered OUT of the anime rows — excluded by
/// origin, or (when [hideWatched]) already watched. Ported 1:1 from
/// `animeFiltered`; [isWatched] supplies the watched check.
bool animeFiltered(
  MetaPreview meta, {
  required List<String> excludeOrigins,
  required bool hideWatched,
  required bool Function(MetaPreview) isWatched,
}) {
  if (animeOriginExcluded(meta, excludeOrigins)) return true;
  if (hideWatched && isWatched(meta)) return true;
  return false;
}

/// Filters an anime row down to the metas that pass [animeFiltered].
List<MetaPreview> animeFilterRow(
  List<MetaPreview> metas, {
  required List<String> excludeOrigins,
  required bool hideWatched,
  required bool Function(MetaPreview) isWatched,
}) => [
  for (final m in metas)
    if (!animeFiltered(
      m,
      excludeOrigins: excludeOrigins,
      hideWatched: hideWatched,
      isWatched: isWatched,
    ))
      m,
];
