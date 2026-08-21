/// Per-debrid cache-state detection from a stream's display text, ported 1:1
/// from `src/lib/streams/parser/parser-cache-flags.ts`. Different addons signal
/// "cached on a service" vs "needs download" with wildly different markers
/// (bracket tags, emoji, template phrases, binge-group hints); this normalizes
/// them all to a `{ slug: true|false }` map, where an explicit "uncached" mark
/// denies a later "cached" mark for that same debrid service.
library;

import 'stream_enums.dart';

final RegExp _rdCache = RegExp(r'\[RD[+⚡]\]', caseSensitive: false);
final RegExp _tbCache = RegExp(r'\[TB[+⚡]\]', caseSensitive: false);
final RegExp _adCache = RegExp(r'\[AD[+⚡]\]', caseSensitive: false);
final RegExp _pmCache = RegExp(r'\[PM[+⚡]\]', caseSensitive: false);
final RegExp _dlCache = RegExp(r'\[DL[+⚡]\]', caseSensitive: false);
final RegExp _rdUncached = RegExp(
  r'\[RD(?:[\s\-]?download|⬇️?|⏳)\]',
  caseSensitive: false,
);
final RegExp _tbUncached = RegExp(
  r'\[TB(?:[\s\-]?download|⬇️?|⏳)\]',
  caseSensitive: false,
);
final RegExp _adUncached = RegExp(
  r'\[AD(?:[\s\-]?download|⬇️?|⏳)\]',
  caseSensitive: false,
);
final RegExp _pmUncached = RegExp(
  r'\[PM(?:[\s\-]?download|⬇️?|⏳)\]',
  caseSensitive: false,
);
final RegExp _dlUncached = RegExp(
  r'\[DL(?:[\s\-]?download|⬇️?|⏳)\]',
  caseSensitive: false,
);
final RegExp _jackettioBareUncached = RegExp(
  r'\[(RD|TB|AD|PM|DL|OC|ED|Putio)\]\s+(?:Jackettio|jackettio)\b',
  caseSensitive: false,
);
final RegExp _streamfusionCached = RegExp(
  r'^⚡instant',
  multiLine: true,
  caseSensitive: false,
);
final RegExp _streamfusionServiceCached = RegExp(
  r'^⚡instant\s*\n([^\n]+)',
  multiLine: true,
  caseSensitive: false,
);
final RegExp _streamfusionUncachedService = RegExp(
  r'^⬇️?download\s*\n([^\n]+)',
  multiLine: true,
  caseSensitive: false,
);
final RegExp _aioTorboxCached = RegExp(r'\(Instant\b', caseSensitive: false);
final RegExp _aioPrismCached = RegExp(r'⚡\s*Ready\b', caseSensitive: false);
final RegExp _aioPrismUncached = RegExp(
  r'❌\s*Not\s+Ready\b',
  caseSensitive: false,
);
final RegExp _aioGdriveCached = RegExp(r'🎫', unicode: true);
final RegExp _aioGdriveUncached = RegExp(r'🎟️?', unicode: true);
final RegExp _aioGenericCached = RegExp(
  r'[🚀🌩📫]|\bcached\b',
  unicode: true,
  caseSensitive: false,
);
final RegExp _aioGenericUncached = RegExp(
  r'☁️?|\bUNCACHED\b',
  unicode: true,
  caseSensitive: false,
);

const _mediafusionService =
    'RD|TB|TRB|AD|PM|DL|OC|ED|ST|DBD|DB|PKP|PP|SDR|SAB|NZB|DAV|EN|NNTP|QB-WD|Putio|Offcloud|EasyDebrid';
final RegExp _mediafusionCached = RegExp(
  '\\b(?:$_mediafusionService)\\s*[+⚡✅]',
  unicode: true,
  caseSensitive: false,
);
final RegExp _mediafusionUncached = RegExp(
  '\\b(?:$_mediafusionService)\\s*[⏳⬇🔻❌]',
  unicode: true,
  caseSensitive: false,
);
final RegExp _serviceCached = RegExp(
  r'(?:⚡️?|✅)\s*(?:cached(?:\s+on)?|instant(?:\s+on)?|ready(?:\s+on)?)?\s*'
  r'(real[\s\-_]?debrid|realdebrid|rd|torbox|tb|all[\s\-_]?debrid|alldebrid|ad'
  r'|premiumize|pm|debrid[\s\-_]?link|debridlink|dl)',
  unicode: true,
  caseSensitive: false,
);
final RegExp _serviceUncached = RegExp(
  r'(?:⏳|⬇️?|🔻|❌)\s*(?:need[\s_-]?cache|need[\s_-]?to[\s_-]?cache|download(?:\s+via)?'
  r'|not\s+ready|uncached(?:\s+on)?)?\s*'
  r'(real[\s\-_]?debrid|realdebrid|rd|torbox|tb|all[\s\-_]?debrid|alldebrid|ad'
  r'|premiumize|pm|debrid[\s\-_]?link|debridlink|dl)',
  unicode: true,
  caseSensitive: false,
);
final RegExp _cometBinge = RegExp(
  r'^comet\|([a-z\-]+)\|',
  caseSensitive: false,
);
final RegExp _elfhostedCache = RegExp(
  r'\belf[\s\-_]?cache\b|cached\s+on\s+elfhosted',
  caseSensitive: false,
);

