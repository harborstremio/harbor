import 'dart:convert';

import '../../core/storage/kv_store.dart';

/// One recorded playback, ported from `playback-history.ts` (`PlaybackEntry`).
/// The stream fields identify a source for later reuse; the titles feed the
/// watched-title matching used to hide already-watched catalog entries.
class PlaybackEntry {
  const PlaybackEntry({
    this.infoHash,
    this.addonId,
    this.url,
    this.title,
    this.parsedTitle,
    this.bingeGroup,
    this.resolution,
    this.source,
    required this.savedAt,
  });

  final String? infoHash;
  final String? addonId;
  final String? url;
  final String? title;
  final String? parsedTitle;

  /// The add-on's binge-group hint + the parsed resolution/source labels — the
  /// looser "same source profile" identity used to carry a source to the next
  /// episode (`streamMatchesSource`), where the exact info-hash/url differs.
  final String? bingeGroup;
  final String? resolution;
  final String? source;

  /// Epoch milliseconds this entry was last written.
  final int savedAt;

  Map<String, dynamic> toJson() => {
    if (infoHash != null) 'infoHash': infoHash,
    if (addonId != null) 'addonId': addonId,
    if (url != null) 'url': url,
    if (title != null) 'title': title,
    if (parsedTitle != null) 'parsedTitle': parsedTitle,
    if (bingeGroup != null) 'bingeGroup': bingeGroup,
    if (resolution != null) 'resolution': resolution,
    if (source != null) 'source': source,
    'savedAt': savedAt,
  };

  factory PlaybackEntry.fromJson(Map<String, dynamic> j) => PlaybackEntry(
    infoHash: j['infoHash']?.toString(),
    addonId: j['addonId']?.toString(),
    url: j['url']?.toString(),
    title: j['title']?.toString(),
    parsedTitle: j['parsedTitle']?.toString(),
    bingeGroup: j['bingeGroup']?.toString(),
    resolution: j['resolution']?.toString(),
    source: j['source']?.toString(),
    savedAt: (j['savedAt'] as num?)?.toInt() ?? 0,
  );
}

/// The ids and normalized title-keys of recently-played titles — the local
/// watched signal for hiding watched catalog entries (`WatchedSet`).
class WatchedSet {
  const WatchedSet(this.ids, this.titles);
  final Set<String> ids;
  final Set<String> titles;

  bool contains(String id, String? name) {
    if (ids.contains(id)) return true;
    final tk = watchTitleKey(name);
    return tk.isNotEmpty && titles.contains(tk);
  }
}

/// Normalizes a title for cross-id matching — lowercased, `(year)` stripped,
/// non-alphanumerics removed. Ported verbatim from `watchTitleKey`.
String watchTitleKey(String? name) {
  if (name == null || name.isEmpty) return '';
  return name
      .toLowerCase()
      .replaceAll(RegExp(r'\(\d{4}\)'), '')
      .replaceAll(RegExp('[^a-z0-9]+'), '');
}

/// The recently-played store (`harbor.playback-history.v1`): a map of entry key
/// → [PlaybackEntry], TTL-pruned to 30 days and capped at 200 entries.
class PlaybackHistoryStore {
  PlaybackHistoryStore(this._kv, {int Function()? nowMs})
    : _nowMs = nowMs ?? (() => DateTime.now().millisecondsSinceEpoch);

  static const _key = 'harbor.playback-history.v1';
  static const _ttlMs = 30 * 24 * 60 * 60 * 1000;
  static const _maxEntries = 200;

  final KvStore _kv;
  final int Function() _nowMs;

  /// The per-title/episode key, `metaId` or `metaId|sSeE`.
  static String entryKey(String metaId, {int? season, int? episode}) =>
      (season != null && episode != null)
      ? '$metaId|s${season}e$episode'
      : metaId;

  Map<String, PlaybackEntry> _readAll() {
    final raw = _kv.getString(_key);
    if (raw == null || raw.isEmpty) return {};
    try {
      final parsed = jsonDecode(raw);
      if (parsed is! Map) return {};
      final now = _nowMs();
      final out = <String, PlaybackEntry>{};
      parsed.forEach((k, v) {
        if (v is! Map) return;
        final e = PlaybackEntry.fromJson(v.cast<String, dynamic>());
        if (e.savedAt == 0 || now - e.savedAt > _ttlMs) return;
        out[k.toString()] = e;
      });
      return out;
    } catch (_) {
      return {};
    }
  }

