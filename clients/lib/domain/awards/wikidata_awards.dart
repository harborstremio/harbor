import '../../core/http/json_transport.dart';

/// The award bodies Harbor recognizes. Ported from `providers/wikidata.ts`.
enum AwardType {
  oscar,
  emmy,
  goldenGlobe,
  bafta,
  sag,
  criticsChoice,
  cannes,
  venice,
  berlin,
  other,
}

/// The stable string id used in nav args and settings (matches the web).
extension AwardTypeId on AwardType {
  String get id => switch (this) {
    AwardType.oscar => 'oscar',
    AwardType.emmy => 'emmy',
    AwardType.goldenGlobe => 'golden_globe',
    AwardType.bafta => 'bafta',
    AwardType.sag => 'sag',
    AwardType.criticsChoice => 'critics_choice',
    AwardType.cannes => 'cannes',
    AwardType.venice => 'venice',
    AwardType.berlin => 'berlin',
    AwardType.other => 'other',
  };
}

/// Resolves a wire id (`golden_globe`, `critics_choice`, …) to its [AwardType].
AwardType awardTypeFromId(String id) => switch (id) {
  'oscar' => AwardType.oscar,
  'emmy' => AwardType.emmy,
  'golden_globe' => AwardType.goldenGlobe,
  'bafta' => AwardType.bafta,
  'sag' => AwardType.sag,
  'critics_choice' => AwardType.criticsChoice,
  'cannes' => AwardType.cannes,
  'venice' => AwardType.venice,
  'berlin' => AwardType.berlin,
  _ => AwardType.other,
};

/// Whether an award was won or merely nominated.
enum AwardResult { won, nominated }

extension AwardResultWire on AwardResult {
  String get wire => this == AwardResult.won ? 'won' : 'nominated';
}

/// A single award win or nomination for a title (or person). Ported from the
/// web `AwardEntry`.
class AwardEntry {
  const AwardEntry({
    required this.type,
    required this.awardName,
    required this.result,
    this.category,
    this.recipient,
    this.recipients,
    this.year,
    this.workTitle,
    this.workImdb,
  });

  final AwardType type;
  final String awardName;
  final AwardResult result;
  final String? category;
  final String? recipient;
  final List<String>? recipients;
  final int? year;
  final String? workTitle;
  final String? workImdb;

  AwardEntry copyWith({
    String? category,
    String? recipient,
    List<String>? recipients,
    String? workTitle,
    String? workImdb,
  }) => AwardEntry(
    type: type,
    awardName: awardName,
    result: result,
    category: category ?? this.category,
    recipient: recipient ?? this.recipient,
    recipients: recipients ?? this.recipients,
    year: year,
    workTitle: workTitle ?? this.workTitle,
    workImdb: workImdb ?? this.workImdb,
  );
}

/// The SPARQL that finds the awards a film (by IMDb id) *won*, covering both the
/// film-holds-the-award and person-holds-it-for-this-film shapes.
const String kAwardWinQuery = '''
SELECT DISTINCT ?award ?awardLabel ?category ?categoryLabel ?recipient ?recipientLabel ?date ?work ?workLabel ?workImdb WHERE {
  ?film wdt:P345 "IMDB_ID".
  {
    ?film p:P166 ?statement.
    ?statement ps:P166 ?award.
    OPTIONAL { ?statement pq:P585 ?date. }
    OPTIONAL { ?statement pq:P642 ?category. }
    OPTIONAL { ?statement pq:P1686 ?work. OPTIONAL { ?work wdt:P345 ?workImdb. } }
  }
  UNION
  {
    ?recipient p:P166 ?statement.
    ?statement pq:P1686 ?film.
    ?statement ps:P166 ?award.
    OPTIONAL { ?statement pq:P585 ?date. }
    OPTIONAL { ?statement pq:P642 ?category. }
    BIND(?film AS ?work)
    OPTIONAL { ?film wdt:P345 ?workImdb. }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 400''';

