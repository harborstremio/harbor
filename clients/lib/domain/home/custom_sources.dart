import 'dart:convert';

/// A user-defined "custom source" row on Home, ported 1:1 from the web
/// `src/lib/custom-sources.ts`. A [CustomSourceRow] is a titled shelf of
/// [CustomSourceFolder] tiles; tapping a folder opens a grid of the works it
/// aggregates (an installed add-on catalog, a TMDB collection/discover query, or
/// a Trakt list). The rows round-trip verbatim inside the `homeRows`
/// customization map (`customSources`), so parsing is tolerant: any malformed
/// entry is dropped, never throwing.

/// A folder source that points at an installed add-on's catalog.
class CatalogSource {
  const CatalogSource({
    required this.addonId,
    required this.type,
    required this.catalogId,
  });

  final String addonId;
  final String type;
  final String catalogId;

  static CatalogSource? fromMap(Map<String, dynamic> m) {
    final addonId = m['addonId'];
    final type = m['type'];
    final catalogId = m['catalogId'];
    if (addonId is! String || type is! String || catalogId is! String) {
      return null;
    }
    return CatalogSource(addonId: addonId, type: type, catalogId: catalogId);
  }
}

/// A folder source backed by a native provider (TMDB discover/collection/company
/// or a Trakt list). Only [provider] + [mediaType] are required; the rest depend
/// on the provider + [tmdbSourceType].
class NativeSource {
  const NativeSource({
    required this.provider,
    required this.mediaType,
    this.title,
    this.sortBy,
    this.filters,
    this.tmdbSourceType,
    this.tmdbId,
    this.traktListId,
  });

  final String provider;
  final String mediaType;
  final String? title;
  final String? sortBy;
  final Map<String, dynamic>? filters;
  final String? tmdbSourceType;
  final String? tmdbId;
  final String? traktListId;

  static NativeSource? fromMap(Map<String, dynamic> m) {
    final provider = m['provider'];
    final mediaType = m['mediaType'];
    if (provider is! String || mediaType is! String) return null;
    String? asStr(dynamic v) => v?.toString();
    final rawFilters = m['filters'];
    return NativeSource(
      provider: provider,
      mediaType: mediaType,
      title: m['title'] is String ? m['title'] as String : null,
      sortBy: m['sortBy'] is String ? m['sortBy'] as String : null,
      filters: rawFilters is Map ? rawFilters.cast<String, dynamic>() : null,
      tmdbSourceType: m['tmdbSourceType'] is String
          ? m['tmdbSourceType'] as String
          : null,
      // TMDB ids arrive as either a number or a string in shared JSON packs.
      tmdbId: asStr(m['tmdbId']),
      traktListId: asStr(m['traktListId']),
    );
  }
}

enum FolderTileShape { landscape, poster }

/// A single tile inside a custom-source row: a cover image (or focus GIF), a
/// title, and one-or-more [catalogSources] / native [sources] it opens.
class CustomSourceFolder {
  const CustomSourceFolder({
    required this.id,
    required this.title,
    required this.tileShape,
    this.coverImageUrl,
    this.focusGifUrl,
    this.coverEmoji,
    this.hideTitle = false,
    this.catalogSources = const [],
    this.sources = const [],
  });

  final String id;
  final String title;
  final FolderTileShape tileShape;
  final String? coverImageUrl;
  final String? focusGifUrl;
  final String? coverEmoji;
  final bool hideTitle;
  final List<CatalogSource> catalogSources;
  final List<NativeSource> sources;

  bool get isPoster => tileShape == FolderTileShape.poster;

  /// Validates + parses a folder, mirroring the per-folder checks in web
  /// `isValidSourceRow`: a folder needs a string id/title, a known tileShape, and
  /// at least one valid catalog- or native-source. Returns null on any failure so
  /// the whole row can be rejected (web returns false for the row).
  static CustomSourceFolder? fromMap(Map<String, dynamic> m) {
    final id = m['id'];
    final title = m['title'];
    final shapeRaw = m['tileShape'];
    if (id is! String || title is! String) return null;
    final shape = switch (shapeRaw) {
      'POSTER' => FolderTileShape.poster,
      'LANDSCAPE' => FolderTileShape.landscape,
      _ => null,
    };
    if (shape == null) return null;

    final catalogSources = <CatalogSource>[];
    final rawCatalog = m['catalogSources'];
    if (rawCatalog is List) {
      for (final e in rawCatalog) {
        if (e is! Map) return null;
        final cs = CatalogSource.fromMap(e.cast<String, dynamic>());
        if (cs == null) return null; // web rejects the row on a bad source
        catalogSources.add(cs);
      }
    }
    final sources = <NativeSource>[];
    final rawNative = m['sources'];
    if (rawNative is List) {
      for (final e in rawNative) {
        if (e is! Map) return null;
        final ns = NativeSource.fromMap(e.cast<String, dynamic>());
        if (ns == null) return null;
        sources.add(ns);
      }
    }
    if (catalogSources.isEmpty && sources.isEmpty) return null;

    return CustomSourceFolder(
      id: id,
      title: title,
      tileShape: shape,
      coverImageUrl: m['coverImageUrl'] is String
          ? m['coverImageUrl'] as String
          : null,
      focusGifUrl: m['focusGifUrl'] is String
          ? m['focusGifUrl'] as String
          : null,
      coverEmoji: m['coverEmoji'] is String ? m['coverEmoji'] as String : null,
      hideTitle: m['hideTitle'] == true,
      catalogSources: catalogSources,
      sources: sources,
    );
  }
}