  void _writeAll(Map<String, PlaybackEntry> map) {
    var entries = map.entries.toList();
    if (entries.length > _maxEntries) {
      entries.sort((a, b) => b.value.savedAt.compareTo(a.value.savedAt));
      entries = entries.sublist(0, _maxEntries);
    }
    _kv.setString(
      _key,
      jsonEncode({for (final e in entries) e.key: e.value.toJson()}),
    );
  }

  /// The recorded entry for [metaId] (and episode), or null when never played.
  /// Ported from web `readPlayback`; used to mark the last-played source in the
  /// stream picker.
  PlaybackEntry? readEntry(String metaId, {int? season, int? episode}) =>
      _readAll()[entryKey(metaId, season: season, episode: episode)];

  /// Records a playback. A "thin" entry (no stream identity — only titles) does
  /// not overwrite a richer prior entry's source, mirroring `savePlayback`.
  void save(
    String metaId, {
    String? infoHash,
    String? addonId,
    String? url,
    String? title,
    String? parsedTitle,
    String? bingeGroup,
    String? resolution,
    String? source,
    int? season,
    int? episode,
  }) {
    final all = _readAll();
    final key = entryKey(metaId, season: season, episode: episode);
    final prev = all[key];
    final thin = infoHash == null && addonId == null && url == null;
    final now = _nowMs();
    all[key] = (thin && prev != null)
        ? PlaybackEntry(
            infoHash: prev.infoHash,
            addonId: prev.addonId,
            url: prev.url,
            title: title ?? prev.title,
            parsedTitle: parsedTitle ?? prev.parsedTitle,
            bingeGroup: prev.bingeGroup,
            resolution: prev.resolution,
            source: prev.source,
            savedAt: now,
          )
        : PlaybackEntry(
            infoHash: infoHash,
            addonId: addonId,
            url: url,
            title: title,
            parsedTitle: parsedTitle,
            bingeGroup: bingeGroup,
            resolution: resolution,
            source: source,
            savedAt: now,
          );
    _writeAll(all);
  }

  /// The most-recently-played entry for any episode of [metaId] (keys equal to
  /// the id or prefixed `metaId|`), or null — the source to reuse for the next
  /// episode when "keep source" is on. Ports web `readLastSeriesPlayback`.
  PlaybackEntry? readLastSeriesPlayback(String metaId) {
    final prefix = '$metaId|';
    PlaybackEntry? best;
    _readAll().forEach((key, entry) {
      if (key != metaId && !key.startsWith(prefix)) return;
      if (best == null || entry.savedAt > best!.savedAt) best = entry;
    });
    return best;
  }

  /// Every recorded play as a flat `(base metaId, savedAt, titles)` list — one
  /// per stored key, with the `|sSeE` episode suffix stripped from the id.
  /// Ports web `playbackEntries`; feeds the Wrapped year-in-review collector.
  List<({String metaId, int savedAt, String? title, String? parsedTitle})>
  playbackEvents() {
    final out =
        <({String metaId, int savedAt, String? title, String? parsedTitle})>[];
    _readAll().forEach((key, entry) {
      final metaId = key.split('|').first;
      if (metaId.isEmpty) return;
      out.add((
        metaId: metaId,
        savedAt: entry.savedAt,
        title: entry.title,
        parsedTitle: entry.parsedTitle,
      ));
    });
    return out;
  }

  /// The watched set derived from the history — each entry's base id plus the
  /// title-keys of its parsed and raw titles. Ported from `recentlyPlayed`.
  WatchedSet recentlyPlayed() {
    final ids = <String>{};
    final titles = <String>{};
    _readAll().forEach((key, entry) {
      final base = key.split('|').first;
      if (base.isNotEmpty) ids.add(base);
      final parsed = watchTitleKey(entry.parsedTitle);
      if (parsed.isNotEmpty) titles.add(parsed);
      final raw = watchTitleKey(entry.title);
      if (raw.isNotEmpty) titles.add(raw);
    });
    return WatchedSet(ids, titles);
  }
}
