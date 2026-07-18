export type AddonCategory =
  | "metadata"
  | "streams"
  | "subtitles"
  | "anime"
  | "sports"
  | "live-tv"
  | "tools"
  | "adult";

export type AddonTag =
  | "official"
  | "free"
  | "debrid-required"
  | "premium"
  | "p2p"
  | "usenet"
  | "torrent"
  | "configurable"
  | "self-host";

export type CuratedHero = {
  eyebrow: string;
  title: string;
  subtitle: string;
  accent: string;
};

export type CuratedEntry = {
  id: string;
  transportUrl: string;
  category: AddonCategory;
  tags: AddonTag[];
  curatorNote?: string;
  warnings?: string[];
  nsfw?: boolean;
  hero?: CuratedHero;
  rails: string[];
  recommended?: number;
};

export type CuratedRail = {
  id: string;
  title: string;
  blurb?: string;
  layout: "feature" | "list" | "tile";
};

export const CURATED_RAILS: CuratedRail[] = [
  {
    id: "essential",
    title: "Essential addons",
    blurb: "Start here. The ones almost everyone has.",
    layout: "feature",
  },
  {
    id: "streams-debrid",
    title: "Best for debrid",
    blurb: "Cached on Real-Debrid, TorBox, AllDebrid. Instant play.",
    layout: "list",
  },
  {
    id: "streams-free",
    title: "Free torrent + usenet",
    blurb: "No subscription needed. Quality varies.",
    layout: "list",
  },
  {
    id: "anime",
    title: "Anime done right",
    blurb: "Kitsu IDs, fansub-friendly, season-aware.",
    layout: "list",
  },
  {
    id: "subtitles",
    title: "Subtitles",
    blurb: "Proper search across providers, foreign-language coverage.",
    layout: "tile",
  },
  {
    id: "metadata",
    title: "Catalogs & metadata",
    blurb: "Better posters, ratings, episode info.",
    layout: "tile",
  },
  {
    id: "sports",
    title: "Sports & live TV",
    blurb: "Live streams that actually work.",
    layout: "list",
  },
  {
    id: "tools",
    title: "Power tools",
    blurb: "Quality-of-life upgrades. Sync, ratings, trailers.",
    layout: "tile",
  },
  { id: "adult", title: "Adult", blurb: "NSFW. Hidden until enabled.", layout: "list" },
];

