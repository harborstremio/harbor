import 'dart:async';
import 'dart:convert';

import '../../core/http/json_transport.dart';
import '../../core/http/text_transport.dart';
import '../../core/storage/kv_store.dart';
import 'anizip.dart';
import 'kitsu_client.dart';

const _arm = 'https://relations.yuna.moe/api/ids';
const _animeListUrl =
    'https://raw.githubusercontent.com/Anime-Lists/anime-lists/master/anime-list-master.xml';

const _armKitsuKey = 'harbor.armkitsucache';
const _anidbTvdbKey = 'harbor.anidbtvdbcache';
const _extKitsuKey = 'harbor.extkitsucache';
const _armSrcKey = 'harbor.armsrcmalcache';

const _armTtlMs = 30 * 24 * 60 * 60 * 1000;
const _xmlTtlMs = 7 * 24 * 60 * 60 * 1000;

const _sideEntryTypes = {'ova', 'ona', 'special', 'music'};

final _animeTagRe = RegExp(r'<anime\b([^>]*)>');
final _anidbAttrRe = RegExp(r'\banidbid="(\d+)"');
final _tvdbAttrRe = RegExp(r'\btvdbid="([^"]+)"');
final _imdbAttrRe = RegExp(r'\bimdbid="(tt\d+)"');

/// An ARM (relations.yuna.moe) cross-reference for one Kitsu id.
class _ArmKitsuEntry {
  const _ArmKitsuEntry({this.mal, this.anidb, this.anilist, required this.t});

  final int? mal;
  final int? anidb;
  final int? anilist;
  final int t;

  Map<String, dynamic> toJson() => {
    if (mal != null) 'mal': mal,
    if (anidb != null) 'anidb': anidb,
    if (anilist != null) 'anilist': anilist,
    't': t,
  };

  static _ArmKitsuEntry fromJson(Map raw) => _ArmKitsuEntry(
    mal: (raw['mal'] as num?)?.toInt(),
    anidb: (raw['anidb'] as num?)?.toInt(),
    anilist: (raw['anilist'] as num?)?.toInt(),
    t: (raw['t'] as num?)?.toInt() ?? 0,
  );
}

/// The anidb→tvdb and anidb→imdb maps parsed from the Anime-Lists master list.
class _AnidbMaps {
  const _AnidbMaps({required this.tvdb, required this.imdb, required this.t});

  final Map<String, int> tvdb;
  final Map<String, String> imdb;
  final int t;

  Map<String, dynamic> toJson() => {'tvdb': tvdb, 'imdb': imdb, 't': t};
}

/// The keyless anime id cross-reference mapper. Bridges a Kitsu id to TVDB,
/// IMDb, AniList, MAL and AniDB (and IMDb/TMDB back to Kitsu), preferring
/// ani.zip, then the ARM relations service, then the Anime-Lists master list,
/// with persistent (KV-backed) caches. Ported 1:1 from
/// `lib/providers/anime-mapping.ts`.
class AnimeMapper {
  AnimeMapper({
    required JsonTransport json,
    required TextTransport text,
    required KvStore kv,
    required KitsuClient kitsu,
    DateTime Function() clock = DateTime.now,
  }) : _json = json,
       _text = text,
       _kv = kv,
       _kitsu = kitsu,
       _clock = clock;

  final JsonTransport _json;
  final TextTransport _text;
  final KvStore _kv;
  final KitsuClient _kitsu;
  final DateTime Function() _clock;

  final Map<int, Future<_ArmKitsuEntry?>> _inflightArm = {};
  final Map<String, Future<int?>> _inflightExt = {};
  final Map<String, Future<int?>> _inflightArmSrc = {};
  Future<_AnidbMaps>? _xmlInflight;
  Map<String, int>? _imdbAnidbIndex;

  int get _now => _clock().millisecondsSinceEpoch;

  // ── Public cross references ────────────────────────────────────────────────

  Future<int?> kitsuToTvdb(int kitsuId) async {
    final az = await aniZipByKitsu(_json, kitsuId);
    final tvdb = az?.mappings?.thetvdbId;
    if (tvdb != null) return tvdb;
    final anidb = (await _armFromKitsu(kitsuId))?.anidb;
    if (anidb == null) return null;
    final maps = await _loadAnidbMaps();
    return maps.tvdb['$anidb'];
  }

  Future<String?> kitsuToImdb(int kitsuId) async {
    final az = await aniZipByKitsu(_json, kitsuId);
    final imdb = az?.mappings?.imdbId;
    if (imdb != null) return imdb;
    final anidb = (await _armFromKitsu(kitsuId))?.anidb;
    if (anidb == null) return null;
    final maps = await _loadAnidbMaps();
    return maps.imdb['$anidb'];
  }

  Future<int?> kitsuToAnidb(int kitsuId) async =>
      (await _armFromKitsu(kitsuId))?.anidb;

  Future<int?> kitsuToAnilist(int kitsuId) async {
    final anilist = (await _armFromKitsu(kitsuId))?.anilist;
    if (anilist != null) return anilist;
    return (await aniZipByKitsu(_json, kitsuId))?.mappings?.anilistId;
  }