/// The SPARQL that finds the awards a film was *nominated* for (P1411).
const String kAwardNominationQuery = '''
SELECT DISTINCT ?award ?awardLabel ?category ?categoryLabel ?recipient ?recipientLabel ?date ?work ?workLabel ?workImdb WHERE {
  ?film wdt:P345 "IMDB_ID".
  {
    ?film p:P1411 ?statement.
    ?statement ps:P1411 ?award.
    OPTIONAL { ?statement pq:P585 ?date. }
    OPTIONAL { ?statement pq:P642 ?category. }
    OPTIONAL { ?statement pq:P1686 ?work. OPTIONAL { ?work wdt:P345 ?workImdb. } }
  }
  UNION
  {
    ?recipient p:P1411 ?statement.
    ?statement pq:P1686 ?film.
    ?statement ps:P1411 ?award.
    OPTIONAL { ?statement pq:P585 ?date. }
    OPTIONAL { ?statement pq:P642 ?category. }
    BIND(?film AS ?work)
    OPTIONAL { ?film wdt:P345 ?workImdb. }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 400''';

const List<String> _categoryPrefixes = [
  'Academy Award for ',
  'Primetime Creative Arts Emmy Award for ',
  'Primetime Emmy Award for ',
  'Creative Arts Emmy Award for ',
  'Daytime Emmy Award for ',
  'International Emmy Award for ',
  'Golden Globe Award for ',
  'British Academy Film Award for ',
  'BAFTA TV Award for ',
  'BAFTA Television Award for ',
  'BAFTA Award for ',
  'Screen Actors Guild Award for ',
  "Critics' Choice Movie Award for ",
  "Critics' Choice Television Award for ",
  "Critics' Choice Documentary Award for ",
  "Critics' Choice Real TV Award for ",
  "Critics' Choice Super Award for ",
  "Critics' Choice Award for ",
];

const List<String> _aggregateNames = [
  'golden globe awards',
  'academy awards',
  'bafta awards',
  'primetime emmy awards',
  'creative arts emmy awards',
  'international emmy awards',
  'emmy awards',
  'screen actors guild awards',
  "critics' choice awards",
  'tony awards',
  'grammy awards',
  'cannes film festival',
  'venice film festival',
  'berlin international film festival',
  'saturn awards',
];

/// Strips the award-name prefix down to the bare category (e.g. "Academy Award
/// for Best Picture" → "Best Picture"), preferring an explicitly provided one.
String? prettyCategory(String awardName, String? provided) {
  if (provided != null && provided.isNotEmpty) return provided;
  for (final p in _categoryPrefixes) {
    if (awardName.startsWith(p)) {
      final rest = awardName.substring(p.length).trim();
      return rest.isEmpty ? null : rest;
    }
  }
  return awardName;
}

/// Classifies an award name into an [AwardType].
AwardType classifyAward(String name) {
  final n = name.toLowerCase();
  if (n.contains('academy award') || n.contains('oscar')) {
    return AwardType.oscar;
  }
  if (n.contains('primetime emmy') || n.contains('emmy')) return AwardType.emmy;
  if (n.contains('golden globe')) return AwardType.goldenGlobe;
  if (n.contains('bafta') || n.contains('british academy')) {
    return AwardType.bafta;
  }
  if (n.contains('screen actors guild') || n.contains('sag award')) {
    return AwardType.sag;
  }
  if (n.contains("critics' choice") || n.contains('critics choice')) {
    return AwardType.criticsChoice;
  }
  if (n.contains('palme') || n.contains('cannes')) return AwardType.cannes;
  if (n.contains('golden lion') || n.contains('venice')) {
    return AwardType.venice;
  }
  if (n.contains('golden bear') || n.contains('berlin')) {
    return AwardType.berlin;
  }
  return AwardType.other;
}

final RegExp _awardsSuffix = RegExp(r'\bawards$', caseSensitive: false);

