import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/settings/settings.dart';
import '../domain/streams/custom_filter.dart';
import 'providers.dart';

/// Parses `settings.customStreamFilters` (a stored list of filter JSON) into
/// typed [CustomStreamFilter]s, skipping any malformed entry.
List<CustomStreamFilter> readSavedStreamFilters(Settings s) {
  final raw = s['customStreamFilters'];
  if (raw is! List) return const [];
  return [
    for (final e in raw)
      if (e is Map) CustomStreamFilter.fromJson(e.cast<String, dynamic>()),
  ];
}

/// The saved custom stream filters, backed by `settings.customStreamFilters` so
/// they persist and round-trip with the web app. [save] upserts by id (replaced
/// in place when editing an existing filter, else appended); [remove] drops by
/// id. Ports the web `stremio-layout` save/delete handlers.
class SavedStreamFiltersController extends Notifier<List<CustomStreamFilter>> {
  @override
  List<CustomStreamFilter> build() =>
      readSavedStreamFilters(ref.watch(settingsProvider));

  Future<void> _persist(List<CustomStreamFilter> filters) => ref
      .read(settingsProvider.notifier)
      .setValue('customStreamFilters', [for (final f in filters) f.toJson()]);

  /// Adds [filter], or replaces the existing filter with the same id in place
  /// (preserving its position). Mirrors the web `onSave` upsert.
  Future<void> save(CustomStreamFilter filter) {
    final exists = state.any((f) => f.id == filter.id);
    final next = exists
        ? [
            for (final f in state)
              if (f.id == filter.id) filter else f,
          ]
        : [...state, filter];
    return _persist(next);
  }

  /// Removes the filter with [id]. Mirrors the web `onDelete`.
  Future<void> remove(String id) => _persist([
    for (final f in state)
      if (f.id != id) f,
  ]);
}

/// The reactive saved custom stream filters (settings-backed).
final savedStreamFiltersProvider =
    NotifierProvider<SavedStreamFiltersController, List<CustomStreamFilter>>(
      SavedStreamFiltersController.new,
    );
