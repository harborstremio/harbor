import 'list_detect.dart';
import 'list_types.dart';

/// Derives a human-readable name from a list [ref], falling back to
/// `"<Source> list"` when the ref's last segment is an opaque id (an IMDb
/// `ls…`/`ur…` id, or a purely numeric id). Ported 1:1 from `deriveName` in
/// `src/views/lists/use-custom-lists.ts`.
String deriveListName(String ref, ListSource source) {
  final parts = ref.split('/').where((s) => s.isNotEmpty).toList();
  final segment = parts.isEmpty ? '' : parts.last;
  final pretty = segment.replaceAll(RegExp(r'[-_]+'), ' ').trim();
  if (pretty.isNotEmpty &&
      !RegExp(r'^(ls|ur)\d+$', caseSensitive: false).hasMatch(pretty) &&
      !RegExp(r'^\d+$').hasMatch(pretty)) {
    return pretty.replaceAllMapped(
      RegExp(r'\b\w'),
      (m) => m.group(0)!.toUpperCase(),
    );
  }
  return '${source.label} list';
}

/// Builds a new [ImportedList] from raw user [input] (a URL or handle), or null
/// when the input isn't a recognized list source. An explicit [name] wins;
/// otherwise the name is derived. Ports the entry-building in the web `addList`.
ImportedList? buildImportedList(
  String input, {
  String? name,
  required String id,
  required int addedAt,
}) {
  final detected = detectSource(input);
  if (detected == null) return null;
  final trimmed = (name ?? '').trim();
  return ImportedList(
    id: id,
    name: trimmed.isNotEmpty
        ? trimmed
        : deriveListName(detected.ref, detected.source),
    source: detected.source,
    ref: detected.ref,
    addedAt: addedAt,
  );
}

/// Returns [lists] with the entry [id] re-pointed at the source/ref detected
/// from [input] (its `addedAt` preserved), or null when [input] isn't a
/// recognized list source. Ports the web `editList`.
List<ImportedList>? editImportedList(
  List<ImportedList> lists,
  String id,
  String input, {
  String? name,
}) {
  final detected = detectSource(input);
  if (detected == null) return null;
  final trimmed = (name ?? '').trim();
  return [
    for (final l in lists)
      if (l.id == id)
        ImportedList(
          id: l.id,
          name: trimmed.isNotEmpty
              ? trimmed
              : deriveListName(detected.ref, detected.source),
          source: detected.source,
          ref: detected.ref,
          addedAt: l.addedAt,
        )
      else
        l,
  ];
}