/// Whether an entry is a redundant "the body itself" row (e.g. award name
/// "Academy Awards" with no distinguishing category) rather than a real prize.
bool isAggregateEntry(AwardEntry e) {
  final name = e.awardName.toLowerCase().trim();
  final isBodyName =
      _awardsSuffix.hasMatch(e.awardName.trim()) ||
      _aggregateNames.contains(name);
  if (!isBodyName) return false;
  final cat = e.category?.toLowerCase().trim();
  if (cat != null && cat != name) return false;
  return true;
}

String? _binding(Map row, String field) {
  final v = row[field];
  if (v is Map && v['value'] is String) return v['value'] as String;
  return null;
}

class _Bucket {
  _Bucket(this.entry);
  AwardEntry entry;
  final Set<String> recipients = <String>{};
}

/// Parses a SPARQL JSON result into de-duplicated [AwardEntry]s, merging the
/// recipients of a shared award/category/year and dropping body-level
/// aggregates. Ported from the web `parseRows`.
List<AwardEntry> parseAwardRows(Object? data, AwardResult result) {
  final results = (data is Map) ? data['results'] : null;
  final rows = (results is Map) ? results['bindings'] : null;
  if (rows is! List) return const [];

  final map = <String, _Bucket>{};
  for (final r in rows) {
    if (r is! Map) continue;
    final awardName = _binding(r, 'awardLabel');
    if (awardName == null || awardName.isEmpty) continue;
    final category = prettyCategory(awardName, _binding(r, 'categoryLabel'));
    final recipient = _binding(r, 'recipientLabel');
    final date = _binding(r, 'date');
    final year = date != null ? DateTime.tryParse(date)?.year : null;
    final workLabel = _binding(r, 'workLabel');
    final workTitle = (workLabel != null && !workLabel.startsWith('http'))
        ? workLabel
        : null;
    final workImdb = _binding(r, 'workImdb');
    final key =
        '$awardName|${category ?? ''}|${year ?? ''}|${result.wire}|'
        '${workImdb ?? workTitle ?? ''}';
    var bucket = map[key];
    if (bucket == null) {
      bucket = _Bucket(
        AwardEntry(
          type: classifyAward(awardName),
          awardName: awardName,
          category: category,
          year: year,
          result: result,
          workTitle: workTitle,
          workImdb: workImdb,
        ),
      );
      map[key] = bucket;
    } else {
      if (workTitle != null && bucket.entry.workTitle == null) {
        bucket.entry = bucket.entry.copyWith(workTitle: workTitle);
      }
      if (workImdb != null && bucket.entry.workImdb == null) {
        bucket.entry = bucket.entry.copyWith(workImdb: workImdb);
      }
    }
    if (recipient != null && recipient.isNotEmpty) {
      bucket.recipients.add(recipient);
    }
  }

  final out = <AwardEntry>[];
  for (final b in map.values) {
    final list = b.recipients.toList();
    final e = AwardEntry(
      type: b.entry.type,
      awardName: b.entry.awardName,
      result: b.entry.result,
      category: b.entry.category,
      year: b.entry.year,
      workTitle: b.entry.workTitle,
      workImdb: b.entry.workImdb,
      recipient: list.isNotEmpty ? list.join(', ') : null,
      recipients: list.isNotEmpty ? list : null,
    );
    if (!isAggregateEntry(e)) out.add(e);
  }
  return out;
}

/// Drops generic rows (no work title/imdb) when a more specific row for the same
/// award/category/year already carries a work. Ported from the web.
List<AwardEntry> dropGenericDuplicates(List<AwardEntry> entries) {
  String keyOf(AwardEntry e) =>
      '${e.awardName}|${e.category ?? ''}|${e.year ?? ''}|${e.result.wire}';
  final hasWork = <String>{};
  for (final e in entries) {
    if (e.workImdb != null || e.workTitle != null) hasWork.add(keyOf(e));
  }
  return entries
      .where(
        (e) =>
            e.workImdb != null ||
            e.workTitle != null ||
            !hasWork.contains(keyOf(e)),
      )
      .toList();
}