  Future<int?> kitsuToMal(int kitsuId) async {
    final mal = (await _armFromKitsu(kitsuId))?.mal;
    if (mal != null) return mal;
    return (await aniZipByKitsu(_json, kitsuId))?.mappings?.malId;
  }

  Future<int?> anilistToMal(int anilistId) async {
    final viaArm = await _armSourceToMal('anilist', anilistId);
    if (viaArm != null) return viaArm;
    return (await aniZipByAnilist(_json, anilistId))?.mappings?.malId;
  }

  Future<int?> anidbToMal(int anidbId) async {
    final viaArm = await _armSourceToMal('anidb', anidbId);
    if (viaArm != null) return viaArm;
    return (await aniZipByAnidb(_json, anidbId))?.mappings?.malId;
  }

  Future<int?> imdbToKitsu(String imdbId) async {
    if (!imdbId.startsWith('tt')) return null;
    final az = await aniZipByImdb(_json, imdbId);
    final kitsu = az?.mappings?.kitsuId;
    if (kitsu != null) return _preferMainTv(kitsu, az?.mappings?.type);
    final anidb = az?.mappings?.anidbId;
    if (anidb != null) return externalToKitsu('anidb', anidb);
    final maps = await _loadAnidbMaps();
    final index = _imdbAnidbIndex ??= _buildImdbIndex(maps);
    final resolved = index[imdbId];
    if (resolved == null) return null;
    return externalToKitsu('anidb', resolved);
  }

  Future<int?> tmdbTvToKitsu(int tmdbId) async {
    final az = await aniZipByTmdbTv(_json, tmdbId);
    final kitsu = az?.mappings?.kitsuId;
    if (kitsu != null) return _preferMainTv(kitsu, az?.mappings?.type);
    final anidb = az?.mappings?.anidbId;
    if (anidb != null) return externalToKitsu('anidb', anidb);
    return null;
  }

  /// Resolves an external id to a Kitsu id via ARM, caching the result
  /// (including a negative). Ported from `externalToKitsu`.
  Future<int?> externalToKitsu(String source, int id) {
    final key = '$source:$id';
    final cache = _readMap(_extKitsuKey);
    final hit = cache[key];
    if (hit is Map && hit['t'] is num && _now - (hit['t'] as num) < _armTtlMs) {
      return Future.value((hit['kitsu'] as num?)?.toInt());
    }
    final existing = _inflightExt[key];
    if (existing != null) return existing;
    final p = _fetchExternalToKitsu(source, id, key, cache);
    _inflightExt[key] = p;
    return p.whenComplete(() {
      _inflightExt.remove(key);
    });
  }

  // ── ARM lookups ───────────────────────────────────────────────────────────

  Future<_ArmKitsuEntry?> _armFromKitsu(int kitsuId) {
    final cache = _readMap(_armKitsuKey);
    final hit = cache['$kitsuId'];
    if (hit is Map) {
      final entry = _ArmKitsuEntry.fromJson(hit);
      if (_now - entry.t < _armTtlMs) return Future.value(entry);
    }
    final existing = _inflightArm[kitsuId];
    if (existing != null) return existing;
    final p = _fetchArmFromKitsu(kitsuId, cache);
    _inflightArm[kitsuId] = p;
    return p.whenComplete(() {
      _inflightArm.remove(kitsuId);
    });
  }

  Future<_ArmKitsuEntry?> _fetchArmFromKitsu(
    int kitsuId,
    Map<String, dynamic> cache,
  ) async {
    try {
      final r = await _json.getJson('$_arm?source=kitsu&id=$kitsuId');
      if (!r.ok || r.data is! Map) return null;
      final j = r.data as Map;
      final entry = _ArmKitsuEntry(
        mal: (j['mal'] as num?)?.toInt(),
        anidb: (j['anidb'] as num?)?.toInt(),
        anilist: (j['anilist'] as num?)?.toInt(),
        t: _now,
      );
      cache['$kitsuId'] = entry.toJson();
      _writeJson(_armKitsuKey, cache);
      return entry;
    } catch (_) {
      return null;
    }
  }

  Future<int?> _fetchExternalToKitsu(
    String source,
    int id,
    String key,
    Map<String, dynamic> cache,
  ) async {
    try {
      final r = await _json.getJson('$_arm?source=$source&id=$id');
      if (!r.ok || r.data is! Map) return null;
      final kitsu = ((r.data as Map)['kitsu'] as num?)?.toInt();
      cache[key] = {'kitsu': kitsu, 't': _now};
      _writeJson(_extKitsuKey, cache);
      return kitsu;
    } catch (_) {
      return null;
    }
  }

  /// Resolves an AniList/AniDB id to a MAL id via ARM, caching only a positive
  /// result. Ported from `armSourceToMal`.
  Future<int?> _armSourceToMal(String source, int id) {
    final key = '$source:$id';
    final cache = _readMap(_armSrcKey);
    final hit = cache[key];
    if (hit is Map && hit['t'] is num && _now - (hit['t'] as num) < _armTtlMs) {
      return Future.value((hit['mal'] as num?)?.toInt());
    }
    final existing = _inflightArmSrc[key];
    if (existing != null) return existing;
    final p = _fetchArmSourceToMal(source, id, key, cache);
    _inflightArmSrc[key] = p;
    return p.whenComplete(() {
      _inflightArmSrc.remove(key);
    });
  }

