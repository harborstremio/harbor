import '../text/deburr.dart';
import 'parsed_stream.dart';
import 'parser/stream_enums.dart';

// The stream trust filter, ported 1:1 from `src/lib/streams/trust.ts`. It
// rejects streams that are not what they claim: dead/placeholder entries,
// trailers/extras, executable payloads, uncached stubs, size-floor violations,
// cinema-window fakes, title/year/season/episode mismatches, and high scam
// scores. `Date.now()`/`new Date()` become an injected [clock] so the
// window/age logic is deterministic under test.

/// Inputs that condition the filter: the expected content identity plus the
/// user's filter strictness. Mirrors the web `TrustOptions` (only the fields the
/// filter actually reads are modelled).
class TrustOptions {
  const TrustOptions({
    this.kind,
    this.expectedTitle,
    this.expectedYear,
    this.expectedSeason,
    this.expectedEpisode,
    this.releaseDate,
    this.strict = true,
    this.disabled = false,
    this.allowCam = false,
    this.isAnime = false,
  });

  /// `'movie'`, `'series'`, or null (unknown).
  final String? kind;
  final String? expectedTitle;
  final int? expectedYear;
  final int? expectedSeason;
  final int? expectedEpisode;
  final String? releaseDate;
  final bool strict;
  final bool disabled;
  final bool allowCam;
  final bool isAnime;
}

/// A rejected stream and the machine-readable reason it failed.
class TrustRejection {
  const TrustRejection(this.stream, this.reason);
  final ParsedStream stream;
  final String reason;
}

/// The partition of a stream list into kept and rejected.
class TrustResult {
  const TrustResult(this.keep, this.rejected);
  final List<ParsedStream> keep;
  final List<TrustRejection> rejected;
}

const List<String> _filenameBlacklist = [
  '.exe',
  '.zip',
  '.rar',
  '.lnk',
  '.scr',
  '.bat',
  '.iso',
  '.img',
];

final RegExp _trailerRx = RegExp(
  r'(?<![A-Za-z0-9])(?:trailer|teaser|tlr|trl|tra(?:iler)?|sneak[\s.\-_]?peek|preview|behind[\s.\-_]?the[\s.\-_]?scenes|featurette|making[\s.\-_]?of|deleted[\s.\-_]?scene|bloopers?|gag[\s.\-_]?reel|extras?|promo)(?![A-Za-z0-9])',
  caseSensitive: false,
);

final RegExp _uncachedEmojiRx = RegExp(
  '[⬇⏳⌛⏬\u{1F53D}\u{1F4E5}☁]',
  unicode: true,
);

final RegExp _placeholderBannerRx = RegExp(
  '(?:\u{1F6AB}|⚠️?|❗|ℹ️?)\\s*(?:no\\s+streams?\\s+(?:found|available)|streams?\\s+filtered|streams?\\s+blocked|filtered)',
  caseSensitive: false,
  unicode: true,
);

final RegExp _statusLineRx = RegExp(
  r'\b(?:expires?\s+in|days?\s+left|premium\s+(?:active|expir(?:ed|ing))|api\s+limit|quota\s+used)\b',
  caseSensitive: false,
);

final RegExp _videoExtRx = RegExp(
  r'\.(mkv|mp4|m4v|avi|webm|mov|ts)(?:\?|$)',
  caseSensitive: false,
);

final RegExp _shortFormatRx = RegExp(
  r'\b(short|shorts|mini|mini[\s.\-_]?episode|ova|special|specials|skit|sketch|chibi|micro|webisode|vignette|interlude)\b',
  caseSensitive: false,
);

const int _tinyStubFloor = 5 * 1024 * 1024;
const int _mib = 1024 * 1024;
const int _gib = 1024 * 1024 * 1024;

