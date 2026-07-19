import '../text/deburr.dart';
import 'wikidata_awards.dart';

/// A category within an award body (its stable key and display name). Ported
/// from `AwardCategory` in `awards-catalog.ts` (the fields the history needs).
typedef AwardCategory = ({String key, String name});

/// One historical winner of a category. Ported from `CategoryWinner`.
typedef CategoryWinner = ({
  int year,
  String workTitle,
  List<String> recipients,
});

/// A category and its historical winners. Ported from `CategoryHistory`.
typedef CategoryHistory = ({
  AwardCategory category,
  List<CategoryWinner> entries,
});

typedef _RawEntry = ({int year, String? title, List<String> recipients});
typedef _RawCategory = ({String name, List<_RawEntry> entries});

const Map<AwardType, String> _bundledAwardName = {
  AwardType.oscar: 'Academy Award',
  AwardType.bafta: 'BAFTA Award',
  AwardType.goldenGlobe: 'Golden Globe Award',
  AwardType.emmy: 'Primetime Emmy Award',
  AwardType.sag: 'Screen Actors Guild Award',
  AwardType.criticsChoice: "Critics' Choice Award",
  AwardType.cannes: 'Cannes Film Festival',
  AwardType.venice: 'Venice Film Festival',
  AwardType.berlin: 'Berlin International Film Festival',
};

String _normTitle(String s) => normLoose(s);

String _normCategoryKey(String s) => s
    .toLowerCase()
    .replaceAll(RegExp(r'\bmotion picture\b'), ' ')
    .replaceAll(RegExp(r'\btelevision\b'), ' ')
    .replaceAll(RegExp(r'\bmini[\s-]?series\b'), ' ')
    .replaceAll(RegExp(r'[^a-z0-9]+'), ' ')
    .trim()
    .replaceAll(RegExp(r'\s+'), ' ');

/// The bundled historical awards dataset (`data/awards.json`), providing the
/// Award view's category histories and merging bundled wins into the live
/// Wikidata awards on the detail/person pages. Ported from `awards-history.ts`.
class AwardsHistory {
  AwardsHistory(this._data);

  /// awardTypeId → categoryKey → category.
  final Map<String, Map<String, _RawCategory>> _data;

  /// An empty history (before the asset loads, or if it is missing).
  factory AwardsHistory.empty() => AwardsHistory(const {});

  factory AwardsHistory.fromJson(Map<String, dynamic> json) {
    final data = <String, Map<String, _RawCategory>>{};
    json.forEach((type, cats) {
      if (cats is! Map) return;
      final byKey = <String, _RawCategory>{};
      cats.forEach((catKey, cat) {
        if (cat is! Map) return;
        final entries = <_RawEntry>[];
        for (final e in (cat['entries'] as List? ?? const [])) {
          if (e is! Map) continue;
          final year = e['year'];
          if (year is! num) continue;
          entries.add((
            year: year.toInt(),
            title: e['title'] as String?,
            recipients: [
              for (final r in (e['recipients'] as List? ?? const []))
                if (r is String) r,
            ],
          ));
        }
        byKey[catKey.toString()] = (
          name: cat['name']?.toString() ?? '',
          entries: entries,
        );
      });
      data[type.toString()] = byKey;
    });
    return AwardsHistory(data);
  }

  Map<String, List<AwardEntry>>? _titleIndex;
  Map<String, List<AwardEntry>>? _personIndex;

  /// The winners of [categories] for [awardType], for the Award view.
  List<CategoryHistory> readAwardHistory(
    AwardType awardType,
    List<AwardCategory> categories,
  ) {
    final bucket = _data[awardType.id] ?? const {};
    final out = <CategoryHistory>[];
    for (final cat in categories) {
      final raw = bucket[cat.key];
      if (raw == null) continue;
      final entries = <CategoryWinner>[];
      for (final e in raw.entries) {
        if (e.title == null && e.recipients.isEmpty) continue;
        final workTitle =
            e.title ?? (e.recipients.isNotEmpty ? e.recipients.first : '');
        if (workTitle.isEmpty) continue;
        entries.add((
          year: e.year,
          workTitle: workTitle,
          recipients: e.recipients,
        ));
      }
      if (entries.isNotEmpty) out.add((category: cat, entries: entries));
    }
    return out;
  }

  Map<String, List<AwardEntry>> _buildTitleIndex() {
    final idx = <String, List<AwardEntry>>{};
    _data.forEach((typeId, cats) {
      final type = awardTypeFromId(typeId);
      final prefix = _bundledAwardName[type] ?? 'Award';
      for (final cat in cats.values) {
        for (final e in cat.entries) {
          final title = e.title;
          if (title == null || title.isEmpty) continue;
          (idx[_normTitle(title)] ??= []).add(
            AwardEntry(
              type: type,
              awardName: '$prefix: ${cat.name}',
              category: cat.name,
              year: e.year,
              result: AwardResult.won,
              workTitle: title,
              recipients: e.recipients.isNotEmpty ? e.recipients : null,
            ),
          );
        }
      }
    });
    return idx;
  }

