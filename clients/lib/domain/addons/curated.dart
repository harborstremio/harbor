// GENERATED-EQUIVALENT: transcribed 1:1 from
// src/lib/addons-store/curated.ts. Do not hand-edit entries; keep in
// sync with the web source.

/// The category an addon falls under, ported from `AddonCategory`.
enum AddonCategory {
  metadata('metadata'),
  streams('streams'),
  subtitles('subtitles'),
  anime('anime'),
  sports('sports'),
  liveTv('live-tv'),
  tools('tools'),
  adult('adult');

  const AddonCategory(this.wire);
  final String wire;
}

/// A capability/pricing tag on an addon, ported from `AddonTag`.
enum AddonTag {
  official('official'),
  free('free'),
  debridRequired('debrid-required'),
  premium('premium'),
  p2p('p2p'),
  usenet('usenet'),
  torrent('torrent'),
  configurable('configurable'),
  selfHost('self-host');

  const AddonTag(this.wire);
  final String wire;
}

/// The layout a curated rail renders with, ported from `CuratedRail.layout`.
enum CuratedRailLayout { feature, list, tile }

/// The featured-hero banner data on a curated entry, ported from `CuratedHero`.
class CuratedHero {
  const CuratedHero({
    required this.eyebrow,
    required this.title,
    required this.subtitle,
    required this.accent,
  });

  final String eyebrow;
  final String title;
  final String subtitle;
  final String accent;
}

/// A hand-curated addon recommendation, ported 1:1 from `CuratedEntry`.
class CuratedEntry {
  const CuratedEntry({
    required this.id,
    required this.transportUrl,
    required this.category,
    required this.tags,
    this.curatorNote,
    this.warnings = const [],
    this.nsfw = false,
    this.hero,
    required this.rails,
    this.recommended,
  });

  final String id;
  final String transportUrl;
  final AddonCategory category;
  final List<AddonTag> tags;
  final String? curatorNote;
  final List<String> warnings;
  final bool nsfw;
  final CuratedHero? hero;
  final List<String> rails;
  final int? recommended;
}

/// A curated rail (a titled row on the addons Discover pane), ported from
/// `CuratedRail`.
class CuratedRail {
  const CuratedRail({
    required this.id,
    required this.title,
    this.blurb,
    required this.layout,
  });

  final String id;
  final String title;
  final String? blurb;
  final CuratedRailLayout layout;
}

/// The curated rails, ported 1:1 from `CURATED_RAILS`.
const List<CuratedRail> kCuratedRails = [
  CuratedRail(
    id: 'essential',
    title: 'Essential addons',
    blurb: 'Start here. The ones almost everyone has.',
    layout: CuratedRailLayout.feature,
  ),
  CuratedRail(
    id: 'streams-debrid',
    title: 'Best for debrid',
    blurb: 'Cached on Real-Debrid, TorBox, AllDebrid. Instant play.',
    layout: CuratedRailLayout.list,
  ),
  CuratedRail(
    id: 'streams-free',
    title: 'Free torrent + usenet',
    blurb: 'No subscription needed. Quality varies.',
    layout: CuratedRailLayout.list,
  ),
  CuratedRail(
    id: 'anime',
    title: 'Anime done right',
    blurb: 'Kitsu IDs, fansub-friendly, season-aware.',
    layout: CuratedRailLayout.list,
  ),
  CuratedRail(
    id: 'subtitles',
    title: 'Subtitles',
    blurb: 'Proper search across providers, foreign-language coverage.',
    layout: CuratedRailLayout.tile,
  ),
  CuratedRail(
    id: 'metadata',
    title: 'Catalogs & metadata',
    blurb: 'Better posters, ratings, episode info.',
    layout: CuratedRailLayout.tile,
  ),
  CuratedRail(
    id: 'sports',
    title: 'Sports & live TV',
    blurb: 'Live streams that actually work.',
    layout: CuratedRailLayout.list,
  ),
  CuratedRail(
    id: 'tools',
    title: 'Power tools',
    blurb: 'Quality-of-life upgrades. Sync, ratings, trailers.',
    layout: CuratedRailLayout.tile,
  ),
  CuratedRail(
    id: 'adult',
    title: 'Adult',
    blurb: 'NSFW. Hidden until enabled.',
    layout: CuratedRailLayout.list,
  ),
];