final Map<StreamResolution, List<int>> _movieMinSize = {
  StreamResolution.uhd: [
    (2.5 * _gib).round(),
    (1.5 * _gib).round(),
    600 * _mib,
  ],
  StreamResolution.p1080: [(1.2 * _gib).round(), 700 * _mib, 250 * _mib],
  StreamResolution.p720: [600 * _mib, 400 * _mib, 120 * _mib],
  StreamResolution.p480: [250 * _mib, 150 * _mib, 50 * _mib],
  StreamResolution.sd: [200 * _mib, 100 * _mib, 25 * _mib],
};

final Map<StreamResolution, List<int>> _episodeMinSize = {
  StreamResolution.uhd: [(1.0 * _gib).round(), 600 * _mib, 200 * _mib],
  StreamResolution.p1080: [400 * _mib, 250 * _mib, 100 * _mib],
  StreamResolution.p720: [200 * _mib, 120 * _mib, 40 * _mib],
  StreamResolution.p480: [80 * _mib, 50 * _mib, 12 * _mib],
  StreamResolution.sd: [50 * _mib, 30 * _mib, 8 * _mib],
};

final Map<StreamResolution, List<int>> _animeEpisodeMinSize = {
  StreamResolution.uhd: [600 * _mib, 400 * _mib, 150 * _mib],
  StreamResolution.p1080: [220 * _mib, 150 * _mib, 50 * _mib],
  StreamResolution.p720: [100 * _mib, 60 * _mib, 20 * _mib],
  StreamResolution.p480: [40 * _mib, 28 * _mib, 8 * _mib],
  StreamResolution.sd: [25 * _mib, 18 * _mib, 5 * _mib],
};

/// Partitions [streams] into kept and rejected per [opts]. When
/// [TrustOptions.disabled] is set, everything is kept. [clock] defaults to
/// [DateTime.now].
TrustResult applyTrust(
  List<ParsedStream> streams,
  TrustOptions opts, {
  DateTime Function()? clock,
}) {
  if (opts.disabled) {
    return TrustResult(List<ParsedStream>.of(streams), const []);
  }
  final now = (clock ?? DateTime.now)();
  final keep = <ParsedStream>[];
  final rejected = <TrustRejection>[];
  final inCinemaWindow = _isInCinemaWindow(opts.releaseDate, now);
  final olderCatalog = _isOlderCatalog(
    opts.releaseDate,
    opts.expectedYear,
    now,
  );
  final strict = opts.strict;
  for (final s in streams) {
    final reason = _checkOne(
      s,
      opts,
      strict,
      inCinemaWindow,
      olderCatalog,
      now,
    );
    if (reason != null) {
      rejected.add(TrustRejection(s, reason));
    } else {
      keep.add(s);
    }
  }
  return TrustResult(keep, rejected);
}

bool _isShortFormat(ParsedStream s) {
  final filenameRaw = s.stream.filename ?? '';
  final haystack =
      '$filenameRaw ${s.stream.title ?? ''} ${s.stream.name ?? ''}';
  return _shortFormatRx.hasMatch(haystack);
}

int _pickFloor(
  Map<StreamResolution, List<int>> table,
  StreamResolution resolution,
  bool inCinemaWindow,
  bool olderCatalog,
) {
  final row = table[resolution] ?? table[StreamResolution.sd]!;
  final cinema = row[0];
  final normal = row[1];
  final older = row[2];
  if (olderCatalog) return older;
  if (inCinemaWindow) return cinema;
  return normal;
}