  Future<int?> _fetchArmSourceToMal(
    String source,
    int id,
    String key,
    Map<String, dynamic> cache,
  ) async {
    try {
      final r = await _json.getJson('$_arm?source=$source&id=$id');
      if (!r.ok || r.data is! Map) return null;
      final mal = ((r.data as Map)['mal'] as num?)?.toInt();
      if (mal != null) {
        cache[key] = {'mal': mal, 't': _now};
        _writeJson(_armSrcKey, cache);
      }
      return mal;
    } catch (_) {
      return null;
    }
  }

  Future<int> _preferMainTv(int kitsuId, String? type) async {
    if (type != null && _sideEntryTypes.contains(type.toLowerCase())) {
      int? main;
      try {
        main = await _kitsu.kitsuMainTvSeries(kitsuId);
      } catch (_) {
        main = null;
      }
      if (main != null) return main;
    }
    return kitsuId;
  }

  // ── Anime-Lists master list ───────────────────────────────────────────────

  Future<_AnidbMaps> _loadAnidbMaps() {
    final cached = _readCachedAnidbMaps();
    if (cached != null && _now - cached.t < _xmlTtlMs) {
      return Future.value(cached);
    }
    final existing = _xmlInflight;
    if (existing != null) return existing;
    final p = _fetchAnidbMaps(cached);
    _xmlInflight = p;
    return p.whenComplete(() {
      _xmlInflight = null;
    });
  }

  _AnidbMaps? _readCachedAnidbMaps() {
    final raw = _kv.getString(_anidbTvdbKey);
    if (raw == null) return null;
    try {
      final d = jsonDecode(raw);
      if (d is! Map) return null;
      final tvdb = <String, int>{};
      if (d['tvdb'] is Map) {
        (d['tvdb'] as Map).forEach((k, v) {
          if (v is num) tvdb['$k'] = v.toInt();
        });
      }
      final imdb = <String, String>{};
      if (d['imdb'] is Map) {
        (d['imdb'] as Map).forEach((k, v) {
          if (v is String) imdb['$k'] = v;
        });
      }
      return _AnidbMaps(
        tvdb: tvdb,
        imdb: imdb,
        t: (d['t'] as num?)?.toInt() ?? 0,
      );
    } catch (_) {
      return null;
    }
  }

  Future<_AnidbMaps> _fetchAnidbMaps(_AnidbMaps? cached) async {
    final fallback = cached ?? const _AnidbMaps(tvdb: {}, imdb: {}, t: 0);
    try {
      final r = await _text.getText(_animeListUrl);
      if (!r.ok) return fallback;
      final tvdb = <String, int>{};
      final imdb = <String, String>{};
      for (final tag in _animeTagRe.allMatches(r.body)) {
        final attrs = tag.group(1) ?? '';
        final anidbMatch = _anidbAttrRe.firstMatch(attrs);
        if (anidbMatch == null) continue;
        final anidbId = anidbMatch.group(1)!;
        final tvdbMatch = _tvdbAttrRe.firstMatch(attrs);
        if (tvdbMatch != null) {
          final tv = tvdbMatch.group(1)!;
          if (tv.isNotEmpty &&
              tv != 'unknown' &&
              tv != 'movie' &&
              tv != 'tba' &&
              tv != 'hentai') {
            final tvdbId = int.tryParse(tv);
            if (tvdbId != null && !tvdb.containsKey(anidbId)) {
              tvdb[anidbId] = tvdbId;
            }
          }
        }
        final imdbMatch = _imdbAttrRe.firstMatch(attrs);
        if (imdbMatch != null && !imdb.containsKey(anidbId)) {
          imdb[anidbId] = imdbMatch.group(1)!;
        }
      }
      final out = _AnidbMaps(tvdb: tvdb, imdb: imdb, t: _now);
      _writeJson(_anidbTvdbKey, out.toJson());
      return out;
    } catch (_) {
      return fallback;
    }
  }

  Map<String, int> _buildImdbIndex(_AnidbMaps maps) {
    final idx = <String, int>{};
    maps.imdb.forEach((anidb, imdb) {
      final n = int.tryParse(anidb);
      if (n != null && !idx.containsKey(imdb)) idx[imdb] = n;
    });
    return idx;
  }

  // ── KV cache helpers ──────────────────────────────────────────────────────

  Map<String, dynamic> _readMap(String key) {
    final raw = _kv.getString(key);
    if (raw == null) return {};
    try {
      final d = jsonDecode(raw);
      return d is Map ? d.cast<String, dynamic>() : {};
    } catch (_) {
      return {};
    }
  }

  void _writeJson(String key, Object value) {
    try {
      unawaited(_kv.setString(key, jsonEncode(value)));
    } catch (_) {}
  }
}
