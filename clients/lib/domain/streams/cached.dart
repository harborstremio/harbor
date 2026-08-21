/// Cached / uncached marker detection on a stream's display text, ported from
/// `src/lib/streams/cached.ts`. A coarse first pass used during fetch (to know
/// whether to recover an info-hash); the fine-grained per-debrid parse lives in
/// the parser layer.
library;

final RegExp uncachedMarkerRx = RegExp(
  r'\b(?:rd|ad|pm|dl|tb|oc)\s*download\b|\buncached\b|[⬇⏳⌛⏬🔽📥☁]',
  caseSensitive: false,
);
final RegExp cachedMarkerRx = RegExp(r'[⚡✅]', unicode: true);

String _haystack(String? name, String? title, String? description) =>
    '${name ?? ''} ${title ?? ''} ${description ?? ''}';

/// Whether the stream text carries an "uncached / needs download" marker.
bool hasUncachedMarker({String? name, String? title, String? description}) =>
    uncachedMarkerRx.hasMatch(_haystack(name, title, description));

/// Whether the stream text carries a "cached / instant" marker.
bool hasCachedMarker({String? name, String? title, String? description}) =>
    cachedMarkerRx.hasMatch(_haystack(name, title, description));