  /// The bundled award wins for a title (optionally within ±1 year).
  List<AwardEntry> bundledAwardsForTitle(String? title, {int? year}) {
    if (title == null || title.isEmpty) return const [];
    final hits = (_titleIndex ??= _buildTitleIndex())[_normTitle(title)] ?? [];
    if (year == null) return hits;
    return hits
        .where((e) => e.year == null || (e.year! - year).abs() <= 1)
        .toList();
  }

  /// Merges bundled wins whose body isn't already in [live] into it — so a
  /// title's known Oscars still show when Wikidata is missing them.
  List<AwardEntry> mergeBundledAwards(
    List<AwardEntry>? live,
    String? title, {
    int? year,
  }) {
    final liveList = live ?? const <AwardEntry>[];
    final bundled = bundledAwardsForTitle(title, year: year);
    if (bundled.isEmpty) return liveList;
    final liveTypes = liveList.map((e) => e.type).toSet();
    final extra = bundled.where((b) => !liveTypes.contains(b.type)).toList();
    return extra.isEmpty ? liveList : [...liveList, ...extra];
  }

  Map<String, List<AwardEntry>> _buildPersonIndex() {
    final idx = <String, List<AwardEntry>>{};
    _data.forEach((typeId, cats) {
      final type = awardTypeFromId(typeId);
      final prefix = _bundledAwardName[type] ?? 'Award';
      for (final cat in cats.values) {
        for (final e in cat.entries) {
          for (final r in e.recipients) {
            final key = _normTitle(r);
            if (key.isEmpty) continue;
            (idx[key] ??= []).add(
              AwardEntry(
                type: type,
                awardName: '$prefix: ${cat.name}',
                category: cat.name,
                year: e.year,
                result: AwardResult.won,
                workTitle: e.title,
                recipient: r,
                recipients: [r],
              ),
            );
          }
        }
      }
    });
    return idx;
  }

  /// The bundled award wins credited to a person by name.
  List<AwardEntry> bundledAwardsForPerson(String? name) {
    if (name == null || name.isEmpty) return const [];
    return (_personIndex ??= _buildPersonIndex())[_normTitle(name)] ?? const [];
  }

  String _k3(AwardEntry e) =>
      '${e.type.id}|${_normTitle(e.workTitle ?? e.recipient ?? '')}|'
      '${_normCategoryKey(e.category ?? '')}';

  /// De-duplicates a person's award list, keeping the strongest (won over
  /// nominated, newer over older) and carrying over the imdb/work title.
  List<AwardEntry> dedupePersonAwards(List<AwardEntry> entries) {
    final best = <String, AwardEntry>{};
    final order = <String>[];
    for (final e in entries) {
      final work = _normTitle(e.workTitle ?? e.recipient ?? '');
      final key =
          '${e.type.id}|$work|${_normCategoryKey(e.category ?? '')}|'
          '${e.year ?? ''}';
      final prev = best[key];
      if (prev == null) {
        best[key] = e;
        order.add(key);
        continue;
      }
      final prevWon = prev.result == AwardResult.won ? 1 : 0;
      final curWon = e.result == AwardResult.won ? 1 : 0;
      final take = curWon != prevWon
          ? curWon > prevWon
          : (e.year ?? 0) > (prev.year ?? 0);
      final base = take ? e : prev;
      final other = take ? prev : e;
      best[key] = base.copyWith(
        workImdb: base.workImdb ?? other.workImdb,
        workTitle: base.workTitle ?? other.workTitle,
      );
    }
    return [for (final k in order) best[k]!];
  }

  /// Merges bundled person wins with the live list, enriching bundled entries
  /// with any imdb id the live list knows, then de-duplicating.
  List<AwardEntry> mergeBundledPersonAwards(
    List<AwardEntry>? live,
    String? name,
  ) {
    final liveList = live ?? const <AwardEntry>[];
    final bundled = bundledAwardsForPerson(name);
    final liveImdb = <String, String>{};
    for (final e in liveList) {
      final k = _k3(e);
      if (e.workImdb != null && !liveImdb.containsKey(k)) {
        liveImdb[k] = e.workImdb!;
      }
    }
    final enriched = [
      for (final b in bundled)
        if (liveImdb[_k3(b)] case final imdb? when b.workImdb == null)
          b.copyWith(workImdb: imdb)
        else
          b,
    ];
    final bundledKeys = bundled.map(_k3).toSet();
    final liveExtra = liveList.where((e) => !bundledKeys.contains(_k3(e)));
    return dedupePersonAwards([...enriched, ...liveExtra]);
  }
}
