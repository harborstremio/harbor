import '../text/deburr.dart';

/// Adult-content detection, ported 1:1 from `addons-store/adult-filter.ts`.
/// Two term lists — substring matches (compact, alpha-only) and whole-word
/// matches (token-bounded) — over a leet-normalized, accent-folded form of the
/// candidate text. Used to purge adult addons/metas when the setting hides them.

/// Matched as a bare substring of the compacted (digit- and space-stripped)
/// text. Transcribed verbatim from `SUBSTRING_TERMS`.
const _substringTerms = [
  'porn',
  'pornhub',
  'pornography',
  'porno',
  'porntv',
  'xhamster',
  'xnxx',
  'xvideos',
  'redtube',
  'youporn',
  'spankbang',
  'brazzers',
  'naughtyamerica',
  'bangbros',
  'realitykings',
  'evilangel',
  'digitalplayground',
  'fakehub',
  'playboy',
  'penthouse',
  'hustler',
  'rule34',
  'rule35',
  'hentai',
  'ahegao',
  'doujin',
  'doujinshi',
  'ecchi',
  'futanari',
  'futa',
  'yiff',
  'lewd',
  'smut',
  'fapping',
  'milf',
  'gilf',
  'dilf',
  'shemale',
  'ladyboy',
  'tranny',
  'femdom',
  'dominatrix',
  'bondage',
  'bdsm',
  'fetish',
  'fetlife',
  'kink',
  'kinky',
  'raunchy',
  'vulgar',
  'obscene',
  'softcore',
  'hardcore',
  'uncensored',
  'explicit',
  'chaturbate',
  'myfreecams',
  'stripchat',
  'bongacams',
  'livejasmin',
  'camsoda',
  'flirt4free',
  'camgirl',
  'camgirls',
  'camboy',
  'camboys',
  'camshow',
  'camshows',
  'webcamshow',
  'webcamshows',
  'onlyfans',
  'fansly',
  'manyvids',
  'clips4sale',
  'iwantclips',
  'modelhub',
  'incall',
  'outcall',
  'blowjob',
  'handjob',
  'footjob',
  'cumshot',
  'creampie',
  'cumming',
  'ejaculation',
  'ejaculate',
  'stripper',
  'stripping',
  'striptease',
  'lapdance',
  'lustful',
  'horny',
  'javhd',
  'thicc',
  'boobs',
  'boobies',
  'titties',
  'nipples',
  'asshole',
  'buttplug',
  'dildo',
  'vibrator',
  'deepthroat',
  'gangbang',
  'threesome',
  'foursome',
  'orgy',
  'orgies',
  'rimjob',
  'scat',
  'watersports',
  'incest',
  'stepmom',
  'stepsis',
  'stepbro',
  'barelylegal',
  'teenporn',
  'milfporn',
  'amateurporn',
];

/// Matched only as a whole token (space-bounded). Broad tokens like `ass` or
/// `sex` live here so they don't false-positive inside longer words.
/// Transcribed verbatim from `WORD_TERMS`.
const _wordTerms = [
  'xxx',
  'nsfw',
  'sex',
  'sexy',
  'sexual',
  'erotic',
  'erotica',
  'nude',
  'nudes',
  'nudity',
  'naked',
  'topless',
  'ass',
  'anal',
  'anus',
  'tit',
  'tits',
  'boob',
  'cum',
  'cums',
  'jizz',
  'fuck',
  'fucker',
  'fucking',
  'fucked',
  'pussy',
  'pussies',
  'vagina',
  'vulva',
  'clit',
  'clitoris',
  'dick',
  'cock',
  'cocks',
  'penis',
  'balls',
  'fap',
  'wank',
  'jerk',
  'jerkoff',
  'stroke',
  'edging',
  'milf',
  'horny',
  'kinky',
  'lewd',
  'smut',
  'jav',
  'escort',
  'escorts',
  'slut',
  'sluts',
  'whore',
  'whores',
  'bitch',
  'bitches',
];

const _leetMap = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  r'$': 's',
  '!': 'i',
};

final _nonAlpha = RegExp('[^a-z]+');
final _nonAlnum = RegExp('[^a-z0-9]+');
final _wordTermsRx = RegExp(
  '(?:^| )(?:${_wordTerms.join('|')})(?:\$| )',
  caseSensitive: false,
);

String _applyLeet(String s) {
  final sb = StringBuffer();
  for (final c in s.split('')) {
    sb.write(_leetMap[c] ?? c);
  }
  return sb.toString();
}

/// Accent-fold + leet-map, then strip to `[a-z]` only — the compact form the
/// substring terms match against. Ported from `normalize`.
String _normalize(String s) {
  if (s.isEmpty) return '';
  return _applyLeet(deburr(s.toLowerCase())).replaceAll(_nonAlpha, '');
}

/// Accent-fold + leet-map, then collapse non-alphanumerics to single spaces and
/// wrap in spaces — the tokenized form the word terms match against. Ported from
/// `lowerTokens`.
String _lowerTokens(String s) {
  if (s.isEmpty) return '';
  final out = _applyLeet(
    deburr(s.toLowerCase()),
  ).replaceAll(_nonAlnum, ' ').trim();
  return ' $out ';
}

/// True when any of [fields] contains an adult substring or whole-word term.
/// Ported 1:1 from `isAdultText`.
bool isAdultText(Iterable<String?> fields) {
  final list = fields.toList();
  final normalized = list.map((f) => _normalize(f ?? '')).join(' ');
  for (final term in _substringTerms) {
    if (normalized.contains(term)) return true;
  }
  final tokens = list.map((f) => _lowerTokens(f ?? '')).join();
  if (tokens.isNotEmpty && _wordTermsRx.hasMatch(tokens)) return true;
  return false;
}

const _adultAnimeGenres = {'hentai', 'erotica'};

/// True for adult anime — an adult genre tag, or an adult name. Ported from
/// `isAdultAnime`.
bool isAdultAnime(List<String> genres, String? name) {
  for (final g in genres) {
    if (_adultAnimeGenres.contains(g.toLowerCase())) return true;
  }
  return isAdultText([name]);
}

/// Whether adult content should be hidden, ported from `adultContentHidden`.
/// Hidden by default; only shown when `settings.hideContent.adult == false`.
/// Takes the settings map so this stays pure (the provider layer supplies it).
bool adultContentHidden(Map<String, dynamic>? settings) {
  final hide = settings?['hideContent'];
  if (hide is Map) return hide['adult'] != false;
  return true;
}
