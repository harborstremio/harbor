import 'dart:math';

import 'adult_filter.dart';
import 'curated.dart';
import 'resolved_addon.dart';

/// Whether a resolved addon is adult content, ported 1:1 from `isAdultAddon`.
/// A curated entry is authoritative (its `nsfw` flag); otherwise the manifest's
/// `behaviorHints.adult` or an adult id/name triggers it.
bool isAdultAddon(ResolvedAddon r) {
  final curated = r.curated;
  if (curated != null) return curated.nsfw;
  final m = r.manifest;
  return (m?.adult ?? false) || isAdultText([m?.id, m?.name]);
}

// Word-boundary matchers over the addon's combined text. Transcribed verbatim
// from the store's classification regexes (only those categorizeAddon uses).
final _animeRx = RegExp(
  r'\banime\b|\bkitsu\b|\bmal\b|\bjikan\b|\bmyanimelist\b|\banidb\b|\banilist\b|\bmanga\b',
  caseSensitive: false,
);
final _sportsRx = RegExp(
  r'\bsports?\b|\bnfl\b|\bnba\b|\bnhl\b|\bmlb\b|\bsoccer\b|\bfootball\b|\bf1\b|\bformula\s*1\b|\bcricket\b|\bbasketball\b|\bufc\b|\bmma\b|\bwwe\b|\bdazn\b|\besports?\b|\bsporttv\b|\bdaddylive\b',
  caseSensitive: false,
);
final _liveTvRx = RegExp(
  r'\biptv\b|\blive\s*tv\b|\bchannel\b|\bm3u\b|\bplutotv\b|\bpluto\.tv\b|\busatv\b|\bota\b|\bbroadcast\b',
  caseSensitive: false,
);

String _manifestText(ResolvedAddon r) {
  final m = r.manifest;
  return [
    m?.name ?? '',
    m?.description ?? '',
    m?.id ?? '',
    r.transportUrl,
  ].join(' ').toLowerCase();
}

bool _hasResource(ResolvedAddon r, String name) =>
    r.manifest?.resources.contains(name) ?? false;

bool _isAnimeId(String prefix) =>
    prefix.startsWith('kitsu') ||
    prefix.startsWith('mal') ||
    prefix.startsWith('anidb');

/// The category a resolved addon falls under, ported 1:1 from `categorizeAddon`.
/// Adult and curated entries short-circuit; otherwise the manifest's resources,
/// types, id prefixes, and text decide.
AddonCategory categorizeAddon(ResolvedAddon r) {
  if (isAdultAddon(r)) return AddonCategory.adult;
  final curated = r.curated;
  if (curated != null) return curated.category;
  final m = r.manifest;
  if (m == null) return AddonCategory.tools;

  final text = _manifestText(r);
  final types = m.types;
  final ids = m.idPrefixes;
  final hasStream = _hasResource(r, 'stream');
  final hasSub = _hasResource(r, 'subtitles');
  final hasCatalog = _hasResource(r, 'catalog');
  final hasMeta = _hasResource(r, 'meta');

  if (ids.any(_isAnimeId) || _animeRx.hasMatch(text)) {
    if (hasStream || hasMeta || hasCatalog) return AddonCategory.anime;
  }
  if (_liveTvRx.hasMatch(text) ||
      types.contains('tv') ||
      types.contains('channel')) {
    return AddonCategory.liveTv;
  }
  if (_sportsRx.hasMatch(text)) return AddonCategory.sports;
  if (hasSub) return AddonCategory.subtitles;
  if (hasStream) return AddonCategory.streams;
  if (hasCatalog || hasMeta) return AddonCategory.metadata;
  return AddonCategory.tools;
}

// Rail-classification matchers, transcribed verbatim from the store's
// `DEBRID_RX` / `USENET_RX` / `SUBS_FOREIGN_RX` (used only by matchesRail).
final _debridRx = RegExp(
  r'\bdebrid\b|\brealdebrid\b|\breal-debrid\b|\btorbox\b|\balldebrid\b|\bpremiumize\b|\bdebridlink\b|\beasydebrid\b|\boffcloud\b|\bmediafusion\b|\bcomet\b|\btorrentio\b|\bjackettio\b|\bknightcrawler\b|\baiostreams\b|\bstreamfusion\b',
  caseSensitive: false,
);
final _usenetRx = RegExp(
  r'\busenet\b|\bnzb\b|\beasynews\b|\bsabnzbd\b|\bnzbget\b',
  caseSensitive: false,
);
final _subsForeignRx = RegExp(
  r'\bsubdl\b|\bsubscene\b|\bopensubtitles\b|\bsubtitle\b|\bsubtitles\b|\bcaption\b|\bwyzie\b',
  caseSensitive: false,
);
final _torrentP2pRx = RegExp(r'\btorrent\b|\bp2p\b', caseSensitive: false);

/// Whether a resolved addon belongs on the curated rail [railId], ported 1:1
/// from `matchesRail`. Curated entries use their declared rails; community
/// addons are classified by their resources, id prefixes, and text.
bool matchesRail(ResolvedAddon r, String railId) {
  if (isAdultAddon(r)) return false;
  final curated = r.curated;
  if (curated != null) return curated.rails.contains(railId);
  final m = r.manifest;
  if (m == null) return false;

  final text = _manifestText(r);
  final ids = m.idPrefixes;
  final hasStream = _hasResource(r, 'stream');
  final hasSub = _hasResource(r, 'subtitles');
  final hasCatalog = _hasResource(r, 'catalog');
  final hasMeta = _hasResource(r, 'meta');

  return switch (railId) {
    'essential' => false,
    'streams-debrid' => hasStream && _debridRx.hasMatch(text),
    'streams-free' =>
      hasStream &&
          !_debridRx.hasMatch(text) &&
          (_usenetRx.hasMatch(text) || _torrentP2pRx.hasMatch(text)),
    'anime' =>
      (hasStream || hasMeta || hasCatalog) &&
          (ids.any(_isAnimeId) || _animeRx.hasMatch(text)),
    'subtitles' => hasSub || _subsForeignRx.hasMatch(text),
    'metadata' => (hasCatalog || hasMeta) && !hasSub && !hasStream,
    'sports' =>
      _sportsRx.hasMatch(text) ||
          _liveTvRx.hasMatch(text) ||
          m.types.any((t) => t == 'tv' || t == 'channel'),
    _ => false,
  };
}

int _railTier(ResolvedAddon r) {
  final rec = r.curated?.recommended ?? -1;
  if (rec >= 90) return 0;
  if (rec >= 80) return 1;
  if (rec >= 70) return 2;
  if (r.curated != null) return 3;
  if (r.installed) return 4;
  return 5;
}

/// Builds a curated rail from the catalog: the addons that match [railId],
/// grouped into recommendation tiers, shuffled within each tier, and capped at
/// [hardCap]. Ported 1:1 from `buildRail`. Pass [rng] for deterministic tests.
List<ResolvedAddon> buildRail(
  Map<String, ResolvedAddon> byId,
  String railId, {
  int hardCap = 16,
  Random? rng,
}) {
  final random = rng ?? Random();
  final groups = <int, List<ResolvedAddon>>{};
  for (final r in byId.values) {
    if (matchesRail(r, railId)) {
      (groups[_railTier(r)] ??= <ResolvedAddon>[]).add(r);
    }
  }
  final out = <ResolvedAddon>[];
  for (final tier in groups.keys.toList()..sort()) {
    out.addAll(groups[tier]!..shuffle(random));
  }
  return out.length > hardCap ? out.sublist(0, hardCap) : out;
}
