import type { Stream, DebridSlug } from "@/lib/streams/types";

export type ExpectedFlags = {
  cached?: Partial<Record<DebridSlug, true>>;
  uncached?: Partial<Record<DebridSlug, true>>;
  seeders?: number | null;
  source?: string;
  resolution?: string;
  hdrFormat?: string | null;
  releaseGroup?: string | null;
  size?: number | null;
};

export type Sample = {
  addonId: string;
  addonName: string;
  raw: Stream;
  expected: ExpectedFlags;
  note?: string;
};

const PT2 = "AUDIT_PART2";

export const ADDON_SAMPLES: Sample[] = [
  {
    addonId: "community.comet",
    addonName: "Comet",
    note: `${PT2} Comet cached TB`,
    raw: {
      name: "[TB⚡] Comet 1080p",
      title: "Show.Title.S01E01.1080p.WEB-DL.x264-GROUP\n💾 5.43 GB | 👤 42 | 🇬🇧",
      infoHash: "0000000000000000000000000000000000000001",
      behaviorHints: { bingeGroup: "comet|torbox|hash|file" },
      addonId: "community.comet",
      addonName: "Comet",
    } as Stream,
    expected: { cached: { tb: true }, seeders: 42 },
  },
  {
    addonId: "community.comet",
    addonName: "Comet",
    note: `${PT2} Comet cached RD`,
    raw: {
      name: "[RD⚡] Comet 4K",
      title: "Movie.Name.2024.2160p.HDR.WEB-DL.x265\n💾 18.2 GB | 👤 117",
      infoHash: "0000000000000000000000000000000000000002",
      behaviorHints: { bingeGroup: "comet|realdebrid|hash|file" },
      addonId: "community.comet",
      addonName: "Comet",
    } as Stream,
    expected: { cached: { rd: true }, seeders: 117, hdrFormat: "HDR10" },
  },
  {
    addonId: "community.comet",
    addonName: "Comet",
    note: `${PT2} Comet uncached TB with VS-16`,
    raw: {
      name: "[TB⬇️] Comet 1080p",
      title: "Show.Title.S01E01.1080p.WEB-DL\n💾 5.43 GB | 👤 12",
      infoHash: "0000000000000000000000000000000000000003",
      addonId: "community.comet",
      addonName: "Comet",
    } as Stream,
    expected: { uncached: { tb: true }, seeders: 12 },
  },
  {
    addonId: "community.jackettio",
    addonName: "Jackettio",
    note: `${PT2} Jackettio cached RD`,
    raw: {
      name: "[RD+] Jackettio 1080p",
      title: "Show.Title.S01E02.1080p.WEB-DL.x264\n💾2.1 GB 👥87 ⚙️jackett-rarbg",
      infoHash: "0000000000000000000000000000000000000004",
      addonId: "community.jackettio",
      addonName: "Jackettio",
    } as Stream,
    expected: { cached: { rd: true }, seeders: 87 },
  },
  {
    addonId: "community.jackettio",
    addonName: "Jackettio",
    note: `${PT2} Jackettio uncached RD (bare bracket no plus)`,
    raw: {
      name: "[RD] Jackettio 1080p",
      title: "Movie.2023.1080p.x264\n💾4.7 GB 👥3 ⚙️jackett",
      infoHash: "0000000000000000000000000000000000000005",
      addonId: "community.jackettio",
      addonName: "Jackettio",
    } as Stream,
    expected: { uncached: { rd: true }, seeders: 3 },
  },
  {
    addonId: "community.knightcrawler",
    addonName: "Knightcrawler",
    note: `${PT2} Knightcrawler cached AD multiline name`,
    raw: {
      name: "[AD+] knightcrawler\n720p",
      title: "Show.Title.S05E10.720p.WEB-DL.x264-GROUP\n💾 1.4 GB",
      infoHash: "0000000000000000000000000000000000000006",
      behaviorHints: { bingeGroup: "knightcrawler|imdb|episode" },
      addonId: "community.knightcrawler",
      addonName: "Knightcrawler",
    } as Stream,
    expected: { cached: { ad: true } },
  },
  {
    addonId: "community.knightcrawler",
    addonName: "Knightcrawler",
    note: `${PT2} Knightcrawler uncached RD (literal "download" inside brackets)`,
    raw: {
      name: "[RD download] knightcrawler\n1080p | HDR10",
      title: "Movie.2024.1080p.HDR.WEB-DL.x265-GROUP\n💾 7.8 GB",
      infoHash: "0000000000000000000000000000000000000007",
      addonId: "community.knightcrawler",
      addonName: "Knightcrawler",
    } as Stream,
    expected: { uncached: { rd: true }, hdrFormat: "HDR10" },
  },
  {
    addonId: "com.stremio.torrentio.addon",
    addonName: "Torrentio",
    note: "AUDIT_PART1 Torrentio cached RD",
    raw: {
      name: "[RD+] Torrentio\n1080p",
      title: "Show.S01E01.1080p.WEB-DL.x264-GROUP\n👤 152 💾 2.1 GB ⚙️ TheRARBG",
      infoHash: "0000000000000000000000000000000000000010",
      addonId: "com.stremio.torrentio.addon",
      addonName: "Torrentio",
    } as Stream,
    expected: { cached: { rd: true }, seeders: 152 },
  },
  {
    addonId: "com.stremio.torrentio.addon",
    addonName: "Torrentio",
    note: "AUDIT_PART1 Torrentio uncached RD (download word)",
    raw: {
      name: "[RD download] Torrentio\n4K",
      title: "Movie.2024.2160p.UHD.BluRay.x265-GROUP\n👤 28 💾 25.4 GB",
      infoHash: "0000000000000000000000000000000000000011",
      addonId: "com.stremio.torrentio.addon",
      addonName: "Torrentio",
    } as Stream,
    expected: { uncached: { rd: true }, seeders: 28 },
  },
  {
    addonId: "community.mediafusion",
    addonName: "MediaFusion",
    note: "AUDIT_PART1 MediaFusion cached TRB (TorBox short name) free-floating",
    raw: {
      name: "MediaFusion 🧲 TRB ⚡️ 2160p",
      description: "📂 Movie.2024.2160p.WEB-DL.x265-GROUP\n📺 2160p 🎞️ x265 🎵 Atmos\n📦 18.5 GB\n🌐 English",
      infoHash: "0000000000000000000000000000000000000020",
      behaviorHints: { videoSize: 19864000000 },
      addonId: "community.mediafusion",
      addonName: "MediaFusion",
    } as Stream,
    expected: { cached: { tb: true } },
  },
  {
    addonId: "community.mediafusion",
    addonName: "MediaFusion",
    note: "AUDIT_PART1 MediaFusion uncached RD",
    raw: {
      name: "MediaFusion 🧲 RD ⏳ 1080p",
      description: "📂 Show.S01E01.1080p.WEB-DL\n📺 1080p 🎞️ x264\n📦 2.3 GB",
      infoHash: "0000000000000000000000000000000000000021",
      addonId: "community.mediafusion",
      addonName: "MediaFusion",
    } as Stream,
    expected: { uncached: { rd: true } },
  },
  {
    addonId: "community.aiostreams",
    addonName: "AIOStreams",
    note: "AUDIT_PART3 AIOStreams torrentio template cached RD",
    raw: {
      name: "[RD+] AIOStreams\n1080p",
      description: "Show.Title.S01E01.1080p.WEB-DL.x264\n💾 3.2 GB · 👤 102",
      infoHash: "0000000000000000000000000000000000000030",
      addonId: "community.aiostreams",
      addonName: "AIOStreams",
    } as Stream,
    expected: { cached: { rd: true }, seeders: 102 },
  },
  {
    addonId: "community.aiostreams",
    addonName: "AIOStreams",
    note: "AUDIT_PART3 AIOStreams torbox template (Instant) marker",
    raw: {
      name: "TorBox\n(Instant) (1080p)",
      description:
        "Quality: 1080p\nName: Movie.2024.1080p.WEB-DL\nSize: 4 GB | Source: yts | Type: Torrent | Seeders: 432",
      url: "https://torbox.app/api/play/abc123",
      addonId: "community.aiostreams",
      addonName: "AIOStreams",
    } as Stream,
    expected: { cached: { tb: true } },
  },
  {
    addonId: "community.streamfusion",
    addonName: "StreamFusion",
    note: "AUDIT_PART3 StreamFusion cached instant",
    raw: {
      name: "⚡instant\nReal-Debrid",
      description: "Movie.2024.1080p.WEB-DL.x264\n💾 4.5 GB · 👥 220",
      url: "https://stream.example/play/xyz",
      addonId: "community.streamfusion",
      addonName: "StreamFusion",
    } as Stream,
    expected: { cached: { rd: true }, seeders: 220 },
  },
  {
    addonId: "community.streamfusion",
    addonName: "StreamFusion",
    note: "AUDIT_PART3 StreamFusion uncached download (with ZWS contamination)",
    raw: {
      name: "⬇️​​download\nReal-Debrid",
      description: "Movie.2024.1080p.WEB-DL.x264\n💾 4.5 GB · 👥 7",
      infoHash: "0000000000000000000000000000000000000040",
      addonId: "community.streamfusion",
      addonName: "StreamFusion",
    } as Stream,
    expected: { uncached: { rd: true }, seeders: 7 },
  },
  {
    addonId: "community.easynews",
    addonName: "Easynews+",
    note: "AUDIT_PART3 Easynews always cached (no marker)",
    raw: {
      name: "Easynews+\n1080p",
      description: "The.Movie.2024.1080p.BluRay.x264-GROUP.mkv\n🕛 1h 58m\n📦 4.2 GB",
      url: "https://easynews.com/dl/abcdef.mkv",
      behaviorHints: {
        videoSize: 4509715660,
        fileName: "The.Movie.2024.1080p.BluRay.x264-GROUP",
        bingeGroup: "Easynews+-1080p",
      },
      addonId: "community.easynews",
      addonName: "Easynews+",
    } as Stream,
    expected: { resolution: "1080p" },
  },
  {
    addonId: "community.easynews-plus-plus",
    addonName: "Easynews++",
    note: "AUDIT_PART3 Easynews++ also no marker",
    raw: {
      name: "Easynews++\n4K",
      description: "Movie.4K.HDR.BluRay.x265.mkv\n🕛 2h 5m\n📦 22 GB",
      url: "https://easynews.com/dl/qrstuv.mkv",
      behaviorHints: { videoSize: 23622320128, bingeGroup: "Easynews++-4K" },
      addonId: "community.easynews-plus-plus",
      addonName: "Easynews++",
    } as Stream,
    expected: {},
  },
];