const Map<String, DebridSlug> _cometServiceToSlug = {
  'realdebrid': DebridSlug.rd,
  'real-debrid': DebridSlug.rd,
  'rd': DebridSlug.rd,
  'torbox': DebridSlug.tb,
  'tb': DebridSlug.tb,
  'alldebrid': DebridSlug.ad,
  'ad': DebridSlug.ad,
  'premiumize': DebridSlug.pm,
  'pm': DebridSlug.pm,
  'debridlink': DebridSlug.dl,
  'debrid-link': DebridSlug.dl,
  'dl': DebridSlug.dl,
};

String _stripInvisibles(String text) =>
    text.replaceAll(RegExp('[​-‍⁠﻿]'), '').replaceAll('️', '');

/// Parses per-debrid cache state from [rawText] (with optional [bingeGroup],
/// [addonName], [url] context).
Map<DebridSlug, bool> parseCacheFlags(
  String rawText, {
  String? bingeGroup,
  String? addonName,
  String? url,
}) {
  final text = _stripInvisibles(rawText);
  final out = <DebridSlug, bool>{};
  final denied = <DebridSlug>{};
  void markUncached(DebridSlug slug) {
    denied.add(slug);
    out[slug] = false;
  }

  if (_rdUncached.hasMatch(text)) markUncached(DebridSlug.rd);
  if (_tbUncached.hasMatch(text)) markUncached(DebridSlug.tb);
  if (_adUncached.hasMatch(text)) markUncached(DebridSlug.ad);
  if (_pmUncached.hasMatch(text)) markUncached(DebridSlug.pm);
  if (_dlUncached.hasMatch(text)) markUncached(DebridSlug.dl);

  final jackettioBare = _jackettioBareUncached.firstMatch(text);
  if (jackettioBare != null) {
    final slug = _serviceNameToSlug(jackettioBare.group(1)!);
    if (slug != null) markUncached(slug);
  }
  final sfUncachedSvc = _streamfusionUncachedService.firstMatch(text);
  if (sfUncachedSvc != null) {
    final slug = _serviceNameToSlug(sfUncachedSvc.group(1)!.trim());
    if (slug != null) markUncached(slug);
  }
  final uncachedMatch = _serviceUncached.firstMatch(text);
  if (uncachedMatch != null) {
    final slug = _serviceNameToSlug(uncachedMatch.group(1)!);
    if (slug != null) markUncached(slug);
  }
  final isAioStreams =
      addonName != null &&
      RegExp('aiostreams', caseSensitive: false).hasMatch(addonName);
  if (_aioPrismUncached.hasMatch(text) ||
      _aioGdriveUncached.hasMatch(text) ||
      _mediafusionUncached.hasMatch(text) ||
      (isAioStreams && _aioGenericUncached.hasMatch(text))) {
    final slug =
        (bingeGroup != null ? _cometServiceFrom(bingeGroup) : null) ??
        _mediafusionAbbrevSlug(text) ??
        _addonNameSlug(addonName);
    if (slug != null) markUncached(slug);
  }

  if (_rdCache.hasMatch(text) && !denied.contains(DebridSlug.rd)) {
    out[DebridSlug.rd] = true;
  }
  if (_tbCache.hasMatch(text) && !denied.contains(DebridSlug.tb)) {
    out[DebridSlug.tb] = true;
  }
  if (_adCache.hasMatch(text) && !denied.contains(DebridSlug.ad)) {
    out[DebridSlug.ad] = true;
  }
  if (_pmCache.hasMatch(text) && !denied.contains(DebridSlug.pm)) {
    out[DebridSlug.pm] = true;
  }
  if (_dlCache.hasMatch(text) && !denied.contains(DebridSlug.dl)) {
    out[DebridSlug.dl] = true;
  }

  final sfCachedSvc = _streamfusionServiceCached.firstMatch(text);
  if (sfCachedSvc != null) {
    final slug = _serviceNameToSlug(sfCachedSvc.group(1)!.trim());
    if (slug != null && !denied.contains(slug)) out[slug] = true;
  }

  final serviceCached = _serviceCached.firstMatch(text);
  if (serviceCached != null) {
    final slug = _serviceNameToSlug(serviceCached.group(1)!);
    if (slug != null && !denied.contains(slug)) out[slug] = true;
  }

  final templateCached =
      _aioPrismCached.hasMatch(text) ||
      _aioTorboxCached.hasMatch(text) ||
      _aioGdriveCached.hasMatch(text) ||
      _streamfusionCached.hasMatch(text) ||
      _mediafusionCached.hasMatch(text) ||
      (isAioStreams && _aioGenericCached.hasMatch(text));
  if (templateCached) {
    final slug =
        (bingeGroup != null ? _cometServiceFrom(bingeGroup) : null) ??
        _mediafusionAbbrevSlug(text) ??
        _addonNameSlug(addonName);
    if (slug != null && !denied.contains(slug) && out[slug] != true) {
      out[slug] = true;
    }
  }

  if (url != null && addonName != null) {
    final slug = _addonNameSlug(addonName);
    if (slug != null && !denied.contains(slug) && out[slug] != true) {
      final isHttp = RegExp(r'^https?://', caseSensitive: false).hasMatch(url);
      final looksDebrid = RegExp(
        r'(?:realdebrid|real-debrid|torbox|alldebrid|premiumize|debridlink|debrid-link|elfhosted)',
        caseSensitive: false,
      ).hasMatch(url);
      if (isHttp && (looksDebrid || _isDebridAwareAddon(addonName))) {
        out[slug] = true;
      }
    }
  }

  final isElfHosted =
      (url != null &&
          RegExp('elfhosted', caseSensitive: false).hasMatch(url)) ||
      (addonName != null &&
          RegExp('elfhosted', caseSensitive: false).hasMatch(addonName));
  if (isElfHosted && _elfhostedCache.hasMatch(text)) {
    final slugFromBinge = bingeGroup != null
        ? _cometServiceFrom(bingeGroup)
        : null;
    final targets = slugFromBinge != null
        ? [slugFromBinge]
        : [
            DebridSlug.rd,
            DebridSlug.tb,
            DebridSlug.ad,
            DebridSlug.pm,
            DebridSlug.dl,
          ];
    for (final slug in targets) {
      out[slug] = true;
    }
  }

  return out;
}