String? _checkOne(
  ParsedStream s,
  TrustOptions opts,
  bool strict,
  bool inCinemaWindow,
  bool olderCatalog,
  DateTime now,
) {
  final st = s.stream;
  final hasPlayableUrl =
      (st.url != null && st.url!.isNotEmpty) ||
      (st.infoHash != null && st.infoHash!.isNotEmpty) ||
      (st.ytId != null && st.ytId!.isNotEmpty) ||
      (st.externalUrl != null && st.externalUrl!.isNotEmpty) ||
      (st.nzbUrl != null && st.nzbUrl!.isNotEmpty);
  final titleNameDesc =
      '${st.title ?? ''} ${st.name ?? ''} ${st.description ?? ''}';
  if (!hasPlayableUrl) {
    return 'no-playable-source';
  }
  if (_placeholderBannerRx.hasMatch(titleNameDesc)) {
    return 'addon-placeholder-banner';
  }
  final urlLooksVideo = st.url != null && _videoExtRx.hasMatch(st.url!);
  if ((st.infoHash == null || st.infoHash!.isEmpty) && !urlLooksVideo) {
    final noSize = (st.videoSize ?? 0) == 0;
    final noFilename = (st.filename ?? '').isEmpty;
    if (_statusLineRx.hasMatch(titleNameDesc) && noSize && noFilename) {
      return 'addon-status-card';
    }
  }

  final filename = (st.filename ?? '').toLowerCase();
  final haystack = '$filename ${st.title ?? ''} ${st.name ?? ''}'.toLowerCase();
  for (final ext in _filenameBlacklist) {
    if (filename.endsWith(ext)) return 'suspicious-extension:$ext';
  }

  if (_trailerRx.hasMatch(haystack)) {
    return 'trailer-or-extra';
  }

  if (_uncachedEmojiRx.hasMatch(titleNameDesc)) {
    return 'addon-uncached-emoji';
  }

  final size = s.size;
  if (size != null && size < _tinyStubFloor) {
    return 'size-stub';
  }

  if (opts.kind == 'movie' && size != null) {
    final floor = _pickFloor(
      _movieMinSize,
      s.resolution,
      inCinemaWindow,
      olderCatalog,
    );
    if (size < floor) return 'movie-stub-too-small-for-${s.resolution.label}';
  }

  if (opts.kind == 'movie' &&
      size != null &&
      inCinemaWindow &&
      s.source != StreamSource.cam &&
      s.source != StreamSource.ts &&
      s.source != StreamSource.hdts &&
      s.source != StreamSource.tc) {
    final sizeMB = size / _mib;
    if (sizeMB < 250) return 'new-release-virus-${sizeMB.round()}mb';
    if (sizeMB < 500 && !_isShortFormat(s)) {
      return 'new-release-stub-${sizeMB.round()}mb';
    }
  }

  if (opts.kind == 'movie' && !opts.isAnime) {
    if (s.seasonPack || s.season != null || s.episode != null) {
      return 'series-result-for-movie';
    }
  }

  if (strict &&
      opts.kind == 'movie' &&
      !opts.isAnime &&
      inCinemaWindow &&
      opts.expectedYear != null &&
      s.year == null &&
      s.source == StreamSource.other &&
      s.resolution == StreamResolution.sd) {
    return 'cinema-bare-untagged';
  }

  if (strict &&
      opts.kind == 'movie' &&
      (opts.expectedTitle != null && opts.expectedTitle!.isNotEmpty) &&
      s.parsedTitle.isNotEmpty) {
    if (!_titleMatches(
      opts.expectedTitle!,
      s.parsedTitle,
      s.year,
      opts.expectedYear,
      now,
    )) {
      return 'title-mismatch';
    }
  }

  if (strict &&
      opts.kind == 'movie' &&
      inCinemaWindow &&
      opts.expectedYear != null &&
      s.year != null &&
      s.year != opts.expectedYear) {
    return 'cinema-year-mismatch:${s.year}-vs-${opts.expectedYear}';
  }

  if (strict &&
      opts.kind == 'movie' &&
      (opts.expectedTitle != null && opts.expectedTitle!.isNotEmpty)) {
    final expectedSeq = _sequelMarker(opts.expectedTitle!);
    if (expectedSeq != null && expectedSeq >= 2) {
      final fn = st.filename ?? '';
      final hs = '$fn ${st.title ?? ''}'.toLowerCase();
      if (!_haystackHasSequelToken(hs, expectedSeq)) {
        return 'filename-missing-sequel';
      }
    }
  }

  if (strict && opts.kind == 'movie' && inCinemaWindow) {
    if (s.source == StreamSource.bluRay || s.remux) {
      return 'fresh-cinema-fake-bluray';
    }
    if (s.resolution == StreamResolution.uhd &&
        (s.source == StreamSource.webDl ||
            s.source == StreamSource.webRip ||
            s.source == StreamSource.bdRip ||
            s.source == StreamSource.hdRip)) {
      return 'fresh-cinema-fake-4k-web';
    }
    if (s.source == StreamSource.hdtv &&
        (s.resolution == StreamResolution.uhd ||
            s.resolution == StreamResolution.p1080)) {
      return 'fresh-cinema-fake-hdtv';
    }
  }

  if (opts.kind == 'series' && size != null && !_isShortFormat(s)) {
    final table = opts.isAnime ? _animeEpisodeMinSize : _episodeMinSize;
    final floor = _pickFloor(table, s.resolution, inCinemaWindow, olderCatalog);
    if (size < floor) {
      return 'episode-stub-too-small-for-${s.resolution.label}';
    }
  }

  if (strict &&
      opts.kind == 'series' &&
      !opts.isAnime &&
      (opts.expectedTitle != null && opts.expectedTitle!.isNotEmpty) &&
      s.parsedTitle.isNotEmpty) {
    if (!_titleMatches(
      opts.expectedTitle!,
      s.parsedTitle,
      s.year,
      opts.expectedYear,
      now,
    )) {
      return 'title-mismatch';
    }
  }

  final hasFileIdx = st.fileIdx != null;

  if (strict &&
      !opts.isAnime &&
      !hasFileIdx &&
      opts.expectedSeason != null &&
      s.season != null &&
      s.season != opts.expectedSeason &&
      !s.seasonPack) {
    return 'season-mismatch:${s.season}-vs-${opts.expectedSeason}';
  }

  if (strict &&
      !opts.isAnime &&
      !hasFileIdx &&
      !s.seasonPack &&
      opts.expectedEpisode != null &&
      s.episode != null &&
      s.episode != opts.expectedEpisode) {
    return 'episode-mismatch:${s.episode}-vs-${opts.expectedEpisode}';
  }

  if (s.scamScore >= 5 && !opts.allowCam && !olderCatalog) {
    return 'scam-score-${s.scamScore}';
  }

  return null;
}