Future<Object?> _runQuery(JsonTransport transport, String query) async {
  final url =
      'https://query.wikidata.org/sparql?query=${Uri.encodeComponent(query)}'
      '&format=json';
  try {
    final res = await transport.getJson(
      url,
      headers: const {'Accept': 'application/sparql-results+json'},
    );
    if (!res.ok) return null;
    return res.data;
  } catch (_) {
    return null;
  }
}

/// Fetches the awards for an IMDb id (title `tt…` or person `nm…`): runs the win
/// and nomination queries, drops nominations that duplicate a win, and removes
/// generic duplicates. Ported from the web `fetchAwards` (without its browser
/// localStorage cache — Riverpod caches per session). Returns [] for a
/// non-IMDb id or when both queries fail.
Future<List<AwardEntry>> fetchAwards(
  JsonTransport transport,
  String imdbId,
) async {
  if (!imdbId.startsWith('tt') && !imdbId.startsWith('nm')) return const [];
  final data = await Future.wait([
    _runQuery(transport, kAwardWinQuery.replaceAll('IMDB_ID', imdbId)),
    _runQuery(transport, kAwardNominationQuery.replaceAll('IMDB_ID', imdbId)),
  ]);
  final wins = data[0] != null
      ? parseAwardRows(data[0], AwardResult.won)
      : <AwardEntry>[];
  final allNoms = data[1] != null
      ? parseAwardRows(data[1], AwardResult.nominated)
      : <AwardEntry>[];
  String overlapKey(AwardEntry e) =>
      '${e.awardName}|${e.category ?? ''}|${e.year ?? ''}|'
      '${e.workImdb ?? e.workTitle ?? ''}';
  final winKeys = wins.map(overlapKey).toSet();
  final noms = allNoms.where((n) => !winKeys.contains(overlapKey(n))).toList();
  return dropGenericDuplicates([...wins, ...noms]);
}

/// A per-body tally of wins and nominations, in the display order used by the
/// detail block and the meta corner. Ported from the web `awardSummary`.
List<({AwardType type, int wins, int nominations})> awardSummary(
  List<AwardEntry> entries,
) {
  final map = <AwardType, ({int wins, int nominations})>{};
  for (final e in entries) {
    if (e.type == AwardType.other) continue;
    final cur = map[e.type] ?? (wins: 0, nominations: 0);
    map[e.type] = e.result == AwardResult.won
        ? (wins: cur.wins + 1, nominations: cur.nominations)
        : (wins: cur.wins, nominations: cur.nominations + 1);
  }
  const order = [
    AwardType.oscar,
    AwardType.emmy,
    AwardType.bafta,
    AwardType.goldenGlobe,
    AwardType.sag,
    AwardType.cannes,
    AwardType.venice,
    AwardType.berlin,
    AwardType.criticsChoice,
  ];
  return [
    for (final t in order)
      if (map[t] case final v?)
        (type: t, wins: v.wins, nominations: v.nominations),
  ];
}

/// The human label for an award body, pluralized by [n]. Ported from the web
/// `awardTypeLabel`.
String awardTypeLabel(AwardType type, int n) {
  final s = n == 1 ? '' : 's';
  return switch (type) {
    AwardType.oscar => 'Oscar$s',
    AwardType.emmy => 'Emmy$s',
    AwardType.goldenGlobe => 'Golden Globe$s',
    AwardType.bafta => 'BAFTA$s',
    AwardType.sag => 'SAG Award$s',
    AwardType.criticsChoice => "Critics' Choice Award$s",
    AwardType.cannes => 'Cannes Award$s',
    AwardType.venice => 'Venice Award$s',
    AwardType.berlin => 'Berlin Award$s',
    AwardType.other => 'Award$s',
  };
}