DebridSlug? _mediafusionAbbrevSlug(String text) {
  if (RegExp(r'\bTRB\b', caseSensitive: false).hasMatch(text) ||
      RegExp(r'\bTorBox\b', caseSensitive: false).hasMatch(text)) {
    return DebridSlug.tb;
  }
  if (RegExp(r'\bTB\b(?!\w)', caseSensitive: false).hasMatch(text)) {
    return DebridSlug.tb;
  }
  if (RegExp(r'\bReal[\s\-]?Debrid\b', caseSensitive: false).hasMatch(text)) {
    return DebridSlug.rd;
  }
  if (RegExp(r'\bRD\b(?!\w)', caseSensitive: false).hasMatch(text)) {
    return DebridSlug.rd;
  }
  if (RegExp(r'\bAllDebrid\b', caseSensitive: false).hasMatch(text)) {
    return DebridSlug.ad;
  }
  if (RegExp(r'\bAD\b(?!\w)', caseSensitive: false).hasMatch(text)) {
    return DebridSlug.ad;
  }
  if (RegExp(r'\bPremiumize\b', caseSensitive: false).hasMatch(text)) {
    return DebridSlug.pm;
  }
  if (RegExp(r'\bPM\b(?!\w)', caseSensitive: false).hasMatch(text)) {
    return DebridSlug.pm;
  }
  if (RegExp(r'\bDebrid[\s\-]?Link\b', caseSensitive: false).hasMatch(text)) {
    return DebridSlug.dl;
  }
  if (RegExp(r'\bDL\b(?!\w)', caseSensitive: false).hasMatch(text)) {
    return DebridSlug.dl;
  }
  return null;
}

DebridSlug? _addonNameSlug(String? name) {
  if (name == null) return null;
  final lower = name.toLowerCase();
  if (RegExp(r'torbox|trb').hasMatch(lower)) return DebridSlug.tb;
  if (RegExp(r'real[\s\-]?debrid|\brd\b').hasMatch(lower)) return DebridSlug.rd;
  if (RegExp(r'all[\s\-]?debrid|\bad\b').hasMatch(lower)) return DebridSlug.ad;
  if (RegExp(r'premiumize|\bpm\b').hasMatch(lower)) return DebridSlug.pm;
  if (RegExp(r'debrid[\s\-]?link|\bdl\b').hasMatch(lower)) return DebridSlug.dl;
  return null;
}

bool _isDebridAwareAddon(String name) => RegExp(
  r'(?:mediafusion|comet|torrentio|aiostreams|knightcrawler|jackettio|streamfusion|easynews)',
  caseSensitive: false,
).hasMatch(name);

DebridSlug? _cometServiceFrom(String bingeGroup) {
  final m = _cometBinge.firstMatch(bingeGroup);
  if (m == null) return null;
  return _cometServiceToSlug[m.group(1)!.toLowerCase()];
}

DebridSlug? _serviceNameToSlug(String s) {
  final n = s.toLowerCase().replaceAll(RegExp(r'[\s\-]+'), '');
  if (n == 'realdebrid' || n == 'rd') return DebridSlug.rd;
  if (n == 'torbox' || n == 'tb') return DebridSlug.tb;
  if (n == 'alldebrid' || n == 'ad') return DebridSlug.ad;
  if (n == 'premiumize' || n == 'pm') return DebridSlug.pm;
  if (n == 'debridlink' || n == 'dl') return DebridSlug.dl;
  return null;
}