/// A custom-source row: an id + title and its non-empty list of folders.
class CustomSourceRow {
  const CustomSourceRow({
    required this.id,
    required this.title,
    required this.folders,
  });

  final String id;
  final String title;
  final List<CustomSourceFolder> folders;

  /// Parses + validates one row, mirroring web `isValidSourceRow`: requires a
  /// string id/title and at least one valid folder. Returns null if any folder
  /// is invalid (web rejects the entire row).
  static CustomSourceRow? fromMap(Map<String, dynamic> m) {
    final id = m['id'];
    final title = m['title'];
    if (id is! String || title is! String) return null;
    final rawFolders = m['folders'];
    if (rawFolders is! List || rawFolders.isEmpty) return null;
    final folders = <CustomSourceFolder>[];
    for (final e in rawFolders) {
      if (e is! Map) return null;
      final f = CustomSourceFolder.fromMap(e.cast<String, dynamic>());
      if (f == null) return null;
      folders.add(f);
    }
    if (folders.isEmpty) return null;
    return CustomSourceRow(id: id, title: title, folders: folders);
  }
}

/// Parses the stored `customSources` list (opaque maps) into typed rows, dropping
/// any invalid entry. Ports web `parseSourceRows` for the list-of-maps case.
List<CustomSourceRow> parseCustomSourceRows(List<Map<String, dynamic>> raw) {
  final out = <CustomSourceRow>[];
  final seen = <String>{};
  for (final m in raw) {
    final row = CustomSourceRow.fromMap(m);
    // Web de-dupes by id (first wins) before rendering.
    if (row != null && seen.add(row.id)) out.add(row);
  }
  return out;
}

/// Parses a raw JSON string (a URL body or a pasted blob) into rows, accepting
/// either a single row object or an array. Ports web `parseSourceRows(string)`.
List<CustomSourceRow> parseCustomSourceRowsJson(String jsonString) {
  try {
    final data = jsonDecode(jsonString);
    if (data is List) {
      return parseCustomSourceRows([
        for (final e in data)
          if (e is Map) e.cast<String, dynamic>(),
      ]);
    }
    if (data is Map) {
      return parseCustomSourceRows([data.cast<String, dynamic>()]);
    }
    return const [];
  } catch (_) {
    return const [];
  }
}

/// The subset of [raw] that are valid source-row maps (parse to a non-null
/// [CustomSourceRow]), kept **verbatim** so unmodelled fields (backdropImageUrl,
/// viewMode, pinToTop…) round-trip untouched. Mirrors web `parseSourceRows`
/// filtering while preserving the original object for storage.
List<Map<String, dynamic>> validCustomSourceMaps(
  List<Map<String, dynamic>> raw,
) => [
  for (final m in raw)
    if (CustomSourceRow.fromMap(m) != null) m,
];

/// Coerces already-decoded JSON ([data] — a single object or an array) into the
/// valid source-row maps it holds. Used by the URL-import path where the
/// transport hands back parsed JSON.
List<Map<String, dynamic>> validCustomSourceMapsFromData(dynamic data) {
  if (data is List) {
    return validCustomSourceMaps([
      for (final e in data)
        if (e is Map) e.cast<String, dynamic>(),
    ]);
  }
  if (data is Map) {
    return validCustomSourceMaps([data.cast<String, dynamic>()]);
  }
  return const [];
}

/// Parses a raw JSON string into the valid source-row maps it contains, for
/// verbatim storage. Ports web `parseSourceRows(string)` (map-preserving).
List<Map<String, dynamic>> parseCustomSourceMapsJson(String jsonString) {
  try {
    return validCustomSourceMapsFromData(jsonDecode(jsonString));
  } catch (_) {
    return const [];
  }
}

/// Upserts [incoming] source-row maps into [existing] by their `id` (replacing a
/// same-id row, else appending). Ports web `handleSaveCustomSources`.
List<Map<String, dynamic>> upsertCustomSourceMaps(
  List<Map<String, dynamic>> existing,
  List<Map<String, dynamic>> incoming,
) {
  final next = [...existing];
  for (final ns in incoming) {
    final id = ns['id'];
    final idx = next.indexWhere((s) => s['id'] == id);
    if (idx >= 0) {
      next[idx] = ns;
    } else {
      next.add(ns);
    }
  }
  return next;
}

/// Removes the source row with [id]. Ports web `handleDeleteCustomSource`.
List<Map<String, dynamic>> removeCustomSourceMap(
  List<Map<String, dynamic>> existing,
  String id,
) => [
  for (final s in existing)
    if (s['id'] != id) s,
];