/// The curated addons, ported 1:1 from `CURATED_ADDONS`.
const List<CuratedEntry> kCuratedAddons = [
  CuratedEntry(
    id: 'com.stremio.torrentio.addon',
    transportUrl: 'https://torrentio.strem.fun/manifest.json',
    category: AddonCategory.streams,
    tags: [AddonTag.debridRequired, AddonTag.torrent, AddonTag.configurable],
    curatorNote:
        'The default. Aggregates a dozen indexers and resolves through your debrid. Configure on torrentio.strem.fun for RD/TB/AD/PM/DL keys.',
    hero: CuratedHero(
      eyebrow: 'FEATURED',
      title: 'Torrentio',
      subtitle: 'Twelve indexers, one addon, instant via debrid.',
      accent: 'from-amber-400/40 to-orange-500/30',
    ),
    rails: ['essential', 'streams-debrid'],
    recommended: 99,
  ),
  CuratedEntry(
    id: 'comet.elfhosted.com',
    transportUrl: 'https://comet.elfhosted.com/manifest.json',
    category: AddonCategory.streams,
    tags: [AddonTag.debridRequired, AddonTag.torrent, AddonTag.configurable],
    curatorNote:
        'The cleaner Torrentio alternative. Faster cache checks, tighter formatting, RD + TB + AD support. Use configure page to set keys.',
    rails: ['essential', 'streams-debrid'],
    recommended: 96,
  ),
  CuratedEntry(
    id: 'stremio.addons.mediafusion|elfhosted',
    transportUrl: 'https://mediafusion.elfhosted.com/manifest.json',
    category: AddonCategory.streams,
    tags: [AddonTag.debridRequired, AddonTag.torrent, AddonTag.configurable],
    curatorNote:
        'Heavyweight aggregator with catalog browsing on top of streams. Every debrid, sports + live TV bolt-ons, deep template customization.',
    rails: ['essential', 'streams-debrid'],
    recommended: 94,
  ),
  CuratedEntry(
    id: 'com.aiostreams.viren070',
    transportUrl: 'https://aiostreams.elfhosted.com/stremio/manifest.json',
    category: AddonCategory.streams,
    tags: [AddonTag.configurable],
    curatorNote:
        'Aggregator-of-aggregators. Combines Torrentio, Comet, MediaFusion, Easynews, Jackettio into one feed with a unified formatter.',
    rails: ['essential', 'streams-debrid'],
    recommended: 92,
  ),
  CuratedEntry(
    id: 'com.notorrent.addon',
    transportUrl: 'https://addon.notorrent2.workers.dev/manifest.json',
    category: AddonCategory.streams,
    tags: [AddonTag.free],
    curatorNote:
        'Direct HTTP streams from scrapers. No torrents, no debrid needed. Quality varies by title but no setup tax.',
    rails: ['essential', 'streams-free'],
    recommended: 90,
  ),
  CuratedEntry(
    id: 'community.easynews-plus-plus',
    transportUrl:
        'https://easynews-cloudflare-worker.jqrw92fchz.workers.dev/manifest.json',
    category: AddonCategory.streams,
    tags: [AddonTag.premium, AddonTag.usenet, AddonTag.configurable],
    curatorNote:
        'Usenet via Easynews. No debrid, no peers. Costs money, but if you have it, nothing is faster.',
    rails: ['essential', 'streams-debrid'],
    recommended: 88,
  ),
  CuratedEntry(
    id: 'com.stremio.thepiratebay.plus',
    transportUrl: 'https://thepiratebay-plus.strem.fun/manifest.json',
    category: AddonCategory.streams,
    tags: [AddonTag.debridRequired, AddonTag.torrent],
    curatorNote:
        'TPB feed run by the Torrentio author. Pairs naturally with a debrid for instant resolution.',
    rails: ['streams-debrid'],
    recommended: 84,
  ),
  CuratedEntry(
    id: 'com.torrentsdb.addon',
    transportUrl: 'https://torrentsdb.com/manifest.json',
    category: AddonCategory.streams,
    tags: [AddonTag.debridRequired, AddonTag.torrent],
    curatorNote:
        'Curated torrent database. Slimmer feed than Torrentio, less noise on popular releases.',
    rails: ['streams-debrid'],
    recommended: 80,
  ),
  CuratedEntry(
    id: 'jackettio.elfhosted.com',
    transportUrl: 'https://jackettio.elfhosted.com/manifest.json',
    category: AddonCategory.streams,
    tags: [AddonTag.debridRequired, AddonTag.torrent, AddonTag.configurable],
    curatorNote:
        'Hosted Jackett bridge with debrid resolution. Hits private trackers if you bring keys.',
    rails: ['streams-debrid'],
    recommended: 78,
  ),
  CuratedEntry(
    id: 'com.keopps.peerflix',
    transportUrl: 'https://peerflix.mov/manifest.json',
    category: AddonCategory.streams,
    tags: [AddonTag.p2p, AddonTag.torrent, AddonTag.free],
    curatorNote:
        'Peer-to-peer torrent streaming, no debrid. Direct-from-swarm playback. Lighter on the pipe but no caching guarantees.',
    rails: ['streams-free'],
    recommended: 72,
  ),
  CuratedEntry(
    id: 'com.stremio.HdHub',
    transportUrl:
        'https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjIxNjBwLDEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyJ9/manifest.json',
    category: AddonCategory.streams,
    tags: [AddonTag.debridRequired, AddonTag.torrent],
    curatorNote:
        'HD-focused indexer, 2160p/1080p/720p only, pre-sorted by quality.',
    rails: ['streams-debrid'],
    recommended: 70,
  ),
  CuratedEntry(
    id: 'community.stremio.debrid-search',
    transportUrl:
        'https://68d69db7dc40-debrid-search.baby-beamup.club/manifest.json',
    category: AddonCategory.streams,
    tags: [AddonTag.premium, AddonTag.configurable],
    curatorNote:
        'Searches what\'s already in your debrid cloud. Skips scraping when you\'ve downloaded it before.',
    rails: ['streams-debrid'],
    recommended: 68,
  ),
  CuratedEntry(
    id: 'webstreamr-mbg',
    transportUrl:
        'https://87d6a6ef6b58-webstreamrmbg.baby-beamup.club/manifest.json',
    category: AddonCategory.streams,
    tags: [AddonTag.free],
    curatorNote:
        'Multi-source HTTP stream scraper. Free alternative if you have no debrid and no patience for torrents.',
    rails: ['streams-free'],
    recommended: 66,
  ),
  CuratedEntry(
    id: 'community.anime.kitsu',
    transportUrl: 'https://anime-kitsu.strem.fun/manifest.json',
    category: AddonCategory.anime,
    tags: [AddonTag.official, AddonTag.free],
    curatorNote:
        'Canonical anime catalog. Kitsu IDs, season splits, accurate episode mapping. Required if you watch anime in Stremio.',
    rails: ['essential', 'anime', 'metadata'],
    recommended: 95,
  ),
  CuratedEntry(
    id: 'community.meteor',
    transportUrl:
        'https://meteorfortheweebs.midnightignite.me/stremio/manifest.json',
    category: AddonCategory.anime,
    tags: [AddonTag.free],
    curatorNote:
        'Anime stream aggregator (subs + dubs). Hentai catalog gated separately. Pairs with Anime Kitsu for IDs.',
    rails: ['anime'],
    recommended: 82,
  ),
  CuratedEntry(
    id: 'org.stremio.aiolists',
    transportUrl: 'https://aiolists.elfhosted.com/manifest.json',
    category: AddonCategory.metadata,
    tags: [AddonTag.free, AddonTag.configurable],
    curatorNote:
        'Pulls lists from Trakt, MDBList, IMDb, Letterboxd into one merged catalog. Power-user list management.',
    rails: ['metadata'],
    recommended: 86,
  ),
  CuratedEntry(
    id: 'com.aio.metadata',
    transportUrl: 'https://aiometadata.elfhosted.com/manifest.json',
    category: AddonCategory.metadata,
    tags: [AddonTag.free, AddonTag.configurable],
    curatorNote:
        'Pulls metadata from TMDB, TVDB, TVMaze, MAL, IMDb, Fanart.tv. Pick which source wins per type. Harbor\'s TMDB key gives you most of this natively.',
    rails: ['metadata'],
    recommended: 84,
  ),
  CuratedEntry(
    id: 'tmdb-addon',
    transportUrl:
        'https://94c8cb9f702d-tmdb-addon.baby-beamup.club/manifest.json',
    category: AddonCategory.metadata,
    tags: [AddonTag.free, AddonTag.configurable],
    curatorNote:
        'TMDB catalogs as a Stremio addon: Trending, In Theaters, by Genre. Useful if you don\'t want to hand Harbor your TMDB key.',
    rails: ['metadata'],
    recommended: 82,
  ),
  CuratedEntry(
    id: 'community.tmdb.discover.plus',
    transportUrl: 'https://tmdb-discover-plus.elfhosted.com/manifest.json',
    category: AddonCategory.metadata,
    tags: [AddonTag.free],
    curatorNote:
        'Deeper TMDB discover queries. Decade rolls, niche genres, country-specific feeds.',
    rails: ['metadata'],
    recommended: 75,
  ),
  CuratedEntry(
    id: 'org.stremio.tmdbcollections',
    transportUrl:
        'https://61ab9c85a149-tmdb-collections.baby-beamup.club/manifest.json',
    category: AddonCategory.metadata,
    tags: [AddonTag.free],
    curatorNote:
        'Movies grouped by franchise (Marvel, Bond, Star Wars, Pixar). Click into a collection, get the whole set as a catalog.',
    rails: ['metadata'],
    recommended: 72,
  ),
  CuratedEntry(
    id: 'pw.ers.netflix-catalog',
    transportUrl:
        'https://7a82163c306e-stremio-netflix-catalog-addon.baby-beamup.club/manifest.json',
    category: AddonCategory.metadata,
    tags: [AddonTag.free],
    curatorNote:
        'Per-service catalogs (Netflix, Disney+, HBO Max, Prime, Apple TV+). What\'s streaming where, by region. Harbor already does this with a TMDB key.',
    rails: ['metadata'],
    recommended: 78,
  ),
  CuratedEntry(
    id: 'default.global.topstreaming.flixpatrol',
    transportUrl:
        'https://top-streaming.stream/username=temporary_username/manifest.json',
    category: AddonCategory.metadata,
    tags: [AddonTag.free],
    curatorNote:
        'FlixPatrol Top 10 across Netflix, Disney+, Max, Prime. The actual chart, not Netflix\'s marketing tile.',
    rails: ['metadata'],
    recommended: 73,
  ),
  CuratedEntry(
    id: 'community.morelikethis',
    transportUrl:
        'https://bbab4a35b833-more-like-this.baby-beamup.club/manifest.json',
    category: AddonCategory.metadata,
    tags: [AddonTag.free],
    curatorNote:
        'Adds a \'More like this\' row to any movie or show detail page. TMDB-backed recommendations.',
    rails: ['metadata', 'tools'],
    recommended: 70,
  ),
  CuratedEntry(
    id: 'org.imdbcatalogs',
    transportUrl:
        'https://1fe84bc728af-imdb-catalogs.baby-beamup.club/manifest.json',
    category: AddonCategory.metadata,
    tags: [AddonTag.free],
    curatorNote:
        'Native IMDb chart catalogs: Top 250 movies, Top 250 series, popular, most-anticipated.',
    rails: ['metadata'],
    recommended: 68,
  ),
  CuratedEntry(
    id: 'com.joaogonp.marveladdon',
    transportUrl: 'https://addon-marvel.onrender.com/manifest.json',
    category: AddonCategory.metadata,
    tags: [AddonTag.free],
    curatorNote:
        'MCU catalog ordered by release + by viewing order (chronological, phase, in-canon). Niche but well-built.',
    rails: ['metadata'],
    recommended: 60,
  ),
  CuratedEntry(
    id: 'com.tapframe.dcaddon',
    transportUrl: 'https://addon-dc-cq85.onrender.com/manifest.json',
    category: AddonCategory.metadata,
    tags: [AddonTag.free],
    curatorNote:
        'DC Universe catalog. DCEU, animated, Elseworlds, sorted by release + viewing order. Same idea as the Marvel addon.',
    rails: ['metadata'],
    recommended: 58,
  ),
  CuratedEntry(
    id: 'community.opensubtitlesv3.pro',
    transportUrl: 'https://opensubtitlesv3-pro.dexter21767.com/manifest.json',
    category: AddonCategory.subtitles,
    tags: [AddonTag.free, AddonTag.configurable],
    curatorNote:
        'OpenSubtitles v3 with paid-account auth so you skip the daily download cap. Best general-purpose subtitle source.',
    rails: ['subtitles'],
    recommended: 88,
  ),
  CuratedEntry(
    id: 'community.subsource.subtitles',
    transportUrl: 'https://subsource.strem.top/manifest.json',
    category: AddonCategory.subtitles,
    tags: [AddonTag.free, AddonTag.configurable],
    curatorNote:
        'SubSource (formerly SubScene). Good for foreign-language and fansubs OpenSubtitles misses.',
    rails: ['subtitles'],
    recommended: 84,
  ),
  CuratedEntry(
    id: 'community.subdl.subtitles',
    transportUrl: 'https://subdl.strem.top/manifest.json',
    category: AddonCategory.subtitles,
    tags: [AddonTag.free, AddonTag.configurable],
    curatorNote:
        'SubDL aggregator. Strong third option after OpenSubtitles + SubSource for tough-to-find subs.',
    rails: ['subtitles'],
    recommended: 76,
  ),
  CuratedEntry(
    id: 'com.subsense.nepiraw',
    transportUrl: 'https://subsense.nepiraw.com/manifest.json',
    category: AddonCategory.subtitles,
    tags: [AddonTag.free, AddonTag.configurable],
    curatorNote:
        'AI-translated subtitles when no human sub exists. Quality varies but covers gaps.',
    rails: ['subtitles'],
    recommended: 70,
  ),
  CuratedEntry(
    id: 'community.gtsubs',
    transportUrl: 'https://gtsubs.strem.top/manifest.json',
    category: AddonCategory.subtitles,
    tags: [AddonTag.free, AddonTag.configurable],
    curatorNote:
        'Google-translate fallback subs. Trash-tier prose, but readable when nothing else exists.',
    rails: ['subtitles'],
    recommended: 60,
  ),
  CuratedEntry(
    id: 'com.stremio.submaker',
    transportUrl: 'https://submaker.elfhosted.com/manifest.json',
    category: AddonCategory.subtitles,
    tags: [AddonTag.free, AddonTag.configurable],
    curatorNote:
        'Whisper-AI-generated subs from the actual audio track. Slow first time, accurate. Configure with your own slug.',
    rails: ['subtitles', 'tools'],
    recommended: 65,
  ),
  CuratedEntry(
    id: 'com.toast.translator',
    transportUrl: 'https://toast-translator.elfhosted.com/manifest.json',
    category: AddonCategory.subtitles,
    tags: [AddonTag.free, AddonTag.configurable],
    curatorNote:
        'On-the-fly subtitle translator. Pipes any source through DeepL or Google to your language.',
    rails: ['subtitles', 'tools'],
    recommended: 62,
  ),
  CuratedEntry(
    id: 'trakt.addon.default',
    transportUrl: 'https://mytrakt.elfhosted.com/manifest.json',
    category: AddonCategory.tools,
    tags: [AddonTag.free, AddonTag.configurable],
    curatorNote:
        'Two-way Trakt sync. Marks Stremio plays as Trakt scrobbles, pulls your watchlist + history back as catalogs.',
    rails: ['tools', 'metadata'],
    recommended: 82,
  ),
  CuratedEntry(
    id: 'com.stremio.rtngz',
    transportUrl:
        'https://72059fbbd1e5-stremio-addon-ratings.baby-beamup.club/manifest.json',
    category: AddonCategory.tools,
    tags: [AddonTag.free],
    curatorNote:
        'Shows IMDb, RT, MC, Letterboxd scores as fake stream rows on the detail page. Faster than alt-tabbing.',
    rails: ['tools'],
    recommended: 78,
  ),
  CuratedEntry(
    id: 'community.ratings.aggregator',
    transportUrl: 'https://rating-aggregator.elfhosted.com/manifest.json',
    category: AddonCategory.tools,
    tags: [AddonTag.free],
    curatorNote:
        'Rolls IMDb + RT + Metacritic + Letterboxd + TMDB into a single weighted score row.',
    rails: ['tools'],
    recommended: 73,
  ),
  CuratedEntry(
    id: 'org.streailer.trailer',
    transportUrl: 'https://streailer.elfhosted.com/manifest.json',
    category: AddonCategory.tools,
    tags: [AddonTag.free],
    curatorNote:
        'Adds trailers as a stream row. Plays them through your normal stream UI instead of a popup.',
    rails: ['tools'],
    recommended: 70,
  ),
  CuratedEntry(
    id: 'com.elfhosted.watchly',
    transportUrl: 'https://watchly.elfhosted.com/manifest.json',
    category: AddonCategory.tools,
    tags: [AddonTag.free],
    curatorNote:
        'Watch parties + sync sessions inside Stremio. Lightweight, no account required.',
    rails: ['tools'],
    recommended: 64,
  ),
  CuratedEntry(
    id: 'au.itcon.aisearch',
    transportUrl: 'https://stremio.itcon.au/aisearch/manifest.json',
    category: AddonCategory.tools,
    tags: [AddonTag.free, AddonTag.configurable],
    curatorNote:
        'Natural-language search ("sci-fi movies with twist endings under 2 hours") via Gemini. Bring your own key.',
    rails: ['tools'],
    recommended: 58,
  ),
  CuratedEntry(
    id: 'community.usatv',
    transportUrl: 'https://848b3516657c-usatv.baby-beamup.club/manifest.json',
    category: AddonCategory.liveTv,
    tags: [AddonTag.free],
    curatorNote:
        'Free US live channels: local news, sports, entertainment, kids, documentaries, music, Latino. No subscription.',
    rails: ['essential', 'sports'],
    recommended: 88,
  ),
  CuratedEntry(
    id: 'org.stremio.vavoo.clean',
    transportUrl: 'https://tvvoo.hayd.uk/cfg-it-uk-fr/manifest.json',
    category: AddonCategory.liveTv,
    tags: [AddonTag.free],
    curatorNote:
        'European IPTV (IT + UK + FR by default). Cleaner than raw M3U dumps.',
    warnings: ['Foreign-language by default. Configure for region.'],
    rails: ['sports'],
    recommended: 70,
  ),
  CuratedEntry(
    id: 'org.stremio.m3u-epg-addon',
    transportUrl:
        'https://stiptv.ddns.me/eyJwcm92aWRlciI6ImRpcmVjdCIsIm0zdVVybCI6Imh0dHBzOi8vaXB0di1vcmcuZ2l0aHViLmlvL2lwdHYvaW5kZXgubTN1IiwiZW5hYmxlRXBnIjpmYWxzZSwicHJlc2NhbiI6eyJlbnRyaWVzIjoxMDg2MiwiYXBwcm94VHYiOjEwNzUxLCJlcGdQcm9ncmFtbWVzIjowLCJlcGdDaGFubmVscyI6MH0sImluc3RhbmNlSWQiOiI4YWZkMzQ1NC02NjI5LTRiYTctYTdlYy0wNzdlZjc5ZTM1MGMifQ/manifest.json',
    category: AddonCategory.liveTv,
    tags: [AddonTag.free, AddonTag.configurable],
    curatorNote:
        'Generic M3U/EPG addon. Point it at any IPTV-Org or custom playlist URL. Self-config encouraged.',
    rails: ['sports'],
    recommended: 60,
  ),
  CuratedEntry(
    id: 'org.streamsppv.stremio',
    transportUrl: 'https://addon3.gstream.stream/manifest.json',
    category: AddonCategory.sports,
    tags: [AddonTag.free],
    curatorNote:
        'PPV + live sports streams (NBA, NFL, soccer, UFC). Quality and uptime are sports-addon-typical (mid).',
    rails: ['sports'],
    recommended: 62,
  ),
  CuratedEntry(
    id: 'pw.ers.porntube',
    transportUrl: 'https://dirty-pink.ers.pw/manifest.json',
    category: AddonCategory.adult,
    tags: [AddonTag.free, AddonTag.configurable],
    curatorNote:
        'Adult tube aggregator. Catalog + stream + meta. Hidden from default home rails.',
    warnings: ['18+ only.'],
    nsfw: true,
    rails: ['adult'],
    recommended: 60,
  ),
  CuratedEntry(
    id: 'org.masterchief.onlyporn',
    transportUrl:
        'https://07b88951aaab-jaxxx-v2.baby-beamup.club/manifest.json',
    category: AddonCategory.adult,
    tags: [AddonTag.free],
    curatorNote:
        'Alternative adult catalog. Smaller index than Porn Tube but different sources.',
    warnings: ['18+ only.'],
    nsfw: true,
    rails: ['adult'],
    recommended: 55,
  ),
];

/// The curated entry with [id], ported from `curatedById`.
CuratedEntry? curatedById(String id) {
  for (final e in kCuratedAddons) {
    if (e.id == id) return e;
  }
  return null;
}

/// The curated entries on [railId], sorted by descending `recommended`.
/// Ported 1:1 from `railEntries`.
List<CuratedEntry> railEntries(String railId) {
  final list = [
    for (final e in kCuratedAddons)
      if (e.rails.contains(railId)) e,
  ]..sort((a, b) => (b.recommended ?? 0) - (a.recommended ?? 0));
  return list;
}

/// The first curated entry that carries a hero banner, ported from `heroEntry`.
CuratedEntry? heroEntry() {
  for (final e in kCuratedAddons) {
    if (e.hero != null) return e;
  }
  return null;
}