const Map<String, int> _romanToNum = {
  'ii': 2,
  'iii': 3,
  'iv': 4,
  'v': 5,
  'vi': 6,
  'vii': 7,
  'viii': 8,
  'ix': 9,
  'x': 10,
};

const Map<int, String> _numToRoman = {
  2: 'ii',
  3: 'iii',
  4: 'iv',
  5: 'v',
  6: 'vi',
  7: 'vii',
  8: 'viii',
  9: 'ix',
  10: 'x',
};

const Map<int, String> _numToWord = {
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten',
};

const Set<String> _titleStopwords = {
  'the',
  'a',
  'an',
  'of',
  'and',
  'in',
  'to',
  'for',
  'on',
  'at',
  'by',
  'is',
  'or',
  'as',
  'from',
  'with',
  'into',
  'movie',
  'film',
};

final RegExp _wordRx = RegExp(r'[a-z0-9]+');

List<String> _tokenize(String text) {
  final lower = deburr(text.toLowerCase());
  return _wordRx
      .allMatches(lower)
      .map((m) => m[0]!)
      .where((w) => w.length >= 3 && !_titleStopwords.contains(w))
      .toList();
}

int _countOverlap(List<String> words, Set<String> lookup) {
  var hits = 0;
  for (final w in words) {
    if (lookup.contains(w)) {
      hits++;
      continue;
    }
    for (final l in lookup) {
      if (w.length >= 4 &&
          l.length >= 4 &&
          (w.startsWith(l) || l.startsWith(w))) {
        hits++;
        break;
      }
    }
  }
  return hits;
}

