import 'wrapped_types.dart';

/// A top title paired with the genres resolved for it (from its Cinemeta meta).
typedef EnrichedTitle = ({TopTitle title, List<String> genres});

/// Rolls the top titles' genres up into the ranked "Top genres" list — each
/// genre weighted by the title's play count, then the top 8 by count. Ports the
/// genre half of the web `enrichTopTitles` (src/lib/wrapped/enrich.ts); the
/// poster half is handled natively by [RpdbPosterImage], which already resolves
/// a poster chain from the meta id.
List<({String genre, int count})> accumulateWrappedGenres(
  List<EnrichedTitle> enriched,
) {
  final counts = <String, int>{}; // insertion-ordered, like the JS Map
  for (final e in enriched) {
    for (final g in e.genres) {
      counts[g] = (counts[g] ?? 0) + e.title.count;
    }
  }
  final entries = counts.entries
      .map((e) => (genre: e.key, count: e.value))
      .toList();
  // Stable desc sort (JS Array.sort is stable; Dart's is not) so equal-count
  // genres keep first-seen order.
  final indexed = [for (var i = 0; i < entries.length; i++) (i, entries[i])];
  indexed.sort((a, b) {
    final c = b.$2.count.compareTo(a.$2.count);
    return c != 0 ? c : a.$1.compareTo(b.$1);
  });
  return [for (final e in indexed.take(8)) e.$2];
}