export const CURATED_ADDONS: CuratedEntry[] = [
  {
    id: "com.stremio.torrentio.addon",
    transportUrl: "https://torrentio.strem.fun/manifest.json",
    category: "streams",
    tags: ["debrid-required", "torrent", "configurable"],
    curatorNote:
      "The default. Aggregates a dozen indexers and resolves through your debrid. Configure on torrentio.strem.fun for RD/TB/AD/PM/DL keys.",
    rails: ["essential", "streams-debrid"],
    recommended: 99,
    hero: {
      eyebrow: "FEATURED",
      title: "Torrentio",
      subtitle: "Twelve indexers, one addon, instant via debrid.",
      accent: "from-amber-400/40 to-orange-500/30",
    },
  },
  {
    id: "comet.elfhosted.com",
    transportUrl: "https://comet.elfhosted.com/manifest.json",
    category: "streams",
    tags: ["debrid-required", "torrent", "configurable"],
    curatorNote:
      "The cleaner Torrentio alternative. Faster cache checks, tighter formatting, RD + TB + AD support. Use configure page to set keys.",
    rails: ["essential", "streams-debrid"],
    recommended: 96,
  },
  {
    id: "stremio.addons.mediafusion|elfhosted",
    transportUrl: "https://mediafusion.elfhosted.com/manifest.json",
    category: "streams",
    tags: ["debrid-required", "torrent", "configurable"],
    curatorNote:
      "Heavyweight aggregator with catalog browsing on top of streams. Every debrid, sports + live TV bolt-ons, deep template customization.",
    rails: ["essential", "streams-debrid"],
    recommended: 94,
  },
  {
    id: "com.aiostreams.viren070",
    transportUrl: "https://aiostreams.elfhosted.com/stremio/manifest.json",
    category: "streams",
    tags: ["configurable"],
    curatorNote:
      "Aggregator-of-aggregators. Combines Torrentio, Comet, MediaFusion, Easynews, Jackettio into one feed with a unified formatter.",
    rails: ["essential", "streams-debrid"],
    recommended: 92,
  },
  {
    id: "com.notorrent.addon",
    transportUrl: "https://addon.notorrent2.workers.dev/manifest.json",
    category: "streams",
    tags: ["free"],
    curatorNote:
      "Direct HTTP streams from scrapers. No torrents, no debrid needed. Quality varies by title but no setup tax.",
    rails: ["essential", "streams-free"],
    recommended: 90,
  },
  {
    id: "community.easynews-plus-plus",
    transportUrl: "https://easynews-cloudflare-worker.jqrw92fchz.workers.dev/manifest.json",
    category: "streams",
    tags: ["premium", "usenet", "configurable"],
    curatorNote:
      "Usenet via Easynews. No debrid, no peers. Costs money, but if you have it, nothing is faster.",
    rails: ["essential", "streams-debrid"],
    recommended: 88,
  },
  {
    id: "com.stremio.thepiratebay.plus",
    transportUrl: "https://thepiratebay-plus.strem.fun/manifest.json",
    category: "streams",
    tags: ["debrid-required", "torrent"],
    curatorNote:
      "TPB feed run by the Torrentio author. Pairs naturally with a debrid for instant resolution.",
    rails: ["streams-debrid"],
    recommended: 84,
  },
  {
    id: "com.torrentsdb.addon",
    transportUrl: "https://torrentsdb.com/manifest.json",
    category: "streams",
    tags: ["debrid-required", "torrent"],
    curatorNote:
      "Curated torrent database. Slimmer feed than Torrentio, less noise on popular releases.",
    rails: ["streams-debrid"],
    recommended: 80,
  },
  {
    id: "jackettio.elfhosted.com",
    transportUrl: "https://jackettio.elfhosted.com/manifest.json",
    category: "streams",
    tags: ["debrid-required", "torrent", "configurable"],
    curatorNote:
      "Hosted Jackett bridge with debrid resolution. Hits private trackers if you bring keys.",
    rails: ["streams-debrid"],
    recommended: 78,
  },
  {
    id: "com.keopps.peerflix",
    transportUrl: "https://peerflix.mov/manifest.json",
    category: "streams",
    tags: ["p2p", "torrent", "free"],
    curatorNote:
      "Peer-to-peer torrent streaming, no debrid. Direct-from-swarm playback. Lighter on the pipe but no caching guarantees.",
    rails: ["streams-free"],
    recommended: 72,
  },
  {
    id: "com.stremio.HdHub",
    transportUrl:
      "https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjIxNjBwLDEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyJ9/manifest.json",
    category: "streams",
    tags: ["debrid-required", "torrent"],
    curatorNote: "HD-focused indexer, 2160p/1080p/720p only, pre-sorted by quality.",
    rails: ["streams-debrid"],
    recommended: 70,
  },
  {
    id: "community.stremio.debrid-search",
    transportUrl: "https://68d69db7dc40-debrid-search.baby-beamup.club/manifest.json",
    category: "streams",
    tags: ["premium", "configurable"],
    curatorNote:
      "Searches what's already in your debrid cloud. Skips scraping when you've downloaded it before.",
    rails: ["streams-debrid"],
    recommended: 68,
  },
  {
    id: "webstreamr-mbg",
    transportUrl: "https://87d6a6ef6b58-webstreamrmbg.baby-beamup.club/manifest.json",
    category: "streams",
    tags: ["free"],
    curatorNote:
      "Multi-source HTTP stream scraper. Free alternative if you have no debrid and no patience for torrents.",
    rails: ["streams-free"],
    recommended: 66,
  },
  {
    id: "community.anime.kitsu",
    transportUrl: "https://anime-kitsu.strem.fun/manifest.json",
    category: "anime",
    tags: ["official", "free"],
    curatorNote:
      "Canonical anime catalog. Kitsu IDs, season splits, accurate episode mapping. Required if you watch anime in Stremio.",
    rails: ["essential", "anime", "metadata"],
    recommended: 95,
  },
  {
    id: "community.meteor",
    transportUrl: "https://meteorfortheweebs.midnightignite.me/stremio/manifest.json",
    category: "anime",
    tags: ["free"],
    curatorNote:
      "Anime stream aggregator (subs + dubs). Hentai catalog gated separately. Pairs with Anime Kitsu for IDs.",
    rails: ["anime"],
    recommended: 82,
  },
  {
    id: "org.stremio.aiolists",
    transportUrl: "https://aiolists.elfhosted.com/manifest.json",
    category: "metadata",
    tags: ["free", "configurable"],
    curatorNote:
      "Pulls lists from Trakt, MDBList, IMDb, Letterboxd into one merged catalog. Power-user list management.",
    rails: ["metadata"],
    recommended: 86,
  },
  {
    id: "com.aio.metadata",
    transportUrl: "https://aiometadata.elfhosted.com/manifest.json",
    category: "metadata",
    tags: ["free", "configurable"],
    curatorNote:
      "Pulls metadata from TMDB, TVDB, TVMaze, MAL, IMDb, Fanart.tv. Pick which source wins per type. Harbor's TMDB key gives you most of this natively.",
    rails: ["metadata"],
    recommended: 84,
  },
  {
    id: "tmdb-addon",
    transportUrl: "https://94c8cb9f702d-tmdb-addon.baby-beamup.club/manifest.json",
    category: "metadata",
    tags: ["free", "configurable"],
    curatorNote:
      "TMDB catalogs as a Stremio addon: Trending, In Theaters, by Genre. Useful if you don't want to hand Harbor your TMDB key.",
    rails: ["metadata"],
    recommended: 82,
  },
  {
    id: "community.tmdb.discover.plus",
    transportUrl: "https://tmdb-discover-plus.elfhosted.com/manifest.json",
    category: "metadata",
    tags: ["free"],
    curatorNote:
      "Deeper TMDB discover queries. Decade rolls, niche genres, country-specific feeds.",
    rails: ["metadata"],
    recommended: 75,
  },
  {
    id: "org.stremio.tmdbcollections",
    transportUrl: "https://61ab9c85a149-tmdb-collections.baby-beamup.club/manifest.json",
    category: "metadata",
    tags: ["free"],
    curatorNote:
      "Movies grouped by franchise (Marvel, Bond, Star Wars, Pixar). Click into a collection, get the whole set as a catalog.",
    rails: ["metadata"],
    recommended: 72,
  },
  {
    id: "pw.ers.netflix-catalog",
    transportUrl:
      "https://7a82163c306e-stremio-netflix-catalog-addon.baby-beamup.club/manifest.json",
    category: "metadata",
    tags: ["free"],
    curatorNote:
      "Per-service catalogs (Netflix, Disney+, HBO Max, Prime, Apple TV+). What's streaming where, by region. Harbor already does this with a TMDB key.",
    rails: ["metadata"],
    recommended: 78,
  },
  {
    id: "default.global.topstreaming.flixpatrol",
    transportUrl: "https://top-streaming.stream/username=temporary_username/manifest.json",
    category: "metadata",
    tags: ["free"],
    curatorNote:
      "FlixPatrol Top 10 across Netflix, Disney+, Max, Prime. The actual chart, not Netflix's marketing tile.",
    rails: ["metadata"],
    recommended: 73,
  },
  {
    id: "community.morelikethis",
    transportUrl: "https://bbab4a35b833-more-like-this.baby-beamup.club/manifest.json",
    category: "metadata",
    tags: ["free"],
    curatorNote:
      "Adds a 'More like this' row to any movie or show detail page. TMDB-backed recommendations.",
    rails: ["metadata", "tools"],
    recommended: 70,
  },
  {
    id: "org.imdbcatalogs",
    transportUrl: "https://1fe84bc728af-imdb-catalogs.baby-beamup.club/manifest.json",
    category: "metadata",
    tags: ["free"],
    curatorNote:
      "Native IMDb chart catalogs: Top 250 movies, Top 250 series, popular, most-anticipated.",
    rails: ["metadata"],
    recommended: 68,
  },
  {
    id: "com.joaogonp.marveladdon",
    transportUrl: "https://addon-marvel.onrender.com/manifest.json",
    category: "metadata",
    tags: ["free"],
    curatorNote:
      "MCU catalog ordered by release + by viewing order (chronological, phase, in-canon). Niche but well-built.",
    rails: ["metadata"],
    recommended: 60,
  },
  {
    id: "com.tapframe.dcaddon",
    transportUrl: "https://addon-dc-cq85.onrender.com/manifest.json",
    category: "metadata",
    tags: ["free"],
    curatorNote:
      "DC Universe catalog. DCEU, animated, Elseworlds, sorted by release + viewing order. Same idea as the Marvel addon.",
    rails: ["metadata"],
    recommended: 58,
  },
  {
    id: "community.opensubtitlesv3.pro",
    transportUrl: "https://opensubtitlesv3-pro.dexter21767.com/manifest.json",
    category: "subtitles",
    tags: ["free", "configurable"],
    curatorNote:
      "OpenSubtitles v3 with paid-account auth so you skip the daily download cap. Best general-purpose subtitle source.",
    rails: ["subtitles"],
    recommended: 88,
  },
  {
    id: "community.subsource.subtitles",
    transportUrl: "https://subsource.strem.top/manifest.json",
    category: "subtitles",
    tags: ["free", "configurable"],
    curatorNote:
      "SubSource (formerly SubScene). Good for foreign-language and fansubs OpenSubtitles misses.",
    rails: ["subtitles"],
    recommended: 84,
  },
  {
    id: "community.subdl.subtitles",
    transportUrl: "https://subdl.strem.top/manifest.json",
    category: "subtitles",
    tags: ["free", "configurable"],
    curatorNote:
      "SubDL aggregator. Strong third option after OpenSubtitles + SubSource for tough-to-find subs.",
    rails: ["subtitles"],
    recommended: 76,
  },
  {
    id: "com.subsense.nepiraw",
    transportUrl: "https://subsense.nepiraw.com/manifest.json",
    category: "subtitles",
    tags: ["free", "configurable"],
    curatorNote:
      "AI-translated subtitles when no human sub exists. Quality varies but covers gaps.",
    rails: ["subtitles"],
    recommended: 70,
  },
  {
    id: "community.gtsubs",
    transportUrl: "https://gtsubs.strem.top/manifest.json",
    category: "subtitles",
    tags: ["free", "configurable"],
    curatorNote:
      "Google-translate fallback subs. Trash-tier prose, but readable when nothing else exists.",
    rails: ["subtitles"],
    recommended: 60,
  },
  {
    id: "com.stremio.submaker",
    transportUrl: "https://submaker.elfhosted.com/manifest.json",
    category: "subtitles",
    tags: ["free", "configurable"],
    curatorNote:
      "Whisper-AI-generated subs from the actual audio track. Slow first time, accurate. Configure with your own slug.",
    rails: ["subtitles", "tools"],
    recommended: 65,
  },
  {
    id: "com.toast.translator",
    transportUrl: "https://toast-translator.elfhosted.com/manifest.json",
    category: "subtitles",
    tags: ["free", "configurable"],
    curatorNote:
      "On-the-fly subtitle translator. Pipes any source through DeepL or Google to your language.",
    rails: ["subtitles", "tools"],
    recommended: 62,
  },
  {
    id: "trakt.addon.default",
    transportUrl: "https://mytrakt.elfhosted.com/manifest.json",
    category: "tools",
    tags: ["free", "configurable"],
    curatorNote:
      "Two-way Trakt sync. Marks Stremio plays as Trakt scrobbles, pulls your watchlist + history back as catalogs.",
    rails: ["tools", "metadata"],
    recommended: 82,
  },
  {
    id: "com.stremio.rtngz",
    transportUrl: "https://72059fbbd1e5-stremio-addon-ratings.baby-beamup.club/manifest.json",
    category: "tools",
    tags: ["free"],
    curatorNote:
      "Shows IMDb, RT, MC, Letterboxd scores as fake stream rows on the detail page. Faster than alt-tabbing.",
    rails: ["tools"],
    recommended: 78,
  },
  {
    id: "community.ratings.aggregator",
    transportUrl: "https://rating-aggregator.elfhosted.com/manifest.json",
    category: "tools",
    tags: ["free"],
    curatorNote:
      "Rolls IMDb + RT + Metacritic + Letterboxd + TMDB into a single weighted score row.",
    rails: ["tools"],
    recommended: 73,
  },
  {
    id: "org.streailer.trailer",
    transportUrl: "https://streailer.elfhosted.com/manifest.json",
    category: "tools",
    tags: ["free"],
    curatorNote:
      "Adds trailers as a stream row. Plays them through your normal stream UI instead of a popup.",
    rails: ["tools"],
    recommended: 70,
  },
  {
    id: "com.elfhosted.watchly",
    transportUrl: "https://watchly.elfhosted.com/manifest.json",
    category: "tools",
    tags: ["free"],
    curatorNote: "Watch parties + sync sessions inside Stremio. Lightweight, no account required.",
    rails: ["tools"],
    recommended: 64,
  },
  {
    id: "au.itcon.aisearch",
    transportUrl: "https://stremio.itcon.au/aisearch/manifest.json",
    category: "tools",
    tags: ["free", "configurable"],
    curatorNote:
      'Natural-language search ("sci-fi movies with twist endings under 2 hours") via Gemini. Bring your own key.',
    rails: ["tools"],
    recommended: 58,
  },
  {
    id: "community.usatv",
    transportUrl: "https://848b3516657c-usatv.baby-beamup.club/manifest.json",
    category: "live-tv",
    tags: ["free"],
    curatorNote:
      "Free US live channels: local news, sports, entertainment, kids, documentaries, music, Latino. No subscription.",
    rails: ["essential", "sports"],
    recommended: 88,
  },
  {
    id: "org.stremio.vavoo.clean",
    transportUrl: "https://tvvoo.hayd.uk/cfg-it-uk-fr/manifest.json",
    category: "live-tv",
    tags: ["free"],
    curatorNote: "European IPTV (IT + UK + FR by default). Cleaner than raw M3U dumps.",
    warnings: ["Foreign-language by default. Configure for region."],
    rails: ["sports"],
    recommended: 70,
  },
  {
    id: "org.stremio.m3u-epg-addon",
    transportUrl:
      "https://stiptv.ddns.me/eyJwcm92aWRlciI6ImRpcmVjdCIsIm0zdVVybCI6Imh0dHBzOi8vaXB0di1vcmcuZ2l0aHViLmlvL2lwdHYvaW5kZXgubTN1IiwiZW5hYmxlRXBnIjpmYWxzZSwicHJlc2NhbiI6eyJlbnRyaWVzIjoxMDg2MiwiYXBwcm94VHYiOjEwNzUxLCJlcGdQcm9ncmFtbWVzIjowLCJlcGdDaGFubmVscyI6MH0sImluc3RhbmNlSWQiOiI4YWZkMzQ1NC02NjI5LTRiYTctYTdlYy0wNzdlZjc5ZTM1MGMifQ/manifest.json",
    category: "live-tv",
    tags: ["free", "configurable"],
    curatorNote:
      "Generic M3U/EPG addon. Point it at any IPTV-Org or custom playlist URL. Self-config encouraged.",
    rails: ["sports"],
    recommended: 60,
  },
  {
    id: "org.streamsppv.stremio",
    transportUrl: "https://addon3.gstream.stream/manifest.json",
    category: "sports",
    tags: ["free"],
    curatorNote:
      "PPV + live sports streams (NBA, NFL, soccer, UFC). Quality and uptime are sports-addon-typical (mid).",
    rails: ["sports"],
    recommended: 62,
  },
  {
    id: "pw.ers.porntube",
    transportUrl: "https://dirty-pink.ers.pw/manifest.json",
    category: "adult",
    tags: ["free", "configurable"],
    curatorNote: "Adult tube aggregator. Catalog + stream + meta. Hidden from default home rails.",
    warnings: ["18+ only."],
    nsfw: true,
    rails: ["adult"],
    recommended: 60,
  },
  {
    id: "org.masterchief.onlyporn",
    transportUrl: "https://07b88951aaab-jaxxx-v2.baby-beamup.club/manifest.json",
    category: "adult",
    tags: ["free"],
    curatorNote: "Alternative adult catalog. Smaller index than Porn Tube but different sources.",
    warnings: ["18+ only."],
    nsfw: true,
    rails: ["adult"],
    recommended: 55,
  },
];

export function curatedById(id: string): CuratedEntry | undefined {
  return CURATED_ADDONS.find((e) => e.id === id);
}

export function railEntries(railId: string): CuratedEntry[] {
  return CURATED_ADDONS.filter((e) => e.rails.includes(railId)).sort(
    (a, b) => (b.recommended ?? 0) - (a.recommended ?? 0),
  );
}

export function heroEntry(): CuratedEntry | undefined {
  return CURATED_ADDONS.find((e) => e.hero != null);
}
