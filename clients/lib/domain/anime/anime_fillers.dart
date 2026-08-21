import 'dart:async';
import 'dart:convert';

import '../../core/http/json_transport.dart';
import '../../core/http/text_transport.dart';
import '../../core/storage/kv_store.dart';

const _cacheKey = 'harbor.animefillercache.v2';
const _ttlMs = 14 * 24 * 60 * 60 * 1000;
const _negTtlMs = 24 * 60 * 60 * 1000;
const _afl = 'https://www.animefillerlist.com/shows';
const _jikan = 'https://api.jikan.moe/v4';
const _ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Harbor';

final _fillerRe = RegExp(
  r'<div class="filler"><span class="Label">Filler Episodes:</span>'
  r'<span class="Episodes">([\s\S]*?)</span>',
);
final _tagRe = RegExp(r'<[^>]+>');
final _stripPunctRe = RegExp("['’.:,!?]");
final _nonAlnumRe = RegExp(r'[^a-z0-9]+');
final _trimDashRe = RegExp(r'^-+|-+$');

/// Expands filler tokens like `"12"` and `"20-24"` into the set of episode
/// numbers they cover. Ported from `expandRanges`.
Set<int> _expandRanges(List<String> tokens) {
  final out = <int>{};
  for (final tk in tokens) {
    final range = tk.split('-');
    if (range.length == 2) {
      final a = num.tryParse(range[0].trim());
      final b = num.tryParse(range[1].trim());
      if (a != null && a.isFinite && b != null && b.isFinite) {
        for (var n = a.toInt(); n <= b.toInt(); n++) {
          if (n > 0) out.add(n);
        }
      }
    } else {
      final v = num.tryParse(tk.trim());
      if (v != null && v.isFinite && v > 0) out.add(v.toInt());
    }
  }
  return out;
}

/// Pulls the filler episode numbers out of an animefillerlist.com show page.
/// Ported from `extractFiller`.
Set<int> _extractFiller(String html) {
  final m = _fillerRe.firstMatch(html);
  if (m == null) return {};
  final text = m.group(1)!.replaceAll(_tagRe, '').replaceAll('&nbsp;', ' ');
  final tokens = [
    for (final s in text.split(','))
      if (s.trim().isNotEmpty) s.trim(),
  ];
  return _expandRanges(tokens);
}

/// Slugifies a title the way animefillerlist.com does. Ported from `slugify`.
String _slugify(String title) => title
    .toLowerCase()
    .replaceAll(_stripPunctRe, '')
    .replaceAll(_nonAlnumRe, '-')
    .replaceAll(_trimDashRe, '');

/// The ordered, de-duplicated slug candidates to try (year, then `-tv`, then
/// bare), capped at 12. Ported from `slugCandidates`.
List<String> _slugCandidates(List<String> titles, int? year) {
  final out = <String>[];
  final seen = <String>{};
  void push(String s) {
    if (s.isNotEmpty && seen.add(s)) out.add(s);
  }

  for (final title in titles) {
    final base = _slugify(title);
    if (base.isEmpty) continue;
    if (year != null) push('$base-$year');
    push('$base-tv');
    push(base);
  }
  return out.take(12).toList();
}

/// Resolves the filler episodes for a MyAnimeList id by scraping
/// animefillerlist.com, using MAL titles to guess the show slug. Ported 1:1
/// from `anime-fillers.ts`. Results are cached per MAL id — 14 days for a hit,
/// one day for a miss — with in-flight de-duplication.
class AnimeFillers {
  AnimeFillers({
    required JsonTransport json,
    required TextTransport text,
    required KvStore kv,
    DateTime Function() clock = DateTime.now,
  }) : _json = json,
       _text = text,
       _kv = kv,
       _clock = clock;

  final JsonTransport _json;
  final TextTransport _text;
  final KvStore _kv;
  final DateTime Function() _clock;

  final Map<int, Future<Set<int>>> _inflight = {};

  int get _now => _clock().millisecondsSinceEpoch;

  Future<Set<int>> fillerEpisodes(int? malId) async {
    if (malId == null || malId == 0) return {};
    final cache = _readCache();
    final hit = cache['$malId'];
    if (hit is Map) {
      final t = (hit['t'] as num?)?.toInt() ?? 0;
      final ok = hit['ok'] == true;
      if (_now - t < (ok ? _ttlMs : _negTtlMs)) {
        return _fillersFrom(hit['fillers']);
      }
    }
    final existing = _inflight[malId];
    if (existing != null) return {...await existing};
    final p = _fetch(malId);
    _inflight[malId] = p;
    // Statement body, not an arrow — an arrow would return the removed future
    // and have it await itself.
    return {
      ...await p.whenComplete(() {
        _inflight.remove(malId);
      }),
    };
  }

  Future<Set<int>> _fetch(int malId) async {
    var ok = false;
    var fillers = <int>{};
    try {
      final info = await _malInfo(malId);
      for (final slug in _slugCandidates(info.titles, info.year)) {
        final html = await _fetchShow(slug);
        if (html != null) {
          ok = true;
          fillers = _extractFiller(html);
          break;
        }
      }
    } catch (_) {
      // Leave the result empty; the miss is cached with the short TTL below.
    }
    final next = _readCache();
    next['$malId'] = {'fillers': fillers.toList(), 't': _now, 'ok': ok};
    _writeCache(next);
    return fillers;
  }

  Future<({List<String> titles, int? year})> _malInfo(int malId) async {
    try {
      final r = await _json
          .getJson('$_jikan/anime/$malId')
          .timeout(const Duration(seconds: 8));
      if (!r.ok || r.data is! Map) {
        return (titles: const <String>[], year: null);
      }
      final d = (r.data as Map)['data'];
      if (d is! Map) return (titles: const <String>[], year: null);
      final titles = <String>[];
      if (d['title_english'] is String) {
        titles.add(d['title_english'] as String);
      }
      if (d['title'] is String) titles.add(d['title'] as String);
      final ts = d['titles'];
      if (ts is List) {
        for (final x in ts) {
          if (x is Map && x['title'] is String) {
            titles.add(x['title'] as String);
          }
        }
      }
      var year = (d['year'] as num?)?.toInt();
      if (year == null) {
        final from = (d['aired'] as Map?)?['from'];
        if (from is String && from.length >= 4) {
          year = int.tryParse(from.substring(0, 4));
        }
      }
      return (titles: titles, year: (year != null && year != 0) ? year : null);
    } catch (_) {
      return (titles: const <String>[], year: null);
    }
  }

  Future<String?> _fetchShow(String slug) async {
    try {
      final r = await _text.getText(
        '$_afl/$slug',
        headers: const {'User-Agent': _ua},
      );
      if (!r.ok) return null;
      return r.body;
    } catch (_) {
      return null;
    }
  }

  Set<int> _fillersFrom(Object? raw) {
    if (raw is! List) return {};
    return {
      for (final v in raw)
        if (v is num) v.toInt(),
    };
  }

  Map<String, dynamic> _readCache() {
    final raw = _kv.getString(_cacheKey);
    if (raw == null) return {};
    try {
      final d = jsonDecode(raw);
      return d is Map ? d.cast<String, dynamic>() : {};
    } catch (_) {
      return {};
    }
  }

  void _writeCache(Map<String, dynamic> cache) {
    try {
      unawaited(_kv.setString(_cacheKey, jsonEncode(cache)));
    } catch (_) {}
  }
}