bool _titleMatches(
  String expected,
  String parsed,
  int? parsedYear,
  int? expectedYear,
  DateTime now,
) {
  final expectedSeq = _sequelMarker(expected);
  final parsedSeq = _sequelMarker(parsed);
  final yearTolerance = _yearToleranceFor(expectedYear, now);
  if (expectedSeq != null && parsedSeq != null && parsedSeq != expectedSeq) {
    return false;
  }
  if (expectedSeq != null && parsedSeq == null) {
    if (parsedYear == null || expectedYear == null) return false;
    if ((parsedYear - expectedYear).abs() > yearTolerance) return false;
  }
  if (expectedSeq == null && parsedSeq != null && parsedSeq >= 2) {
    if (parsedYear == null || expectedYear == null) return false;
    if ((parsedYear - expectedYear).abs() > yearTolerance) return false;
  }
  final expectedTokens = _tokenize(expected);
  final parsedTokens = _tokenize(parsed);
  if (expectedTokens.isEmpty || parsedTokens.isEmpty) return true;
  final expectedSet = expectedTokens.toSet();
  final parsedSet = parsedTokens.toSet();
  final overlap = _countOverlap(expectedTokens, parsedSet);
  final reverseOverlap = _countOverlap(parsedTokens, expectedSet);
  final expectedRatio = overlap / expectedTokens.length;
  final parsedRatio = reverseOverlap / parsedTokens.length;
  // Short-title guard: a 1-2 token expected title ("Obsession") that overlaps a
  // long parsed name with 3+ extra tokens is a false match — reject it.
  if (expectedTokens.length <= 2 && parsedTokens.length - overlap > 2) {
    return false;
  }
  return expectedRatio >= 0.5 || parsedRatio >= 0.5 || overlap >= 2;
}

int _yearToleranceFor(int? expectedYear, DateTime now) {
  if (expectedYear == null) return 1;
  final age = now.year - expectedYear;
  if (age >= 30) return 4;
  if (age >= 15) return 3;
  if (age >= 5) return 2;
  return 1;
}

final RegExp _yearParenRx = RegExp(r'\(\d{4}\)');
final RegExp _partWordRx = RegExp(
  r'\b(part|chapter|vol|volume)\b',
  caseSensitive: false,
);
final RegExp _sequelTailRx = RegExp(
  r'(?:\s|^)(\d{1,2}|[ivx]+)\s*$',
  caseSensitive: false,
);
final RegExp _digitsRx = RegExp(r'^\d+$');

int? _sequelMarker(String title) {
  final cleaned = title
      .replaceAll(_yearParenRx, '')
      .replaceAll(_partWordRx, '');
  final m = _sequelTailRx.firstMatch(cleaned.trim());
  if (m == null) return null;
  final tok = m[1]!.toLowerCase();
  if (_digitsRx.hasMatch(tok)) {
    final n = int.parse(tok);
    if (n >= 2 && n <= 20) return n;
    return null;
  }
  return _romanToNum[tok];
}

bool _haystackHasSequelToken(String haystack, int expectedSeq) {
  final tokens = _wordRx.allMatches(haystack).map((m) => m[0]!.toLowerCase());
  final digit = expectedSeq.toString();
  final roman = _numToRoman[expectedSeq];
  final word = _numToWord[expectedSeq];
  for (final tok in tokens) {
    if (tok == digit) return true;
    if (roman != null && tok == roman) return true;
    if (word != null && tok == word) return true;
  }
  return false;
}

bool _isInCinemaWindow(String? releaseDate, DateTime now) {
  if (releaseDate == null || releaseDate.isEmpty) return false;
  final d = DateTime.tryParse(releaseDate);
  if (d == null) return false;
  final days = now.difference(d).inMilliseconds / 86400000;
  return days > -90 && days < 60;
}

bool _isOlderCatalog(String? releaseDate, int? expectedYear, DateTime now) {
  if (releaseDate != null && releaseDate.isNotEmpty) {
    final d = DateTime.tryParse(releaseDate);
    if (d != null) {
      final days = now.difference(d).inMilliseconds / 86400000;
      return days > 365 * 2;
    }
  }
  if (expectedYear != null) return now.year - expectedYear > 2;
  return false;
}
