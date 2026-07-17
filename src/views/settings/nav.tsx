import { useMemo, useState } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { activeLayout } from "@/lib/theme";
import { useView } from "@/lib/view";
import { matchesSettingsSearch } from "./search-match";
import { settingsAnchor, type SectionId } from "./shared";
import { markSectionSeen, useSettingsNew } from "./settings-new";

type IconProps = { size?: number; strokeWidth?: number };

const IconBase = ({
  size = 20,
  strokeWidth = 1.7,
  children,
}: IconProps & { children: React.ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {children}
  </svg>
);

function IconBasics(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.8 8.2l-2.3 5.3-5.3 2.3 2.3-5.3z" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="var(--color-canvas)" stroke="none" />
    </IconBase>
  );
}

function IconAccount(p: IconProps) {
  return (
    <IconBase {...p}>
      <rect x="4.5" y="3.5" width="15" height="17" rx="2.5" />
      <circle cx="12" cy="9.8" r="2.6" />
      <path d="M7.6 17.6c.9-2 2.6-3 4.4-3s3.5 1 4.4 3" />
    </IconBase>
  );
}

function IconLibrary(p: IconProps) {
  return (
    <IconBase {...p}>
      <rect x="3.5" y="3.5" width="7.5" height="9" rx="1.4" />
      <rect x="13" y="3.5" width="7.5" height="6" rx="1.4" />
      <rect x="3.5" y="14.5" width="7.5" height="6" rx="1.4" />
      <rect x="13" y="11" width="7.5" height="9.5" rx="1.4" />
    </IconBase>
  );
}

function IconRelay(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M10.5 10 Q 12 8 13.5 10" strokeWidth="1.4" />
      <path d="M8 7.5 Q 12 4.5 16 7.5" strokeWidth="1.4" />
      <path d="M5.5 5 Q 12 1 18.5 5" strokeWidth="1.4" />
      <path d="M8 12 V 20" strokeWidth="2.4" />
      <path d="M16 12 V 20" strokeWidth="2.4" />
      <path d="M8 16 H 16" strokeWidth="2.4" />
    </IconBase>
  );
}

function IconStreaming(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M12 5v14" strokeWidth={p.strokeWidth ?? 2} />
      <path d="M5 12h14" strokeWidth={p.strokeWidth ?? 2} />
    </IconBase>
  );
}

function IconFilters(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M4 5.5h16l-6.1 7.2v5.2l-3.8 1.9v-7.1z" />
    </IconBase>
  );
}

function IconP2P(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M16.6 6.8l2.8-1.2M16.8 10.4l2.6 1.1" strokeWidth="1.4" />
      <path d="M7.4 6.8 4.6 5.6M7.2 10.4 4.6 11.5" strokeWidth="1.4" />
      <path d="M12 3.2 13.7 6h-3.4z" fill="currentColor" stroke="none" />
      <rect x="9.9" y="6" width="4.2" height="2.7" rx="0.5" />
      <path d="M9 20.6 10.3 8.7h3.4L15 20.6z" />
      <path d="M9.6 12.4h4.8" />
      <path d="M7.3 20.6h9.4" strokeLinecap="round" />
    </IconBase>
  );
}

function IconLanguages(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M3.5 6.5h7" />
      <path d="M7 4.5v2" />
      <path d="M9.5 6.5c-.5 4-2.4 6.5-6 7.5" />
      <path d="M4 11.5c1.6 1.5 3.6 2.5 6 2.8" />
      <path d="M13 20l3.5-9 3.5 9" />
      <path d="M14.2 17.2h4.6" />
    </IconBase>
  );
}

function IconVideoTune(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M4 7h9M18.5 7H20" />
      <circle cx="15.5" cy="7" r="2" fill="currentColor" stroke="none" />
      <path d="M4 12h2.5M11.5 12H20" />
      <circle cx="8.5" cy="12" r="2" fill="currentColor" stroke="none" />
      <path d="M4 17h7.5M16.5 17H20" />
      <circle cx="13.5" cy="17" r="2" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

function IconAnime(p: IconProps) {
  return (
    <IconBase {...p}>
      <path
        d="M9.5 3l1.6 4.4 4.4 1.6-4.4 1.6L9.5 15l-1.6-4.4L3.5 9l4.4-1.6z"
        fill="currentColor"
        stroke="none"
      />
      <path
        d="M17 13l.8 2.2 2.2.8-2.2.8L17 19l-.8-2.2-2.2-.8 2.2-.8z"
        fill="currentColor"
        stroke="none"
      />
    </IconBase>
  );
}

function IconPlayer(p: IconProps) {
  return (
    <IconBase {...p}>
      <rect x="3" y="4.5" width="18" height="13" rx="2" />
      <path d="M10 9.2l4.8 2.8-4.8 2.8z" fill="currentColor" stroke="none" />
      <path d="M7 20.5h10" />
    </IconBase>
  );
}

function IconPlayerLayout(p: IconProps) {
  return (
    <IconBase {...p}>
      <rect x="3" y="4.5" width="18" height="13" rx="2" />
      <path d="M3 14.5h18" />
      <circle cx="7" cy="17" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="17" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14" cy="17" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

function IconHotkeys(p: IconProps) {
  return (
    <IconBase {...p}>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M6 14h12" strokeLinecap="round" />
    </IconBase>
  );
}

function IconAdvanced(p: IconProps) {
  return (
    <IconBase {...p}>
      <path
        d="M14.7 6.3a3.6 3.6 0 0 0-4.4 4.9l-5.7 5.7a1.7 1.7 0 0 0 2.4 2.4l5.7-5.7a3.6 3.6 0 0 0 4.9-4.4l-2.4 2.4-2-.5-.5-2z"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

function IconBug(p: IconProps) {
  return (
    <IconBase {...p}>
      <rect x="7.5" y="7.5" width="9" height="11" rx="4.5" />
      <path d="M9 4.5l1.5 2.5M15 4.5l-1.5 2.5" />
      <path d="M3.5 11.5h4M16.5 11.5h4" />
      <path d="M3.5 16.5l3-1.5M16.5 15l4 1.5" />
      <path d="M3.5 7l3 2M20.5 7l-3 2" />
    </IconBase>
  );
}

function IconTheme(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17 2.5 2.5 0 0 0 2.5-2.5c0-.7-.3-1.3-.7-1.8-.4-.5-.7-1-.7-1.7a2.5 2.5 0 0 1 2.5-2.5h1.4a4 4 0 0 0 4-4 8.5 8.5 0 0 0-9-4.5z" />
      <circle cx="7.5" cy="10" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="9.5" r="1.1" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

function IconWebhooks(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="6" cy="17.5" r="2.4" />
      <circle cx="18" cy="17.5" r="2.4" />
      <circle cx="12" cy="6.5" r="2.4" />
      <path d="M10.4 8.4 7.2 15.4" />
      <path d="M13.6 8.4 16.8 15.4" />
      <path d="M8.4 17.5h7.2" />
    </IconBase>
  );
}

function IconTrakt(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M6 13.5l4-4 6 6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 9.5l4-4 8 8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function IconAnilist(p: IconProps) {
  return (
    <IconBase {...p}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <path d="M8 16.5l3-9 3 9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 13.5h4" strokeLinecap="round" />
      <path d="M15.5 7.5v9h2" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function IconMal(p: IconProps) {
  return (
    <IconBase {...p}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <path d="M6 15V9l2.5 3 2.5-3v6" strokeLinejoin="round" />
      <path d="M11.5 15 13.25 9 15 15" strokeLinejoin="round" />
      <path d="M12.2 12.5h2.1" />
      <path d="M15.5 9v6h3.8" strokeLinejoin="round" />
    </IconBase>
  );
}

function IconSimkl(p: IconProps) {
  return (
    <IconBase {...p}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path
        d="M15 9c-2.4-1.3-4.8-.4-4.8 1.5 0 2.4 4.6 1.8 4.6 4 0 1.8-2.6 2.4-5 1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function IconLetterboxd(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="5" cy="12" r="3.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="3.5" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

type NavItem = {
  id: SectionId;
  label: string;
  Icon: (p: IconProps) => React.ReactElement;
  keywords?: string[];
};

const NAV_GROUPS: Array<{ heading: string | null; items: NavItem[] }> = [
  {
    heading: null,
    items: [
      {
        id: "basics",
        label: "Get started",
        Icon: IconBasics,
        keywords: [
          "basics",
          "get started",
          "getting started",
          "setup",
          "quick start",
          "essentials",
          "beginner",
          "new user",
          "first time",
          "easy",
        ],
      },
    ],
  },
  {
    heading: "Account",
    items: [
      {
        id: "account",
        label: "Account",
        Icon: IconAccount,
        keywords: ["stremio", "sign in", "login", "profile", "logout"],
      },
      {
        id: "library",
        label: "Library & metadata",
        Icon: IconLibrary,
        keywords: [
          "tmdb",
          "omdb",
          "rpdb",
          "fanart",
          "tvdb",
          "metadata",
          "api key",
          "ratings",
          "posters",
        ],
      },
      {
        id: "trakt",
        label: "Trakt",
        Icon: IconTrakt,
        keywords: ["scrobble", "history", "sync", "watchlist"],
      },
      {
        id: "anilist",
        label: "AniList",
        Icon: IconAnilist,
        keywords: ["anime", "lists", "watching", "kitsu"],
      },
      {
        id: "mal",
        label: "MyAnimeList",
        Icon: IconMal,
        keywords: ["mal", "myanimelist", "anime", "lists", "watching", "jikan"],
      },
      {
        id: "simkl",
        label: "Simkl",
        Icon: IconSimkl,
        keywords: ["scrobble", "sync", "watched", "history", "watchlist", "anime"],
      },
      {
        id: "letterboxd",
        label: "Letterboxd",
        Icon: IconLetterboxd,
        keywords: ["letterboxd", "stremboxd", "watchlist", "diary", "films", "ratings", "friends"],
      },
    ],
  },
  {
    heading: "Streaming",
    items: [
      {
        id: "relay",
        label: "Harbor Relay",
        Icon: IconRelay,
        keywords: ["together", "watch party", "p2p", "host", "share"],
      },
      {
        id: "streaming",
        label: "Streaming sources",
        Icon: IconStreaming,
        keywords: [
          "debrid",
          "real-debrid",
          "alldebrid",
          "premiumize",
          "torbox",
          "torrentio",
          "mediafusion",
          "scrapers",
          "addons",
          "iptv",
          "m3u",
          "xtream",
        ],
      },
      {
        id: "streamFilters",
        label: "Stream filters",
        Icon: IconFilters,
        keywords: [
          "stream filter",
          "custom filter",
          "saved filter",
          "quality filter",
          "resolution",
          "codec",
          "hdr",
          "cached only",
          "seeders",
          "max size",
          "hide cam",
          "only 4k",
        ],
      },
      {
        id: "p2p",
        label: "P2P & servers",
        Icon: IconP2P,
        keywords: [
          "p2p",
          "peer to peer",
          "torrent engine",
          "local engine",
          "librqbit",
          "built-in engine",
          "rust engine",
          "self-test",
          "self test",
          "peer test",
          "restart engine",
          "clear and restart",
          "streaming server",
          "server address",
          "localhost",
          "11470",
          "11471",
          "remote server",
          "stremio server",
          "direct torrent",
          "seeders",
          "connecting",
          "dht",
          "download whole file",
          "full download",
          "prebuffer",
          "buffer ahead",
          "remux",
          "scrub freely",
          "webdav",
        ],
      },
    ],
  },
  {
    heading: "Playback",
    items: [
      {
        id: "player",
        label: "Player & quality",
        Icon: IconPlayer,
        keywords: [
          "mpv",
          "html5",
          "engine",
          "quality",
          "hdr",
          "passthrough",
          "audio",
          "transcode",
          "tonemap",
          "true hdr",
          "separate window",
          "hdr no ui",
          "hdr controls missing",
          "brightness dimming",
          "washed out",
          "dolby vision",
        ],
      },
      {
        id: "mpv",
        label: "Video tuning",
        Icon: IconVideoTune,
        keywords: [
          "mpv",
          "advanced mpv",
          "mpv.conf",
          "mpv options",
          "video quality",
          "picture quality",
          "performance",
          "potato",
          "low end",
          "weak pc",
          "shit computer",
          "hardware decoding",
          "hwdec",
          "buffer",
          "downmix",
          "upscaling",
          "scaling",
          "tonemap",
          "tuning",
          "quality preset",
        ],
      },
      {
        id: "anime",
        label: "Anime tweaks",
        Icon: IconAnime,
        keywords: [
          "anime",
          "anime4k",
          "anime 4k",
          "upscale",
          "upscaling",
          "shaders",
          "smooth motion",
          "motion smoothing",
          "interpolation",
          "svp",
          "smoothvideo",
          "frame interpolation",
          "60fps",
          "48fps",
          "fluid",
        ],
      },
      {
        id: "playerLayout",
        label: "Player layout",
        Icon: IconPlayerLayout,
        keywords: ["controls", "ui", "overlay", "skip", "trickplay", "thumbnail"],
      },
      {
        id: "hotkeys",
        label: "Hotkeys",
        Icon: IconHotkeys,
        keywords: ["shortcuts", "keys", "keyboard", "bindings"],
      },
      {
        id: "language",
        label: "Languages",
        Icon: IconLanguages,
        keywords: ["subtitles", "audio", "preferred", "tracks", "opensubtitles"],
      },
    ],
  },
  {
    heading: "Appearance",
    items: [
      {
        id: "theme",
        label: "Theme & appearance",
        Icon: IconTheme,
        keywords: [
          "theme",
          "color",
          "font",
          "layout",
          "wallpaper",
          "card",
          "minui",
          "aurora",
          "velvet",
          "custom",
        ],
      },
    ],
  },
  {
    heading: "Notifications",
    items: [
      {
        id: "webhooks",
        label: "Webhooks",
        Icon: IconWebhooks,
        keywords: ["discord", "telegram", "calendar", "alerts", "notifications", "rules"],
      },
    ],
  },
  {
    heading: "Help",
    items: [
      {
        id: "bug",
        label: "Report a bug",
        Icon: IconBug,
        keywords: ["report", "feedback", "issue", "crash"],
      },
    ],
  },
  {
    heading: "System",
    items: [
      {
        id: "advanced",
        label: "Advanced",
        Icon: IconAdvanced,
        keywords: ["dev", "logs", "cache", "reset", "experimental", "ffmpeg", "yt-dlp"],
      },
    ],
  },
];

type SettingsOption = {
  label: string;
  section: SectionId;
  anchorTitle?: string;
  keywords?: string[];
};

const SETTINGS_OPTIONS: SettingsOption[] = [
  {
    label: "Play button behavior",
    section: "player",
    anchorTitle: "Play button behavior",
    keywords: [
      "play mode",
      "instant",
      "instant play",
      "autoplay",
      "auto start",
      "manual picker",
      "choose stream",
      "source picker",
      "quality picker",
    ],
  },
  {
    label: "Player engine",
    section: "player",
    anchorTitle: "Player engine",
    keywords: [
      "mpv",
      "html5",
      "engine",
      "playback",
      "embed mpv",
      "inline",
      "separate window",
      "hdr",
      "sdr",
      "tonemap",
      "tonemapping",
      "hdr display mode",
      "hdr separate window",
      "opaque",
      "passthrough",
      "line-free",
      "line free",
      "brightness line",
      "motion smoothing",
      "frame interpolation",
      "direct torrent",
      "stremio server",
      "built-in engine",
      "rust engine",
      "p2p",
      "re-encode",
      "transcode",
      "cast",
      "dlna",
      "anime4k",
      "upscale",
      "upscaling",
      "anime4k indicator",
      "fps",
      "av1",
      "dts-hd",
      "truehd",
      "codec",
    ],
  },
  {
    label: "Aspect ratio",
    section: "player",
    anchorTitle: "Aspect ratio",
    keywords: [
      "aspect ratio",
      "fit",
      "fill",
      "zoom",
      "crop",
      "stretch",
      "black bars",
      "widescreen",
      "4:3",
      "16:9",
      "21:9",
    ],
  },
  {
    label: "Seek bar",
    section: "theme",
    anchorTitle: "Seek bar",
    keywords: [
      "seek",
      "seek bar",
      "scrubber",
      "progress",
      "timeline",
      "thumbnail preview",
      "trickplay",
      "hover preview",
      "bar style",
      "flat",
      "glass",
      "pinstripe",
      "rainbow",
      "bar height",
      "bar color",
      "bar image",
      "seek dot",
      "dot shape",
      "circle",
      "square",
      "custom dot",
      "hidden dot",
      "dot size",
      "nyan cat",
      "sticker",
    ],
  },
  {
    label: "Subtitle style",
    section: "language",
    anchorTitle: "Subtitle style",
    keywords: [
      "subtitle",
      "subtitles",
      "subs",
      "caption",
      "sub style",
      "drop shadow",
      "outline",
      "black bar",
      "ass",
      "styled subs",
      "background opacity",
      "outline thickness",
      "bold",
      "pip subtitles",
      "picture in picture",
      "subtitle size",
      "subtitle opacity",
      "distance from bottom",
      "margin",
      "alignment",
      "left",
      "center",
      "right",
      "text color",
      "outline color",
      "box color",
      "font",
      "inter",
      "rounded",
      "serif",
      "arabic font",
      "upload font",
      "custom font",
      "reset",
    ],
  },
  {
    label: "Stream format chips",
    section: "theme",
    anchorTitle: "Stream format chips",
    keywords: [
      "format chips",
      "quality badge",
      "resolution chip",
      "hdr chip",
      "codec tag",
      "audio format",
      "badges on rows",
      "4k badge",
    ],
  },
  {
    label: "Poster size",
    section: "theme",
    anchorTitle: "Poster size",
    keywords: [
      "poster size",
      "card size",
      "compact",
      "default",
      "large",
      "huge",
      "scale",
      "grid",
      "bigger posters",
    ],
  },
  {
    label: "Row & player title size",
    section: "theme",
    anchorTitle: "Title text",
    keywords: [
      "title",
      "text size",
      "row title",
      "player title",
      "series first",
      "series name first",
      "episode name",
      "header",
      "font size",
      "bigger text",
    ],
  },
  {
    label: "Interface scale (accessibility)",
    section: "theme",
    anchorTitle: "Accessibility",
    keywords: [
      "accessibility",
      "interface scale",
      "ui scale",
      "zoom",
      "readability",
      "4k display",
      "ultrawide",
      "bigger ui",
      "text size",
    ],
  },
  {
    label: "Trailer quality",
    section: "theme",
    anchorTitle: "Trailer quality",
    keywords: [
      "trailer",
      "trailer quality",
      "youtube",
      "ytdl",
      "ytdlp",
      "360p",
      "720p",
      "1080p",
      "best",
    ],
  },
  {
    label: "Audio (normalize, bass, night mode)",
    section: "player",
    anchorTitle: "Audio",
    keywords: [
      "audio",
      "normalize loudness",
      "audio normalize",
      "normalization",
      "loudness",
      "dialogue",
      "dynamic",
      "loud",
      "distorted",
      "boost",
      "audio profile",
      "bass boost",
      "vocal clarity",
      "voice",
      "less bass",
      "night mode",
      "compress",
      "equalizer",
      "eq",
    ],
  },
  {
    label: "Skip intros",
    section: "player",
    anchorTitle: "Skip intros",
    keywords: [
      "skip intro",
      "skip intros",
      "skip opening",
      "auto-skip",
      "auto skip",
      "aniskip",
      "theintroodb",
      "skip button",
    ],
  },
  {
    label: "Next episode prompt & auto-play",
    section: "player",
    anchorTitle: "Next episode prompt",
    keywords: [
      "next episode",
      "up next",
      "prompt",
      "timing",
      "autoplay",
      "auto-play next",
      "auto play next episode",
      "continuous",
      "credits",
      "pill",
      "binge",
    ],
  },
  {
    label: "Hide watched in catalogs",
    section: "library",
    anchorTitle: "Home layout",
    keywords: [
      "hide watched",
      "hide finished",
      "watched filter",
      "catalog filter",
      "trakt history",
      "seen",
    ],
  },
  {
    label: "Downloads folder",
    section: "advanced",
    anchorTitle: "Downloads",
    keywords: [
      "downloads",
      "download folder",
      "location",
      "directory",
      "save",
      "path",
      "choose folder",
      "open folder",
    ],
  },
  {
    label: "Local torrent engine",
    section: "p2p",
    anchorTitle: "Local engine",
    keywords: [
      "local engine",
      "torrent engine",
      "p2p",
      "librqbit",
      "self-test",
      "self test",
      "restart engine",
      "peer test",
      "connectivity",
    ],
  },
  {
    label: "Your streaming server address",
    section: "p2p",
    anchorTitle: "Your streaming server address",
    keywords: [
      "streaming server",
      "server address",
      "localhost",
      "wifi",
      "lan",
      "start server",
      "stop server",
      "restart server",
      "harbor in browser",
      "web ui",
      "11470",
      "11471",
      "web version",
      "use exclusively",
      "strict",
    ],
  },
  {
    label: "Remote streaming server",
    section: "p2p",
    anchorTitle: "Remote streaming server",
    keywords: [
      "remote server",
      "server url",
      "ip address",
      "test connection",
      "forget server",
      "use exclusively",
      "strict",
      "vpn",
      "home server",
      "stremio service",
    ],
  },
  {
    label: "Anime4K presets & modes",
    section: "player",
    anchorTitle: "Anime4K presets",
    keywords: [
      "anime4k",
      "setup",
      "download shaders",
      "install anime4k",
      "re-download",
      "quality",
      "performance",
      "mode a",
      "mode b",
      "mode c",
      "apply to anime only",
      "anime detection",
    ],
  },
  {
    label: "Internet speed / bandwidth",
    section: "player",
    anchorTitle: "Internet speed",
    keywords: [
      "internet speed",
      "bandwidth",
      "cap",
      "limit",
      "mbps",
      "gbps",
      "speed test",
      "fiber",
      "gigabit",
      "data",
    ],
  },
  {
    label: "Remember last stream",
    section: "player",
    anchorTitle: "Remember last stream",
    keywords: [
      "remember last stream",
      "resume stream",
      "last source",
      "addon memory",
      "source memory",
    ],
  },
  {
    label: "Custom CSS / JS / HTML code",
    section: "advanced",
    anchorTitle: "Custom code",
    keywords: [
      "custom code",
      "custom css",
      "custom js",
      "javascript",
      "custom html overlay",
      "inject",
      "mod",
      "power user",
      "retheme",
    ],
  },

  {
    label: "Picture quality (weak PC / balanced / max)",
    section: "mpv",
    anchorTitle: "Picture quality",
    keywords: [
      "picture quality",
      "video quality",
      "performance",
      "potato",
      "weak pc",
      "low end",
      "old computer",
      "slow",
      "max quality",
      "upscaling",
      "scaling",
      "quality preset",
      "mpv profile",
      "gpu load",
    ],
  },
  {
    label: "Hardware acceleration (hwdec)",
    section: "mpv",
    anchorTitle: "Hardware acceleration",
    keywords: [
      "hardware acceleration",
      "hwdec",
      "gpu decoding",
      "graphics card",
      "cpu",
      "decode",
      "battery",
    ],
  },
  {
    label: "Picture adjustments (brightness, contrast, sharpen)",
    section: "mpv",
    anchorTitle: "Picture adjustments",
    keywords: [
      "brightness",
      "contrast",
      "saturation",
      "gamma",
      "sharpen",
      "sharpness",
      "picture",
      "image",
      "too dark",
      "dark scenes",
      "vivid",
      "punchy color",
      "dim",
      "calibrate",
    ],
  },
  {
    label: "Color & HDR tone-mapping",
    section: "mpv",
    anchorTitle: "Color & HDR",
    keywords: [
      "tone-mapping",
      "tonemap",
      "hdr",
      "inverse tone mapping",
      "sdr to hdr",
      "color curve",
      "bt.2390",
      "hable",
      "mobius",
      "reinhard",
      "washed out",
    ],
  },
  {
    label: "Bigger buffer for slow connections",
    section: "mpv",
    anchorTitle: "Slow or unstable connection",
    keywords: [
      "buffer",
      "buffering",
      "slow connection",
      "unstable",
      "wifi",
      "cache",
      "readahead",
      "stutter",
      "pausing",
    ],
  },
  {
    label: "Downmix surround to stereo",
    section: "mpv",
    anchorTitle: "Audio",
    keywords: [
      "downmix",
      "stereo",
      "surround",
      "5.1",
      "7.1",
      "laptop speakers",
      "headphones",
      "quiet dialogue",
      "audio channels",
    ],
  },
  {
    label: "Advanced mpv options (mpv.conf)",
    section: "mpv",
    anchorTitle: "Advanced (mpv.conf)",
    keywords: [
      "advanced mpv",
      "mpv.conf",
      "mpv options",
      "extra options",
      "tone-mapping",
      "inverse tone mapping",
      "custom mpv",
      "key=value",
      "power user",
      "raw config",
    ],
  },

  {
    label: "Anime4K upscaling",
    section: "anime",
    anchorTitle: "Anime4K upscaling",
    keywords: [
      "anime4k",
      "anime 4k",
      "upscale",
      "upscaling",
      "shaders",
      "sharper anime",
      "anime only",
      "anime4k indicator",
      "fps badge",
      "gpu upscale",
    ],
  },
  {
    label: "Smooth motion (interpolation) & SVP",
    section: "anime",
    anchorTitle: "Smooth motion",
    keywords: [
      "smooth motion",
      "motion smoothing",
      "interpolation",
      "frame interpolation",
      "svp",
      "smoothvideo",
      "60fps",
      "48fps",
      "fluid",
      "judder",
      "soap opera",
      "vapoursynth",
    ],
  },

  {
    label: "Home layout",
    section: "library",
    anchorTitle: "Home layout",
    keywords: [
      "home layout",
      "rails",
      "rows",
      "addon rows",
      "duplicate rails",
      "watchlist saved only",
      "playlists tab",
      "m3u",
      "xtream",
      "keep anime in anime room",
      "continue watching advance",
      "advance next episode",
    ],
  },
  {
    label: "Spoilers (blur)",
    section: "library",
    anchorTitle: "Spoilers",
    keywords: [
      "spoiler",
      "spoilers",
      "blur",
      "blur thumbnails",
      "blur titles",
      "blur descriptions",
      "hide spoilers",
      "next episode visible",
    ],
  },
  {
    label: "Continue Watching screenshots",
    section: "library",
    anchorTitle: "Continue Watching screenshots",
    keywords: [
      "continue watching",
      "screenshots",
      "snapshots",
      "frames",
      "retention",
      "clear frames",
      "storage",
    ],
  },
  {
    label: "Region & language",
    section: "library",
    anchorTitle: "Region & language",
    keywords: ["region", "country", "availability", "location", "iso"],
  },
  {
    label: "Metadata providers (TMDB, OMDb, RPDB, MDBList, Fanart, TVDB)",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: [
      "metadata",
      "tmdb",
      "omdb",
      "rpdb",
      "mdblist",
      "letterboxd",
      "fanart",
      "tvdb",
      "api key",
      "ratings",
      "scores",
      "custom poster service",
      "btttr",
      "posters",
      "hide titles under posters",
      "imdb score",
      "rotten tomatoes",
      "mal score",
      "hover preview",
      "peek",
      "badge position",
    ],
  },
  {
    label: "Content filters (hide anime / live tv / sports / adult)",
    section: "library",
    anchorTitle: "Content filters",
    keywords: [
      "content filters",
      "hide anime",
      "hide live tv",
      "hide sports",
      "hide adult",
      "age",
      "filter",
    ],
  },

  {
    label: "Display language",
    section: "language",
    anchorTitle: "Display language",
    keywords: [
      "display language",
      "ui language",
      "interface language",
      "rtl",
      "arabic",
      "menus",
      "buttons",
      "translation",
    ],
  },
  {
    label: "Subtitle languages & autoload",
    section: "language",
    anchorTitle: "Subtitle languages",
    keywords: [
      "subtitle languages",
      "preferred subs",
      "start with subtitles off",
      "subs off",
      "prefer embedded",
      "forced subs",
      "native audio",
      "never auto-select",
      "block tracks",
      "commentary",
      "descriptive",
    ],
  },
  {
    label: "Metadata language",
    section: "language",
    anchorTitle: "Metadata language",
    keywords: ["metadata language", "tmdb titles", "overviews", "taglines", "translation"],
  },
  {
    label: "Audio languages",
    section: "language",
    anchorTitle: "Audio languages",
    keywords: ["audio languages", "dub", "audio tracks", "preferred audio"],
  },
  {
    label: "Preferred languages",
    section: "language",
    anchorTitle: "Preferred languages",
    keywords: [
      "preferred languages",
      "rank",
      "priority",
      "only show my languages",
      "filter streams",
      "multi-audio",
    ],
  },

  {
    label: "Stream safety filter",
    section: "streaming",
    anchorTitle: "Stream safety filter",
    keywords: [
      "safety filter",
      "stream filter",
      "shady",
      "mismatched",
      "scam",
      "fake",
      "rejection",
      "aggression",
      "filter level",
    ],
  },
  {
    label: "Picker layout (Condensed / Stremio)",
    section: "streaming",
    anchorTitle: "Picker layout",
    keywords: ["picker layout", "condensed", "stremio", "sources", "drawer", "list"],
  },
  {
    label: "Result order (ranking / addon order)",
    section: "streaming",
    anchorTitle: "Result order",
    keywords: ["result order", "ranking", "addon order", "sort", "priority", "sequence", "vidi"],
  },
  {
    label: "Debrid services (RealDebrid / TorBox / AllDebrid / Premiumize / Debrid-Link)",
    section: "streaming",
    anchorTitle: "Debrid services",
    keywords: [
      "debrid",
      "real-debrid",
      "realdebrid",
      "torbox",
      "alldebrid",
      "premiumize",
      "debrid-link",
      "api token",
      "cache",
      "rd",
      "tb",
    ],
  },
  {
    label: "Usenet (Easynews+)",
    section: "streaming",
    anchorTitle: "Usenet",
    keywords: ["usenet", "easynews", "nzb", "addon"],
  },
  {
    label: "Streaming catalogs (Netflix, Disney+, etc.)",
    section: "streaming",
    anchorTitle: "Streaming catalogs",
    keywords: [
      "streaming catalogs",
      "netflix",
      "disney",
      "hulu",
      "prime",
      "apple tv",
      "max",
      "paramount",
      "peacock",
      "providers",
      "services",
    ],
  },

  {
    label: "Watch Together relay",
    section: "relay",
    anchorTitle: "Harbor Relay",
    keywords: ["watch together", "relay", "party", "p2p", "host", "cloudflare", "deploy", "share"],
  },

  {
    label: "Theme preset",
    section: "theme",
    anchorTitle: "Theme",
    keywords: [
      "theme",
      "color",
      "preset",
      "cool grey",
      "warm gold",
      "deep purple",
      "sunset orange",
      "rose pink",
      "custom theme",
      "palette",
      "dark",
      "appearance",
    ],
  },
  {
    label: "Background image / wallpaper",
    section: "theme",
    anchorTitle: "Background image",
    keywords: [
      "background",
      "wallpaper",
      "image",
      "choose image",
      "replace",
      "remove",
      "dim overlay",
    ],
  },
  {
    label: "Typography & custom fonts",
    section: "theme",
    anchorTitle: "Typography",
    keywords: [
      "typography",
      "font",
      "display font",
      "body font",
      "serif",
      "sans",
      "font pair",
      "custom font",
      "fraunces",
      "inter",
      "upload font",
    ],
  },
  {
    label: "Theme Studio / your themes",
    section: "theme",
    anchorTitle: "Your themes",
    keywords: [
      "theme studio",
      "custom theme",
      "editor",
      "browse theme library",
      "import theme",
      "your themes",
      "card css",
    ],
  },
  {
    label: "Window title bar",
    section: "theme",
    anchorTitle: "Window title bar",
    keywords: ["window title bar", "native title bar", "system title bar", "decorations"],
  },
  {
    label: "Home hero shadow",
    section: "theme",
    anchorTitle: "Home hero shadow",
    keywords: [
      "hero shadow",
      "home hero",
      "hero gradient",
      "featured title",
      "darken hero",
      "backdrop shadow",
      "gradient overlay",
      "show artwork",
    ],
  },

  {
    label: "Updates & rollback",
    section: "advanced",
    anchorTitle: "Updates",
    keywords: [
      "updates",
      "version",
      "check for updates",
      "beta updates",
      "roll back",
      "rollback",
      "downgrade",
      "previous version",
      "build feedback",
    ],
  },
  {
    label: "Backup & restore",
    section: "advanced",
    anchorTitle: "Backup & restore",
    keywords: ["backup", "restore", "export", "import", "settings file"],
  },
  {
    label: "Privacy & tracker blocking",
    section: "advanced",
    anchorTitle: "Privacy",
    keywords: ["privacy", "block ads", "trackers", "analytics", "telemetry", "ad blocker"],
  },
  {
    label: "System tray & window behavior",
    section: "advanced",
    anchorTitle: "System tray",
    keywords: [
      "system tray",
      "close to tray",
      "minimize",
      "always on top",
      "pause when minimized",
      "pause when unfocused",
      "background",
    ],
  },
  {
    label: "Stremio install links",
    section: "advanced",
    anchorTitle: "Stremio install links",
    keywords: ["stremio install links", "deeplink", "protocol handler", "install addon"],
  },
  {
    label: "Discord Rich Presence",
    section: "advanced",
    anchorTitle: "Discord Rich Presence",
    keywords: [
      "discord",
      "rich presence",
      "now watching",
      "status",
      "hide title",
      "show while paused",
      "browsing",
      "poster",
      "elapsed time",
      "watch party join",
    ],
  },
  {
    label: "API budget (OMDb)",
    section: "advanced",
    anchorTitle: "API budget",
    keywords: ["api budget", "omdb budget", "daily requests", "counter", "rate limit"],
  },
  {
    label: "Onboarding & hints",
    section: "advanced",
    anchorTitle: "Onboarding",
    keywords: ["onboarding", "walkthrough", "tutorial", "replay", "restore hints", "tips"],
  },
  {
    label: "Stremio library repair",
    section: "advanced",
    anchorTitle: "Stremio library repair",
    keywords: ["stremio library repair", "fix library", "schema", "repair"],
  },
  {
    label: "About (version / build)",
    section: "advanced",
    anchorTitle: "About",
    keywords: ["about", "version", "build", "platform", "bug reports"],
  },

  {
    label: "Harbor identity (avatar / color)",
    section: "account",
    anchorTitle: "Harbor identity",
    keywords: ["avatar", "profile photo", "upload photo", "color", "identity", "picture"],
  },
  {
    label: "Stremio account (email / sign out)",
    section: "account",
    anchorTitle: "Stremio account",
    keywords: ["stremio", "email", "sign out", "logout", "re-authenticate", "login", "account"],
  },
  {
    label: "Synced addons",
    section: "account",
    anchorTitle: "Synced addons",
    keywords: ["synced addons", "addons", "stremio addons", "installed addons"],
  },

  {
    label: "Trakt connection",
    section: "trakt",
    keywords: [
      "trakt",
      "scrobble",
      "sync",
      "watchlist",
      "connect",
      "disconnect",
      "avatar",
      "history",
    ],
  },
  {
    label: "AniList connection",
    section: "anilist",
    keywords: [
      "anilist",
      "anime",
      "lists",
      "sync",
      "connect",
      "disconnect",
      "avatar",
      "watch progress",
      "mal",
      "kitsu",
    ],
  },
  {
    label: "Simkl connection",
    section: "simkl",
    keywords: ["simkl", "sync", "watched", "watchlist", "connect", "disconnect", "avatar", "anime"],
  },
  {
    label: "Letterboxd connection",
    section: "letterboxd",
    keywords: [
      "letterboxd",
      "stremboxd",
      "watchlist",
      "diary",
      "films",
      "ratings",
      "friends",
      "connect",
      "disconnect",
      "top 250",
      "popular",
    ],
  },
  {
    label: "Webhooks (Discord / Telegram)",
    section: "webhooks",
    keywords: [
      "webhooks",
      "discord",
      "telegram",
      "notifications",
      "alerts",
      "calendar sources",
      "rules",
      "upcoming",
    ],
  },
  {
    label: "Hotkeys / keyboard shortcuts",
    section: "hotkeys",
    keywords: ["hotkeys", "shortcuts", "keybindings", "keyboard", "rebind", "reset shortcuts"],
  },
  {
    label: "Player layout / chrome",
    section: "playerLayout",
    keywords: [
      "player layout",
      "chrome",
      "controls",
      "buttons",
      "overlay",
      "arrange",
      "rearrange",
      "trickplay",
      "thumbnail",
      "hide buttons",
    ],
  },
  {
    label: "Report a bug",
    section: "bug",
    keywords: ["bug report", "report", "feedback", "issue", "crash", "screenshot", "diagnostics"],
  },

  {
    label: "Sign in to Stremio",
    section: "basics",
    keywords: ["sign in", "login", "stremio account", "sync", "manage account", "email", "log in"],
  },
  {
    label: "Streaming quality",
    section: "basics",
    keywords: [
      "debrid",
      "real-debrid",
      "torbox",
      "alldebrid",
      "instant hd",
      "quality",
      "set up",
      "sources",
    ],
  },
  {
    label: "How Play works",
    section: "basics",
    anchorTitle: "How Play works",
    keywords: [
      "instant",
      "manual picker",
      "play mode",
      "source picker",
      "autoplay",
      "best stream",
      "play button",
      "recommended",
    ],
  },
  {
    label: "Languages",
    section: "basics",
    keywords: ["language", "audio language", "subtitle language", "preferred languages"],
  },
  {
    label: "Theme & appearance",
    section: "basics",
    keywords: ["theme", "appearance", "recolor", "fonts", "poster size", "wallpaper", "customize"],
  },
  {
    label: "Harbor identity",
    section: "account",
    anchorTitle: "Harbor identity",
    keywords: [
      "display name",
      "nickname",
      "rename",
      "edit name",
      "watch together name",
      "identity",
      "profile",
    ],
  },
  {
    label: "Upload photo",
    section: "account",
    anchorTitle: "Harbor identity",
    keywords: ["avatar", "upload", "profile picture", "custom photo", "image", "change avatar"],
  },
  {
    label: "or use one of our avatars",
    section: "account",
    anchorTitle: "Harbor identity",
    keywords: [
      "avatar catalog",
      "built-in avatars",
      "browse avatars",
      "picker",
      "characters",
      "netflix style",
    ],
  },
  {
    label: "Random avatar",
    section: "account",
    anchorTitle: "Harbor identity",
    keywords: ["random", "shuffle", "surprise avatar", "dice"],
  },
  {
    label: "Reset to Stremio avatar",
    section: "account",
    anchorTitle: "Harbor identity",
    keywords: ["reset avatar", "default avatar", "remove photo", "revert", "reset to default"],
  },
  {
    label: "Your color",
    section: "account",
    anchorTitle: "Harbor identity",
    keywords: [
      "color",
      "cursor color",
      "chat color",
      "name pill",
      "custom color",
      "hex picker",
      "swatch",
    ],
  },
  {
    label: "Profiles (switch, add, edit)",
    section: "account",
    anchorTitle: "Harbor identity",
    keywords: [
      "profiles",
      "profile",
      "who's watching",
      "whos watching",
      "who is watching",
      "switch profile",
      "add profile",
      "new profile",
      "edit profile",
      "manage profiles",
      "default profile",
      "kids profile",
      "child profile",
      "multiple profiles",
      "profile screen",
      "startup profile",
      "household",
    ],
  },
  {
    label: "Sign in",
    section: "account",
    anchorTitle: "Stremio account",
    keywords: ["login", "sign in", "stremio", "connect account", "not signed in"],
  },
  {
    label: "Re-authenticate",
    section: "account",
    anchorTitle: "Stremio account",
    keywords: ["reauth", "refresh session", "login again", "expired token", "re-login"],
  },
  {
    label: "Sign out",
    section: "account",
    anchorTitle: "Stremio account",
    keywords: ["logout", "sign out", "log off", "disconnect account"],
  },
  {
    label: "Reveal",
    section: "account",
    anchorTitle: "Stremio account",
    keywords: ["show email", "hide email", "mask email", "privacy", "stremio id"],
  },
  {
    label: "Sync now",
    section: "account",
    anchorTitle: "Synced addons",
    keywords: ["sync addons", "refresh addons", "pull collection", "addon sync", "last synced"],
  },
  {
    label: "Manage",
    section: "account",
    anchorTitle: "Synced addons",
    keywords: ["manage addons", "installed addons", "addons page", "open addons"],
  },
  {
    label: "Show every addon row",
    section: "library",
    anchorTitle: "Home layout",
    keywords: [
      "addon rows",
      "duplicate rows",
      "dedup",
      "merged rails",
      "show all rows",
      "catalogs",
    ],
  },
  {
    label: "Watchlist shows only saved titles",
    section: "library",
    anchorTitle: "Home layout",
    keywords: [
      "watchlist",
      "bookmarked only",
      "saved titles",
      "library tab",
      "auto added",
      "stremio saves",
    ],
  },
  {
    label: "Show Playlists tab",
    section: "library",
    anchorTitle: "Home layout",
    keywords: ["playlists", "m3u", "xtream", "iptv", "nav tab", "sidebar"],
  },
  {
    label: "Keep anime in the Anime room only",
    section: "library",
    anchorTitle: "Home layout",
    keywords: ["anime", "continue watching", "anime tab", "hide anime on home", "anime room"],
  },
  {
    label: "Advance Continue Watching to the next episode",
    section: "library",
    anchorTitle: "Home layout",
    keywords: [
      "continue watching",
      "next episode",
      "advance",
      "auto next",
      "cw card",
      "zero minutes",
    ],
  },
  {
    label: "Hide watched titles in catalogs",
    section: "library",
    anchorTitle: "Home layout",
    keywords: ["hide watched", "already seen", "watched filter", "history", "trakt", "catalogs"],
  },
  {
    label: "Hide unreleased titles",
    section: "library",
    anchorTitle: "Home layout",
    keywords: ["unreleased", "upcoming", "future release", "coming soon", "hide", "release date"],
  },
  {
    label: "Home languages",
    section: "library",
    anchorTitle: "Home languages",
    keywords: [
      "language filter",
      "original language",
      "home catalogs",
      "foreign titles",
      "english only",
      "clear",
      "japanese",
      "spanish",
    ],
  },
  {
    label: "Blur spoilers",
    section: "library",
    anchorTitle: "Spoilers",
    keywords: ["spoilers", "blur", "episodes", "hide spoilers", "peek", "artwork"],
  },
  {
    label: "Blur thumbnails",
    section: "library",
    anchorTitle: "Spoilers",
    keywords: ["thumbnails", "episode stills", "blur images", "spoiler pictures"],
  },
  {
    label: "Blur titles",
    section: "library",
    anchorTitle: "Spoilers",
    keywords: ["episode titles", "blur names", "spoiler titles", "hide titles"],
  },
  {
    label: "Blur descriptions",
    section: "library",
    anchorTitle: "Spoilers",
    keywords: ["synopsis", "blur description", "episode overview", "spoiler text"],
  },
  {
    label: "Blur episode images on detail page",
    section: "library",
    anchorTitle: "Spoilers",
    keywords: ["hero image", "stills", "detail page blur", "reveal", "episode page"],
  },
  {
    label: "Keep the next episode visible",
    section: "library",
    anchorTitle: "Spoilers",
    keywords: ["next episode", "skip next", "unblurred", "current episode", "clear"],
  },
  {
    label: "Blur stream backdrop",
    section: "library",
    anchorTitle: "Spoilers",
    keywords: ["stream picker", "backdrop blur", "glass effect", "picker background"],
  },
  {
    label: "Show IMDb rating on episodes",
    section: "library",
    anchorTitle: "Episode cards",
    keywords: ["episode rating", "imdb", "omdb", "episode score", "tmdb fallback"],
  },
  {
    label: "Show episode description",
    section: "library",
    anchorTitle: "Episode cards",
    keywords: ["episode synopsis", "description", "overview", "cards", "hide synopsis"],
  },
  {
    label: "High-quality episode images",
    section: "library",
    anchorTitle: "Episode cards",
    keywords: [
      "hd images",
      "full resolution",
      "episode artwork",
      "bandwidth",
      "slow connection",
      "w300",
    ],
  },
  {
    label: "Group episodes by story arc",
    section: "library",
    anchorTitle: "Episode cards",
    keywords: [
      "arc",
      "story arc",
      "arcs",
      "saga",
      "one piece",
      "seasons arcs switch",
      "arc grouping",
      "group by arc",
      "episode arc",
      "browse by saga",
    ],
  },
  {
    label: "Episode ordering (TVDB, DVD, absolute, arc order)",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: [
      "episode ordering",
      "episode order",
      "tvdb order",
      "dvd order",
      "absolute order",
      "aired order",
      "official order",
      "arc order",
      "one piece order",
      "season order",
      "tvdb season and order panel",
      "order tabs",
      "reorder episodes",
    ],
  },
  {
    label: "Identify the current song",
    section: "library",
    anchorTitle: "Now Playing card",
    keywords: [
      "song id",
      "shazam",
      "audd",
      "music recognition",
      "identify song",
      "now playing",
      "what song",
    ],
  },
  {
    label: "Now Playing card",
    section: "library",
    anchorTitle: "Now Playing card",
    keywords: [
      "song card",
      "compact",
      "cinematic",
      "music card",
      "disc",
      "cover style",
      "card style",
    ],
  },
  {
    label: "Show track details",
    section: "library",
    anchorTitle: "Now Playing card",
    keywords: ["artist", "album", "track info", "song details"],
  },
  {
    label: "Keep frames for",
    section: "library",
    anchorTitle: "Continue Watching screenshots",
    keywords: [
      "snapshot retention",
      "saved frames",
      "1 week",
      "30 days",
      "1 year",
      "none",
      "screenshots",
    ],
  },
  {
    label: "Clear all saved frames",
    section: "library",
    anchorTitle: "Continue Watching screenshots",
    keywords: ["clear snapshots", "wipe frames", "delete screenshots", "confirm clear", "storage"],
  },
  {
    label: "AI Search · natural-language search",
    section: "library",
    anchorTitle: "AI search",
    keywords: [
      "ai search",
      "openrouter",
      "api key",
      "ask ai",
      "natural language",
      "smart search",
      "sk-or",
    ],
  },
  {
    label: "Model",
    section: "library",
    anchorTitle: "AI search",
    keywords: [
      "ai model",
      "gpt",
      "claude",
      "gemini",
      "llama",
      "deepseek",
      "mistral",
      "choose model",
    ],
  },
  {
    label: "TMDB · catalogs and rails",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: [
      "tmdb",
      "api key",
      "v3 key",
      "themoviedb",
      "catalogs",
      "trending",
      "how to get this",
      "guide",
    ],
  },
  {
    label: "OMDb · Rotten Tomatoes scores",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: ["omdb", "rotten tomatoes", "imdb ratings", "api key", "activation link"],
  },
  {
    label: "RPDB · scores baked into posters",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: ["rpdb", "rating poster db", "poster ratings", "ratingposterdb", "baked scores"],
  },
  {
    label: "MDBList · Letterboxd and Trakt scores",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: ["mdblist", "letterboxd ratings", "trakt ratings", "community scores", "api key"],
  },
  {
    label: "AudD · in-player song ID",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: ["audd", "song recognition", "music id", "api token", "identify song key"],
  },
  {
    label: "Custom poster service",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: [
      "poster server",
      "better posters",
      "btttr",
      "postersplus",
      "url template",
      "custom posters",
      "imdbid",
    ],
  },
  {
    label: "Hide titles under posters",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: ["poster titles", "hide names", "clean grid", "minimal"],
  },
  {
    label: "Prefer my installed metadata addon",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: [
      "meta addon",
      "localized cinemeta",
      "custom metadata",
      "override cinemeta",
      "descriptions",
    ],
  },
  {
    label: "Fanart.tv · logos and backdrops",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: ["fanart", "logos", "backdrops", "artwork", "personal key", "anime art"],
  },
  {
    label: "TheTVDB · episode data",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: [
      "tvdb",
      "thetvdb",
      "episode titles",
      "network info",
      "subscriber key",
      "alternate names",
    ],
  },
  {
    label: "Show tags on cards (New, In Cinema, Rerun, Awards)",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: ["card tags", "new badge", "in cinema", "rerun", "awards", "chips", "overlays"],
  },
  {
    label: "Show ratings on detail pages",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: ["detail ratings", "hide ratings", "movie page scores", "show scores"],
  },
  {
    label: "Show IMDb score on cards",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: ["imdb badge", "yellow chip", "poster rating", "card score", "imdb"],
  },
  {
    label: "Show TMDB score on cards",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: ["tmdb score", "fallback rating", "unreleased rating", "card badge"],
  },
  {
    label: "Show Rotten Tomatoes score on cards",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: ["rotten tomatoes", "rt badge", "tomato", "splat", "fresh", "critic score"],
  },
  {
    label: "Show audience score on cards",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: ["popcornmeter", "audience score", "popcorn", "rt audience", "percent"],
  },
  {
    label: "Show MAL score on cards",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: ["mal", "myanimelist", "anime score", "anime badge", "anime rating"],
  },
  {
    label: "Anime card rating source",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: ["mal vs imdb", "anime rating source", "mal", "imdb", "anime cards", "fallback"],
  },
  {
    label: "Show Metacritic score on cards",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: ["metacritic", "metascore", "critic rating", "green yellow red"],
  },
  {
    label: "Show Letterboxd score on cards",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: ["letterboxd", "letterbox", "film rating", "out of 5", "card badge"],
  },
  {
    label: "Show MDBList score on cards",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: ["mdblist score", "aggregate score", "all sources", "card badge"],
  },
  {
    label: "Show Trakt score on cards",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: ["trakt rating", "percent", "community rating", "card badge"],
  },
  {
    label: "Hover preview",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: [
      "hover preview",
      "peek",
      "poster hover",
      "current",
      "elegant",
      "preview style",
      "popup card",
    ],
  },
  {
    label: "Hover style",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: [
      "hover style",
      "card hover",
      "poster hover",
      "peek",
      "elegantfin",
      "frosted glass",
      "cinema",
      "spotlight",
      "minimal",
      "glare",
      "overview",
      "preview style",
    ],
  },
  {
    label: "Open preview",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: ["on the card", "to the side", "preview placement", "hover position"],
  },
  {
    label: "Mark watched button",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: [
      "mark watched",
      "watched button",
      "detail page",
      "trakt sync",
      "simkl sync",
      "check",
    ],
  },
  {
    label: "Badge position",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: ["badge placement", "top", "bottom", "score position", "chip position"],
  },
  {
    label: "Max badges per card",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: ["badge limit", "max badges", "number of scores", "2 3 4 5 6", "cap"],
  },
  {
    label: "Watchlist badge",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: [
      "bookmark badge",
      "watchlist icon",
      "corner",
      "off",
      "top left",
      "top right",
      "bottom left",
      "bottom right",
    ],
  },
  {
    label: "Hide anime",
    section: "library",
    anchorTitle: "Content filters",
    keywords: ["hide anime", "no anime", "remove anime tab", "anime rows"],
  },
  {
    label: "Hide Live TV",
    section: "library",
    anchorTitle: "Content filters",
    keywords: ["hide live tv", "remove tv tab", "no live", "sidebar"],
  },
  {
    label: "Hide adult content",
    section: "library",
    anchorTitle: "Content filters",
    keywords: ["adult filter", "nsfw", "xxx", "safe mode", "adult catalogs"],
  },
  {
    label: "Connect your Trakt account",
    section: "trakt",
    keywords: ["trakt", "connect", "tracking", "scrobble", "watchlist", "recommendations"],
  },
  {
    label: "Connect Trakt",
    section: "trakt",
    keywords: ["trakt login", "device code", "authorize", "link trakt"],
  },
  {
    label: "About Trakt",
    section: "trakt",
    keywords: ["trakt.tv", "what is trakt", "info", "website"],
  },
  {
    label: "Open Trakt profile",
    section: "trakt",
    keywords: ["open profile", "trakt profile", "view profile", "my trakt", "profile page"],
  },
  {
    label: "Use my Trakt avatar as my Harbor avatar",
    section: "trakt",
    keywords: ["trakt avatar", "profile picture", "avatar sync", "wear avatar"],
  },
  {
    label: "Disconnect from Trakt",
    section: "trakt",
    keywords: ["disconnect", "unlink", "remove trakt", "stop scrobbling", "sign out"],
  },
  {
    label: "Export to Trakt",
    section: "trakt",
    keywords: ["export watchlist", "copy watchlist", "send to trakt", "upload", "move watchlist"],
  },
  {
    label: "Import from Trakt",
    section: "trakt",
    keywords: [
      "import watchlist",
      "pull watchlist",
      "trakt to harbor",
      "download",
      "move watchlist",
    ],
  },
  {
    label: "Show comments on detail pages",
    section: "trakt",
    keywords: ["trakt comments", "community comments", "reviews", "discussion", "episodes"],
  },
  {
    label: "Blur Trakt comments by default",
    section: "trakt",
    keywords: [
      "blur comments by default",
      "blur comments",
      "spoiler comments",
      "hide reviews",
      "reveal",
    ],
  },
  {
    label: "Connect your AniList account",
    section: "anilist",
    keywords: ["anilist", "connect", "anime lists", "link account", "anime tracking", "rails"],
  },
  {
    label: "Connect AniList",
    section: "anilist",
    keywords: ["anilist login", "authorize", "oauth", "link"],
  },
  {
    label: "About AniList",
    section: "anilist",
    keywords: ["anilist.co", "info", "website", "what is anilist"],
  },
  {
    label: "Open AniList profile",
    section: "anilist",
    keywords: ["open profile", "anilist profile", "view profile", "profile page", "my anilist"],
  },
  {
    label: "Sync watch progress",
    section: "anilist",
    keywords: ["anilist sync", "episode progress", "auto update", "forward only", "tracking"],
  },
  {
    label: "Use my AniList avatar as my Harbor avatar",
    section: "anilist",
    keywords: ["anilist avatar", "profile picture", "avatar", "wear avatar"],
  },
  {
    label: "Show AniList comments",
    section: "anilist",
    keywords: ["anilist comments", "forum threads", "anime discussion", "detail pages"],
  },
  {
    label: "Blur AniList comments by default",
    section: "anilist",
    keywords: [
      "blur comments by default",
      "blur comments",
      "spoilers",
      "hide comments",
      "reveal",
      "anime pages",
    ],
  },
  {
    label: "Disconnect from AniList",
    section: "anilist",
    keywords: ["disconnect", "unlink", "remove anilist", "stop sync"],
  },
  {
    label: "Connect your MyAnimeList account",
    section: "mal",
    keywords: [
      "mal",
      "myanimelist",
      "connect",
      "anime lists",
      "link account",
      "anime tracking",
      "oauth",
    ],
  },
  {
    label: "MAL Client ID",
    section: "mal",
    keywords: ["mal client id", "api key", "myanimelist api", "client id", "register app"],
  },
  {
    label: "Connect MyAnimeList",
    section: "mal",
    keywords: ["mal login", "authorize", "oauth", "pin code", "link"],
  },
  {
    label: "About MyAnimeList",
    section: "mal",
    keywords: ["myanimelist.net", "info", "website", "what is mal"],
  },
  {
    label: "Open MAL profile",
    section: "mal",
    keywords: [
      "open profile",
      "mal profile",
      "view profile",
      "profile page",
      "myanimelist profile",
    ],
  },
  {
    label: "Disconnect from MyAnimeList",
    section: "mal",
    keywords: ["disconnect", "unlink", "remove mal", "stop sync"],
  },
  {
    label: "Connect your Simkl account",
    section: "simkl",
    keywords: ["simkl", "connect", "tracking", "plan to watch", "mark watched", "sync"],
  },
  {
    label: "Connect Simkl",
    section: "simkl",
    keywords: ["simkl login", "device code", "authorize", "link"],
  },
  {
    label: "About Simkl",
    section: "simkl",
    keywords: ["simkl.com", "info", "website", "what is simkl"],
  },
  {
    label: "Open Simkl profile",
    section: "simkl",
    keywords: ["open profile", "simkl profile", "view profile", "profile page", "my simkl"],
  },
  {
    label: "Use my Simkl avatar as my Harbor avatar",
    section: "simkl",
    keywords: ["simkl avatar", "profile picture", "avatar", "wear avatar"],
  },
  {
    label: "Disconnect from Simkl",
    section: "simkl",
    keywords: ["disconnect", "unlink", "remove simkl", "stop sync"],
  },
  {
    label: "Enable Letterboxd integration",
    section: "letterboxd",
    keywords: ["letterboxd", "letterbox", "stremboxd", "enable", "films", "diary", "watchlist"],
  },
  {
    label: "Mode",
    section: "letterboxd",
    keywords: ["public mode", "full mode", "username only", "password mode", "segmented"],
  },
  {
    label: "Letterboxd username",
    section: "letterboxd",
    keywords: ["username", "handle", "account name", "letterbox user"],
  },
  {
    label: "Letterboxd password",
    section: "letterboxd",
    keywords: ["password", "sign in", "2fa", "totp", "two-factor", "full mode"],
  },
  {
    label: "Connect / Verify",
    section: "letterboxd",
    keywords: ["verify", "connect", "validate", "check catalogs", "public"],
  },
  {
    label: "Connect",
    section: "letterboxd",
    keywords: ["login", "sign in", "verify & connect", "full login"],
  },
  {
    label: "About Stremboxd",
    section: "letterboxd",
    keywords: ["stremboxd", "bridge", "configure", "info", "website"],
  },
  {
    label: "Catalogs to show",
    section: "letterboxd",
    keywords: [
      "watchlist",
      "diary",
      "liked films",
      "friends",
      "recommended for you",
      "popular this week",
      "top 250",
    ],
  },
  {
    label: "Custom lists",
    section: "letterboxd",
    keywords: ["add list", "list url", "remove list", "letterboxd list", "import list", "slug"],
  },
  {
    label: "Show my rating on movie posters",
    section: "letterboxd",
    keywords: ["my rating", "poster overlay", "stars", "personal rating"],
  },
  {
    label: "Blur reviews by default",
    section: "letterboxd",
    keywords: ["blur reviews", "spoilers", "film pages", "reveal"],
  },
  {
    label: "Hidden catalogs",
    section: "letterboxd",
    keywords: ["unhide", "show hidden", "restore catalog", "hidden rows"],
  },
  {
    label: "Disconnect",
    section: "letterboxd",
    keywords: ["logout", "disconnect", "sign out letterboxd", "unlink", "full mode"],
  },
  {
    label: "Harbor Relay",
    section: "relay",
    anchorTitle: "Harbor Relay",
    keywords: [
      "relay",
      "watch together",
      "cloudflare worker",
      "rooms",
      "sync server",
      "copy url",
      "hosted relay",
    ],
  },
  {
    label: "Deploy a relay",
    section: "relay",
    anchorTitle: "Harbor Relay",
    keywords: ["deploy", "cloudflare", "worker", "self host", "setup relay", "desktop only"],
  },
  {
    label: "Use Harbor's public relay",
    section: "relay",
    anchorTitle: "Harbor Relay",
    keywords: ["public relay", "hosted relay", "default relay", "quota", "pub relay"],
  },
  {
    label: "Enter an existing relay URL:",
    section: "relay",
    anchorTitle: "Harbor Relay",
    keywords: ["relay url", "wss", "workers.dev", "custom relay", "paste url", "save"],
  },
  {
    label: "Test relay connection",
    section: "relay",
    anchorTitle: "Harbor Relay",
    keywords: ["test connection", "run test", "ping", "health", "reachable", "verify relay"],
  },
  {
    label: "Backup credentials",
    section: "relay",
    anchorTitle: "Harbor Relay",
    keywords: ["export", "backup", "api token", "credentials", "json file", "cloudflare token"],
  },
  {
    label: "Stop relay",
    section: "relay",
    anchorTitle: "Harbor Relay",
    keywords: ["stop", "delete worker", "remove relay", "teardown"],
  },
  {
    label: "Forget URL",
    section: "relay",
    anchorTitle: "Harbor Relay",
    keywords: ["forget", "clear url", "reset relay", "remove url"],
  },
  {
    label: "Use a different URL",
    section: "relay",
    anchorTitle: "Harbor Relay",
    keywords: ["change relay", "switch relay", "different url", "replace"],
  },
  {
    label: "Deploy mine instead",
    section: "relay",
    anchorTitle: "Harbor Relay",
    keywords: ["own relay", "deploy mine", "self host", "migrate"],
  },
  {
    label: "Redeploy",
    section: "relay",
    anchorTitle: "Harbor Relay",
    keywords: ["redeploy", "update relay", "upgrade", "new version", "redeploy instructions"],
  },
  {
    label: "Documentation: run your own relay",
    section: "relay",
    anchorTitle: "Harbor Relay",
    keywords: ["docs", "documentation", "guide", "run your own", "instructions"],
  },
  {
    label: "Picker layout",
    section: "streaming",
    anchorTitle: "Picker layout",
    keywords: [
      "condensed",
      "stremio layout",
      "picker style",
      "flat list",
      "quality tiles",
      "drawer",
      "source list",
    ],
  },
  {
    label: "Show torrent name",
    section: "streaming",
    anchorTitle: "Torrent name",
    keywords: ["torrent name", "filename", "release name", "raw title", "release filename"],
  },
  {
    label: "Show full descriptions",
    section: "streaming",
    anchorTitle: "Stream descriptions",
    keywords: [
      "full description",
      "aiostreams",
      "stream info",
      "trim",
      "tidier rows",
      "addon description",
    ],
  },
  {
    label: "Enable injected ad skip",
    section: "streaming",
    anchorTitle: "Injected ad skip (experimental)",
    keywords: ["ad skip", "skip ads", "cam ads", "injected ads", "skip button", "adskip"],
  },
  {
    label: "Always show the report button",
    section: "streaming",
    anchorTitle: "Injected ad skip (experimental)",
    keywords: ["report ad", "report button", "mark ads", "flag ads"],
  },
  {
    label: "Skip injected ads automatically",
    section: "streaming",
    anchorTitle: "Injected ad skip (experimental)",
    keywords: ["auto skip", "automatic ads", "jump ads", "hands free"],
  },
  {
    label: "Result order",
    section: "streaming",
    anchorTitle: "Result order",
    keywords: [
      "harbor ranking",
      "addon order",
      "sort results",
      "priority",
      "ordering",
      "best first",
      "vidi",
    ],
  },
  {
    label: "Real-Debrid API token",
    section: "streaming",
    anchorTitle: "Debrid services",
    keywords: ["real-debrid", "realdebrid", "rd", "api token", "debrid", "cached streams"],
  },
  {
    label: "TorBox API key",
    section: "streaming",
    anchorTitle: "Debrid services",
    keywords: ["torbox", "tor box", "tb", "api key", "queue torrents", "debrid"],
  },
  {
    label: "AllDebrid API key",
    section: "streaming",
    anchorTitle: "Debrid services",
    keywords: ["alldebrid", "all debrid", "ad", "api key", "debrid", "cache check"],
  },
  {
    label: "Premiumize API key",
    section: "streaming",
    anchorTitle: "Debrid services",
    keywords: ["premiumize", "pm", "api key", "directdl", "debrid"],
  },
  {
    label: "Debrid-Link API key",
    section: "streaming",
    anchorTitle: "Debrid services",
    keywords: ["debrid-link", "debridlink", "dl", "api key", "eu debrid"],
  },
  {
    label: "Easynews+",
    section: "streaming",
    anchorTitle: "Usenet",
    keywords: ["usenet", "easynews", "newsgroups", "manifest url", "no debrid", "nzb"],
  },
  {
    label: "Streaming catalogs",
    section: "streaming",
    anchorTitle: "Streaming catalogs",
    keywords: [
      "netflix",
      "disney plus",
      "hulu",
      "prime video",
      "apple tv",
      "max",
      "paramount",
      "peacock",
      "service rows",
    ],
  },
  {
    label: "Saved stream filters",
    section: "streamFilters",
    anchorTitle: "Saved stream filters",
    keywords: [
      "custom filters",
      "saved filters",
      "filter builder",
      "source picker",
      "named filter",
      "your filters",
    ],
  },
  {
    label: "New filter",
    section: "streamFilters",
    anchorTitle: "Saved stream filters",
    keywords: ["create filter", "add filter", "build filter", "new"],
  },
  {
    label: "Edit filter",
    section: "streamFilters",
    anchorTitle: "Saved stream filters",
    keywords: ["edit", "modify filter", "rename filter", "change filter"],
  },
  {
    label: "Delete filter",
    section: "streamFilters",
    anchorTitle: "Saved stream filters",
    keywords: ["delete", "remove filter", "trash", "clear filter"],
  },
  {
    label: "Local engine",
    section: "p2p",
    anchorTitle: "Local engine",
    keywords: [
      "torrent engine",
      "p2p engine",
      "built-in engine",
      "status",
      "port",
      "dht",
      "active torrents",
      "nodes",
    ],
  },
  {
    label: "Show P2P status overlay",
    section: "p2p",
    anchorTitle: "Local engine",
    keywords: ["p2p chip", "peers", "speed", "progress overlay", "status chip", "player overlay"],
  },
  {
    label: "Download the whole file while streaming",
    section: "p2p",
    anchorTitle: "Local engine",
    keywords: [
      "download whole file",
      "download the whole file",
      "full download",
      "download ahead",
      "download in background",
      "background download",
      "keep downloading",
      "downloads stop when paused",
      "stops downloading",
      "downloading stops",
      "prebuffer",
      "pre-buffer",
      "buffer ahead",
      "buffer the whole file",
      "bigger buffer",
      "pre buffer big remux",
      "large remux",
      "remux",
      "scrub",
      "scrub freely",
      "seek freely",
      "no buffering",
      "no re-downloading",
      "cache whole file",
      "download entire file",
      "finish downloading",
      "webdav",
      "potplayer",
      "acts like a local file",
    ],
  },
  {
    label: "Run self-test",
    section: "p2p",
    anchorTitle: "Local engine",
    keywords: ["self test", "engine test", "diagnostics", "udp", "https", "egress", "tracker test"],
  },
  {
    label: "Restart engine",
    section: "p2p",
    anchorTitle: "Local engine",
    keywords: ["restart", "reboot engine", "engine stuck", "fix streams"],
  },
  {
    label: "Clear & restart",
    section: "p2p",
    anchorTitle: "Local engine",
    keywords: ["hard reset", "wipe engine", "clear engine", "fresh port", "streams stop loading"],
  },
  {
    label: "Keep cached files for",
    section: "p2p",
    anchorTitle: "Stream cache",
    keywords: [
      "cache retention",
      "1 day",
      "3 days",
      "1 week",
      "forever",
      "off",
      "resume instantly",
    ],
  },
  {
    label: "Keep at most",
    section: "p2p",
    anchorTitle: "Stream cache",
    keywords: [
      "cache limit",
      "disk space",
      "10 gb",
      "100 gb",
      "unlimited",
      "cap",
      "oldest deleted",
    ],
  },
  {
    label: "Delete after I finish watching",
    section: "p2p",
    anchorTitle: "Stream cache",
    keywords: ["delete watched", "auto delete", "cleanup", "finished file", "free space"],
  },
  {
    label: "Cache location",
    section: "p2p",
    anchorTitle: "Stream cache",
    keywords: [
      "cache folder",
      "directory",
      "change location",
      "reset location",
      "disk",
      "move cache",
    ],
  },
  {
    label: "Clear cache now",
    section: "p2p",
    anchorTitle: "Stream cache",
    keywords: ["clear cache", "wipe cache", "free space", "delete files", "confirm clear"],
  },
  {
    label: "Direct torrent streaming",
    section: "p2p",
    anchorTitle: "Power tools & diagnostics",
    keywords: [
      "direct torrent",
      "p2p streaming",
      "no debrid",
      "uncached",
      "peers",
      "own connection",
    ],
  },
  {
    label: "Auto-confirm peer-to-peer streaming",
    section: "p2p",
    anchorTitle: "Power tools & diagnostics",
    keywords: ["auto confirm", "consent prompt", "skip prompt", "p2p prompt", "uncached torrents"],
  },
  {
    label: "Copy diagnostics",
    section: "p2p",
    anchorTitle: "Power tools & diagnostics",
    keywords: ["diagnostics", "debug json", "bug report", "engine status", "copy debug"],
  },
  {
    label: "Reveal engine folder",
    section: "p2p",
    anchorTitle: "Power tools & diagnostics",
    keywords: ["engine folder", "dht.json", "open folder", "explorer", "torrent data"],
  },
  {
    label: "Start server",
    section: "p2p",
    anchorTitle: "Your streaming server address",
    keywords: [
      "start server",
      "stop server",
      "restart server",
      "streaming server",
      "stremio server",
      "antivirus",
    ],
  },
  {
    label: "Harbor in your browser",
    section: "p2p",
    anchorTitle: "Your streaming server address",
    keywords: ["web ui", "browser app", "serve web", "phone", "tv browser", "11471", "web version"],
  },
  {
    label: "Use exclusively (never fall back to local)",
    section: "p2p",
    anchorTitle: "Remote streaming server",
    keywords: ["strict remote", "vpn", "no fallback", "exclusive", "playback fails"],
  },
  {
    label: "Test remote server connection",
    section: "p2p",
    anchorTitle: "Remote streaming server",
    keywords: [
      "test connection",
      "run test",
      "probe",
      "reachable",
      "ping server",
      "settings endpoint",
    ],
  },
  {
    label: "Forget",
    section: "p2p",
    anchorTitle: "Remote streaming server",
    keywords: ["forget server", "clear url", "remove server", "reset"],
  },
  {
    label: "Subtitle languages",
    section: "language",
    anchorTitle: "Subtitle languages",
    keywords: [
      "subtitles",
      "subs",
      "captions",
      "auto load subtitles",
      "preferred subtitle language",
      "srt",
      "cc",
      "subtitels",
    ],
  },
  {
    label: "Start with subtitles off",
    section: "language",
    anchorTitle: "Subtitle languages",
    keywords: [
      "subtitles off",
      "disable subtitles",
      "no subs",
      "captions off",
      "dont show subtitles",
      "default off",
    ],
  },
  {
    label: "Prefer embedded subtitles",
    section: "language",
    anchorTitle: "Subtitle languages",
    keywords: [
      "embedded subs",
      "internal subtitles",
      "muxed subs",
      "built in subtitles",
      "keep embedded",
      "best synced",
    ],
  },
  {
    label: "Forced subs with native audio",
    section: "language",
    anchorTitle: "Subtitle languages",
    keywords: [
      "forced subtitles",
      "signs only",
      "foreign dialogue",
      "forced track",
      "native audio",
      "partial subs",
    ],
  },
  {
    label: "Upgrade subtitles when better ones load",
    section: "language",
    anchorTitle: "Subtitle languages",
    keywords: [
      "subtitle upgrade",
      "auto switch subtitles",
      "better match",
      "late loading subs",
      "swap subtitles",
    ],
  },
  {
    label: "Never auto-select tracks containing",
    section: "language",
    anchorTitle: "Subtitle languages",
    keywords: [
      "block words",
      "commentary",
      "descriptive",
      "sdh",
      "track filter",
      "blacklist",
      "skip tracks",
    ],
  },
  {
    label: "Background",
    section: "language",
    anchorTitle: "Subtitle style",
    keywords: [
      "drop shadow",
      "outline",
      "black bar",
      "box",
      "subtitle background",
      "halo",
      "stroke",
    ],
  },
  {
    label: "Styled (ASS) subtitles",
    section: "language",
    anchorTitle: "Subtitle style",
    keywords: [
      "ass subtitles",
      "ssa",
      "keep original",
      "resize only",
      "use my style",
      "karaoke",
      "anime subs",
      "boxes instead of letters",
    ],
  },
  {
    label: "Background opacity",
    section: "language",
    anchorTitle: "Subtitle style",
    keywords: ["box opacity", "subtitle background transparency", "dim box", "see through box"],
  },
  {
    label: "Outline thickness",
    section: "language",
    anchorTitle: "Subtitle style",
    keywords: ["outline width", "stroke size", "border thickness", "letter outline"],
  },
  {
    label: "Font",
    section: "language",
    anchorTitle: "Subtitle style",
    keywords: [
      "subtitle font",
      "inter",
      "system font",
      "serif",
      "arabic font",
      "typeface",
      "rounded",
    ],
  },
  {
    label: "Upload font",
    section: "language",
    anchorTitle: "Subtitle style",
    keywords: ["custom subtitle font", "ttf", "otf", "woff", "add font", "install font"],
  },
  {
    label: "Bold text",
    section: "language",
    anchorTitle: "Subtitle style",
    keywords: ["bold subtitles", "heavier weight", "thick text", "font weight"],
  },
  {
    label: "Show subtitles in Picture-in-Picture",
    section: "language",
    anchorTitle: "Subtitle style",
    keywords: [
      "pip subtitles",
      "picture in picture captions",
      "floating window subs",
      "mini player subtitles",
    ],
  },
  {
    label: "Subtitle size",
    section: "language",
    anchorTitle: "Subtitle style",
    keywords: ["size", "font size", "bigger subtitles", "text size", "small subtitles"],
  },
  {
    label: "Opacity",
    section: "language",
    anchorTitle: "Subtitle style",
    keywords: ["subtitle transparency", "faded subtitles", "see through text", "subtitle opacity"],
  },
  {
    label: "Distance from bottom",
    section: "language",
    anchorTitle: "Subtitle style",
    keywords: [
      "subtitle position",
      "raise subtitles",
      "vertical margin",
      "height from bottom",
      "move subtitles up",
    ],
  },
  {
    label: "Alignment",
    section: "language",
    anchorTitle: "Subtitle style",
    keywords: [
      "left",
      "center",
      "right",
      "subtitle alignment",
      "justify text",
      "horizontal position",
    ],
  },
  {
    label: "Text color",
    section: "language",
    anchorTitle: "Subtitle style",
    keywords: ["subtitle color", "font color", "white subtitles", "yellow subtitles", "colour"],
  },
  {
    label: "Outline color",
    section: "language",
    anchorTitle: "Subtitle style",
    keywords: ["border color", "stroke color", "outline colour", "edge color"],
  },
  {
    label: "Box color",
    section: "language",
    anchorTitle: "Subtitle style",
    keywords: ["background color", "black bar color", "box colour", "panel color"],
  },
  {
    label: "Reset subtitle style to defaults",
    section: "language",
    anchorTitle: "Subtitle style",
    keywords: [
      "reset to defaults",
      "reset subtitle style",
      "default look",
      "undo changes",
      "factory subtitles",
    ],
  },
  {
    label: "Translate titles",
    section: "language",
    anchorTitle: "Metadata language",
    keywords: ["translated titles", "original title", "localized titles", "keep english title"],
  },
  {
    label: "Translate overviews",
    section: "language",
    anchorTitle: "Metadata language",
    keywords: [
      "translated plot",
      "descriptions",
      "taglines",
      "synopsis translation",
      "overview language",
    ],
  },
  {
    label: "Only show streams in my languages",
    section: "language",
    anchorTitle: "Preferred languages",
    keywords: [
      "hide other languages",
      "language filter",
      "only my language",
      "strict filter",
      "drop foreign streams",
    ],
  },
  {
    label: "Contribute on GitHub",
    section: "language",
    anchorTitle: "Preferred languages",
    keywords: ["github", "translate harbor", "contribute", "open source", "help translate", "i18n"],
  },
  {
    label: "Instant",
    section: "player",
    anchorTitle: "Play button behavior",
    keywords: [
      "instant play",
      "auto pick stream",
      "best stream",
      "one click play",
      "jump into playback",
    ],
  },
  {
    label: "Manual picker",
    section: "player",
    anchorTitle: "Play button behavior",
    keywords: [
      "source list",
      "stream picker",
      "choose quality",
      "pick source",
      "debrid choice",
      "picker",
    ],
  },
  {
    label: "Ask to resume or start over",
    section: "player",
    anchorTitle: "Play button behavior",
    keywords: [
      "resume prompt",
      "start over",
      "restart dialog",
      "continue watching prompt",
      "resume or restart",
    ],
  },
  {
    label: "Resume where you left off",
    section: "player",
    anchorTitle: "Play button behavior",
    keywords: [
      "resume playback",
      "saved position",
      "continue watching",
      "start from beginning",
      "rewatch shows",
    ],
  },
  {
    label: "Keep same source on next episode",
    section: "player",
    anchorTitle: "Play button behavior",
    keywords: [
      "same release",
      "next episode source",
      "binge same source",
      "keep addon",
      "sticky source",
    ],
  },
  {
    label: "Stay in fullscreen after closing the player",
    section: "player",
    anchorTitle: "Play button behavior",
    keywords: [
      "keep fullscreen",
      "exit fullscreen",
      "fullscreen after close",
      "window mode",
      "fullscren",
    ],
  },
  {
    label: "Volume pop-up while watching",
    section: "player",
    anchorTitle: "Play button behavior",
    keywords: [
      "volume hud",
      "volume overlay",
      "volume popup",
      "on screen volume",
      "scroll wheel volume",
      "osd",
    ],
  },
  {
    label: "Pop-up position",
    section: "player",
    anchorTitle: "Play button behavior",
    keywords: [
      "volume position",
      "center",
      "top left",
      "top right",
      "hud placement",
      "overlay position",
    ],
  },
  {
    label: "Auto",
    section: "player",
    anchorTitle: "Player engine",
    keywords: ["auto engine", "default engine", "best engine", "automatic pick"],
  },
  {
    label: "HTML5",
    section: "player",
    anchorTitle: "Player engine",
    keywords: ["html5", "webview playback", "browser player", "native video", "limited codecs"],
  },
  {
    label: "mpv",
    section: "player",
    anchorTitle: "Player engine",
    keywords: ["mpv", "libmpv", "truehd", "dts", "av1", "hdr player", "plays anything"],
  },
  {
    label: "Embed mpv inside Harbor window",
    section: "player",
    anchorTitle: "Player engine",
    keywords: [
      "embedded mpv",
      "separate window",
      "inline playback",
      "detached player",
      "external window",
    ],
  },
  {
    label: "Tonemap to SDR",
    section: "player",
    anchorTitle: "Player engine",
    keywords: ["hdr to sdr", "tonemap", "washed out hdr", "grey hdr", "bt2446a", "sdr display"],
  },
  {
    label: "True HDR, separate window",
    section: "player",
    anchorTitle: "Player engine",
    keywords: [
      "true hdr",
      "hdr window",
      "real hdr",
      "hdr10",
      "brightness slider dimming",
      "separate playback window",
    ],
  },
  {
    label: "True HDR, embedded",
    section: "player",
    anchorTitle: "Player engine",
    keywords: [
      "embedded hdr",
      "hdr inside harbor",
      "experimental hdr",
      "overlay controls",
      "floating controls",
    ],
  },
  {
    label: "HDR-to-SDR tonemapping",
    section: "player",
    anchorTitle: "Player engine",
    keywords: ["hdr sdr", "tonemapping toggle", "bt2446a", "sdr displays", "washed out fix"],
  },
  {
    label: "Display panel",
    section: "player",
    anchorTitle: "Player engine",
    keywords: ["oled", "lcd", "panel type", "shadow detail", "black levels", "perfect black"],
  },
  {
    label: "Line-free video mode",
    section: "player",
    anchorTitle: "Player engine",
    keywords: [
      "bright line",
      "edge line",
      "monitor artifact",
      "d3d11",
      "compatibility present mode",
      "thin line fix",
    ],
  },
  {
    label: "Always re-encode when casting (recommended)",
    section: "player",
    anchorTitle: "Player engine",
    keywords: [
      "transcode cast",
      "ffmpeg",
      "dlna",
      "samsung tv",
      "lg tv",
      "chromecast",
      "h264",
      "casting compatibility",
    ],
  },
  {
    label: "Internet speed",
    section: "player",
    anchorTitle: "Player engine",
    keywords: [
      "bandwidth cap",
      "mbps",
      "speed test",
      "connection speed",
      "bitrate limit",
      "slow internet",
      "no limit",
    ],
  },
  {
    label: "Stream quality in player",
    section: "player",
    anchorTitle: "Stream quality in player",
    keywords: ["quality info", "now playing info", "resolution under title", "stream details"],
  },
  {
    label: "Show stream quality under the title",
    section: "player",
    anchorTitle: "Stream quality in player",
    keywords: [
      "resolution display",
      "dolby vision label",
      "audio format",
      "4k badge",
      "stream info",
      "what am i watching",
    ],
  },
  {
    label: "Turn it on in Player layout",
    section: "player",
    anchorTitle: "Aspect ratio",
    keywords: [
      "live aspect button",
      "aspect toggle in player",
      "show crop button",
      "mid playback ratio",
    ],
  },
  {
    label: "Player audio",
    section: "player",
    anchorTitle: "Audio",
    keywords: ["sound", "eq", "loudness", "audio output", "profiles", "sound shaping"],
  },
  {
    label: "Normalize loudness",
    section: "player",
    anchorTitle: "Audio",
    keywords: [
      "loudness normalization",
      "quiet dialogue",
      "loud scenes",
      "volume leveling",
      "dynamic normalizer",
    ],
  },
  {
    label: "Flat / Bass boost / Vocal clarity / Less bass / Night mode",
    section: "player",
    anchorTitle: "Audio",
    keywords: [
      "equalizer",
      "eq preset",
      "audio profile",
      "night mode",
      "bass boost",
      "voice clarity",
      "compress loud",
      "late night",
    ],
  },
  {
    label: "Output device",
    section: "player",
    anchorTitle: "Audio",
    keywords: [
      "audio device",
      "speakers",
      "headphones",
      "receiver",
      "output select",
      "hdmi audio",
      "system default",
    ],
  },
  {
    label: "Show the Skip button",
    section: "player",
    anchorTitle: "Skip intros",
    keywords: [
      "skip button",
      "skip intro button",
      "skip credits button",
      "dismiss skip",
      "hide skip",
    ],
  },
  {
    label: "Auto-skip intros",
    section: "player",
    anchorTitle: "Skip intros",
    keywords: ["auto skip", "skip openings automatically", "jump past intro", "autoskip"],
  },
  {
    label: "Auto-hide the Skip button after",
    section: "player",
    anchorTitle: "Skip intros",
    keywords: [
      "hide skip button",
      "skip button timeout",
      "auto dismiss",
      "5s 10s 15s 30s",
      "disappear",
    ],
  },
  {
    label: "Next episode prompt",
    section: "player",
    anchorTitle: "Next episode prompt",
    keywords: [
      "up next",
      "next episode pill",
      "lead time",
      "prompt timing",
      "before episode ends",
      "auto lead",
    ],
  },
  {
    label: "Auto-play next episode",
    section: "player",
    anchorTitle: "Next episode prompt",
    keywords: [
      "autoplay next",
      "binge watching",
      "continuous play",
      "auto next episode",
      "stop after episode",
    ],
  },
  {
    label: "Picture quality",
    section: "mpv",
    anchorTitle: "Picture quality",
    keywords: [
      "quality profile",
      "gpu profile",
      "upscaling preset",
      "performance balanced quality",
      "video quality preset",
    ],
  },
  {
    label: "Smooth on weak PCs",
    section: "mpv",
    anchorTitle: "Picture quality",
    keywords: [
      "performance mode",
      "weak pc",
      "old laptop",
      "stutter fix",
      "lightweight",
      "battery",
      "fan noise",
    ],
  },
  {
    label: "Balanced",
    section: "mpv",
    anchorTitle: "Picture quality",
    keywords: ["balanced profile", "default quality", "most computers", "middle setting"],
  },
  {
    label: "Maximum quality",
    section: "mpv",
    anchorTitle: "Picture quality",
    keywords: ["max quality", "sharper upscaling", "dedicated gpu", "high end", "smooth gradients"],
  },
  {
    label: "Hardware acceleration",
    section: "mpv",
    anchorTitle: "Hardware acceleration",
    keywords: [
      "hwdec",
      "gpu decode",
      "force on",
      "cpu decode",
      "video glitches",
      "battery saving",
      "wont play",
    ],
  },
  {
    label: "Picture adjustments",
    section: "mpv",
    anchorTitle: "Picture adjustments",
    keywords: [
      "picture dials",
      "image tweaks",
      "video adjustments",
      "color tuning",
      "one tap looks",
    ],
  },
  {
    label: "Brighten dark movies",
    section: "mpv",
    anchorTitle: "Picture adjustments",
    keywords: ["too dark", "lift shadows", "dark scenes", "gamma preset", "cant see"],
  },
  {
    label: "Punchier color",
    section: "mpv",
    anchorTitle: "Picture adjustments",
    keywords: ["vivid color", "saturation preset", "more contrast", "punchy picture"],
  },
  {
    label: "Easy on the eyes",
    section: "mpv",
    anchorTitle: "Picture adjustments",
    keywords: ["dimmer picture", "night watching", "softer image", "eye strain"],
  },
  {
    label: "Crisp (anime & cartoons)",
    section: "mpv",
    anchorTitle: "Picture adjustments",
    keywords: ["sharpen preset", "crisp lines", "cartoon look", "anime sharpness"],
  },
  {
    label: "Reset picture",
    section: "mpv",
    anchorTitle: "Picture adjustments",
    keywords: ["reset dials", "undo picture", "factory picture", "clear adjustments"],
  },
  {
    label: "Brightness",
    section: "mpv",
    anchorTitle: "Picture adjustments",
    keywords: ["brightness slider", "brighter", "darker", "luminance", "brightnes"],
  },
  {
    label: "Contrast",
    section: "mpv",
    anchorTitle: "Picture adjustments",
    keywords: ["contrast slider", "punch", "flat image", "dynamic range"],
  },
  {
    label: "Saturation",
    section: "mpv",
    anchorTitle: "Picture adjustments",
    keywords: ["saturation slider", "color intensity", "washed out", "vibrance"],
  },
  {
    label: "Gamma (midtones)",
    section: "mpv",
    anchorTitle: "Picture adjustments",
    keywords: ["gamma slider", "midtones", "shadow lift", "middle tones"],
  },
  {
    label: "Sharpen",
    section: "mpv",
    anchorTitle: "Picture adjustments",
    keywords: ["sharpness slider", "soft picture", "detail", "blur fix"],
  },
  {
    label: "Color & HDR",
    section: "mpv",
    anchorTitle: "Color & HDR",
    keywords: ["hdr settings", "tone mapping", "color handling", "hdr look", "hdr movies"],
  },
  {
    label: "Tone-mapping curve",
    section: "mpv",
    anchorTitle: "Color & HDR",
    keywords: ["tonemap curve", "hable", "mobius", "reinhard", "spline", "bt2390", "filmic"],
  },
  {
    label: "Boost SDR video toward HDR",
    section: "mpv",
    anchorTitle: "Color & HDR",
    keywords: [
      "inverse tone mapping",
      "sdr to hdr",
      "fake hdr",
      "expand brightness",
      "hdr display boost",
    ],
  },
  {
    label: "Slow or unstable connection",
    section: "mpv",
    anchorTitle: "Slow or unstable connection",
    keywords: [
      "buffering",
      "spotty wifi",
      "weak connection",
      "rebuffering",
      "head start",
      "pausing to buffer",
    ],
  },
  {
    label: "Build a bigger buffer",
    section: "mpv",
    anchorTitle: "Slow or unstable connection",
    keywords: [
      "bigger buffer",
      "cache more",
      "preload video",
      "smoother on weak wifi",
      "buffer boost",
    ],
  },
  {
    label: "Audio downmix",
    section: "mpv",
    anchorTitle: "Audio",
    keywords: ["downmix", "stereo", "surround", "laptop speakers", "headphones", "fold down"],
  },
  {
    label: "Mix surround sound down to stereo",
    section: "mpv",
    anchorTitle: "Audio",
    keywords: [
      "downmix stereo",
      "5.1 to stereo",
      "7.1",
      "quiet dialogue",
      "hollow sound",
      "headphones fix",
    ],
  },
  {
    label: "Advanced (mpv.conf)",
    section: "mpv",
    anchorTitle: "Advanced (mpv.conf)",
    keywords: [
      "mpv conf",
      "mpv options",
      "custom mpv flags",
      "key=value",
      "power user",
      "escape hatch",
      "extra options",
    ],
  },
  {
    label: "See the mpv.conf your dials above generate",
    section: "mpv",
    anchorTitle: "Advanced (mpv.conf)",
    keywords: [
      "generated config",
      "compiled mpv conf",
      "preview options",
      "show config",
      "dials output",
    ],
  },
  {
    label: "Enable Anime4K",
    section: "anime",
    anchorTitle: "Anime4K upscaling",
    keywords: [
      "anime4k on",
      "upscale anime",
      "sharper lines",
      "cleaner gradients",
      "real time upscale",
    ],
  },
  {
    label: "Show Anime4K indicator",
    section: "anime",
    anchorTitle: "Anime4K upscaling",
    keywords: ["anime4k badge", "fps indicator", "overlay badge", "status chip", "live fps"],
  },
  {
    label: "Anime4K presets",
    section: "anime",
    keywords: [
      "mode a",
      "mode b",
      "mode c",
      "mode a+a",
      "mode b+b",
      "mode c+a",
      "quality performance tier",
      "shader modes",
      "restore denoise",
    ],
  },
  {
    label: "Set up Anime4K",
    section: "anime",
    keywords: [
      "download shaders",
      "install anime4k",
      "shader pack",
      "one time setup",
      "get shaders",
    ],
  },
  {
    label: "Re-download",
    section: "anime",
    keywords: ["redownload shaders", "update anime4k", "refresh shader pack", "reinstall shaders"],
  },
  {
    label: "Smooth motion",
    section: "anime",
    anchorTitle: "Smooth motion",
    keywords: [
      "frame interpolation",
      "judder",
      "smooth panning",
      "motion smoothing",
      "fps boost",
      "drawn on twos",
    ],
  },
  {
    label: "Motion smoothing",
    section: "anime",
    anchorTitle: "Smooth motion",
    keywords: [
      "built in interpolation",
      "smooth motion",
      "60fps feel",
      "soap opera effect",
      "panning judder",
      "lighter than svp",
    ],
  },
  {
    label: "SVP frame interpolation",
    section: "anime",
    anchorTitle: "SVP frame interpolation",
    keywords: [
      "svp",
      "smooth video project",
      "60fps anime",
      "vapoursynth",
      "svpflow",
      "interpolation engine",
    ],
  },
  {
    label: "Get SVP (free)",
    section: "anime",
    anchorTitle: "SVP frame interpolation",
    keywords: ["install svp", "download svp", "svp free tier", "svp team"],
  },
  {
    label: "Open SVP",
    section: "anime",
    anchorTitle: "SVP frame interpolation",
    keywords: ["launch svp", "svp manager", "tray svp", "start svp"],
  },
  {
    label: "Enable SVP",
    section: "anime",
    anchorTitle: "SVP frame interpolation",
    keywords: [
      "svp on",
      "real interpolation",
      "48fps",
      "60fps",
      "black screen svp",
      "restart playback",
    ],
  },
  {
    label: "Apply SVP to",
    section: "anime",
    anchorTitle: "SVP frame interpolation",
    keywords: [
      "svp scope",
      "anime only",
      "all content",
      "movies and tv",
      "limit svp",
      "live action",
    ],
  },
  {
    label: "Default / Stremio",
    section: "playerLayout",
    keywords: [
      "player theme",
      "chrome theme",
      "stremio layout",
      "harbor layout",
      "button order",
      "layout tabs",
    ],
  },
  {
    label: "True black menus",
    section: "playerLayout",
    keywords: [
      "black menus",
      "pure black panels",
      "oled black",
      "ignore theme tint",
      "player menus",
    ],
  },
  {
    label: "Edit player layout",
    section: "playerLayout",
    keywords: [
      "customize player controls",
      "move buttons",
      "hide buttons",
      "reorder controls",
      "layout editor",
      "custom icons",
      "live preview",
    ],
  },
  {
    label: "Time format",
    section: "playerLayout",
    keywords: [
      "elapsed remaining",
      "clock labels",
      "seek bar time",
      "remaining only",
      "timestamps",
      "time display",
    ],
  },
  {
    label: "Volume control",
    section: "playerLayout",
    keywords: [
      "volume slider",
      "stepper",
      "icon only",
      "mute click",
      "volume widget style",
      "hover slider",
    ],
  },
  {
    label: "Show P2P status chip",
    section: "playerLayout",
    keywords: [
      "p2p chip",
      "torrent status",
      "peers speed",
      "download progress overlay",
      "torrent chip",
    ],
  },
  {
    label: "Save changes",
    section: "playerLayout",
    keywords: ["save layout", "apply layout changes", "keep layout", "commit layout"],
  },
  {
    label: "Discard changes",
    section: "playerLayout",
    keywords: ["revert layout", "undo layout edits", "throw away changes", "cancel edits"],
  },
  {
    label: "Reset all to default",
    section: "playerLayout",
    keywords: ["reset layout", "factory controls", "full reset", "default layout"],
  },
  {
    label: "Save as new profile...",
    section: "playerLayout",
    keywords: ["layout profile", "save profile", "new layout profile", "profile name"],
  },
  {
    label: "Rename current",
    section: "playerLayout",
    keywords: ["rename profile", "profile name", "change profile name", "edit name"],
  },
  {
    label: "Delete current",
    section: "playerLayout",
    keywords: ["delete profile", "remove layout profile", "drop profile", "erase profile"],
  },
  {
    label: "Export as file",
    section: "playerLayout",
    keywords: ["export layout", "share layout json", "backup layout", "save layout file"],
  },
  {
    label: "Import from file...",
    section: "playerLayout",
    keywords: ["import layout", "load layout file", "friend layout", "json import"],
  },
  {
    label: "Reset layout to defaults",
    section: "playerLayout",
    keywords: [
      "reset to defaults",
      "reset profile",
      "factory defaults layout",
      "restore defaults",
      "wipe tweaks",
    ],
  },
  {
    label: "Reset all ({n})",
    section: "hotkeys",
    keywords: ["reset hotkeys", "default bindings", "clear custom keys", "undo rebinds"],
  },
  {
    label: "Behavior",
    section: "hotkeys",
    anchorTitle: "Behavior",
    keywords: ["key behavior", "esc behavior", "seek step", "playback keys behavior"],
  },
  {
    label: "Esc exits fullscreen first",
    section: "hotkeys",
    anchorTitle: "Behavior",
    keywords: ["escape fullscreen", "esc close player", "exit fullscreen first", "escape key"],
  },
  {
    label: "Ask before leaving",
    section: "hotkeys",
    anchorTitle: "Behavior",
    keywords: [
      "confirm exit",
      "leave prompt",
      "close confirmation",
      "dont ask again",
      "quit confirm",
    ],
  },
  {
    label: "Seek step",
    section: "hotkeys",
    anchorTitle: "Behavior",
    keywords: [
      "arrow jump",
      "seek amount",
      "skip seconds",
      "back forward step",
      "10 seconds",
      "jump length",
    ],
  },
  {
    label: "Global",
    section: "hotkeys",
    anchorTitle: "Global",
    keywords: ["global shortcuts", "app wide keys", "anywhere shortcuts", "keyboard"],
  },
  {
    label: "Focus search",
    section: "hotkeys",
    anchorTitle: "Global",
    keywords: ["search shortcut", "slash key", "jump to search", "find", "quick search"],
  },
  {
    label: "Increase interface scale",
    section: "hotkeys",
    anchorTitle: "Global",
    keywords: ["zoom in", "bigger ui", "ctrl plus", "scale up", "enlarge"],
  },
  {
    label: "Decrease interface scale",
    section: "hotkeys",
    anchorTitle: "Global",
    keywords: ["zoom out", "smaller ui", "ctrl minus", "scale down", "shrink"],
  },
  {
    label: "Reset interface scale",
    section: "hotkeys",
    anchorTitle: "Global",
    keywords: ["reset zoom", "100 percent", "ctrl zero", "default scale"],
  },
  {
    label: "Adjust interface scale with wheel",
    section: "hotkeys",
    anchorTitle: "Global",
    keywords: ["ctrl scroll", "mouse wheel zoom", "resize interface", "cmd scroll"],
  },
  {
    label: "Player",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["player shortcuts", "playback keys", "in player hotkeys", "video shortcuts"],
  },
  {
    label: "Close player",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["escape", "exit playback", "quit player", "back out"],
  },
  {
    label: "Play / pause",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["space bar", "pause", "toggle playback", "play key"],
  },
  {
    label: "Toggle fullscreen",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["f key", "fullscreen toggle", "maximize video", "full screen"],
  },
  {
    label: "Picture-in-picture",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["pip", "floating window", "mini player", "always on top video", "u key"],
  },
  {
    label: "Toggle stats overlay",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["stats", "playback stats", "nerd info", "bitrate overlay", "i key"],
  },
  {
    label: "Cycle aspect / crop",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["aspect hotkey", "crop cycle", "v key", "fill zoom", "ratio cycle"],
  },
  {
    label: "Zoom out",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["panscan out", "restore black bars", "minus key", "unzoom"],
  },
  {
    label: "Zoom in",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["panscan in", "crop black bars", "equals key", "zoom mode"],
  },
  {
    label: "Screenshot",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["capture frame", "png screenshot", "snapshot", "p key", "pictures folder"],
  },
  {
    label: "Record GIF",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["gif recording", "capture gif", "o key", "animated gif"],
  },
  {
    label: "Save video clip",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["clip last 30 seconds", "save clip", "video capture", "c key", "clip with audio"],
  },
  {
    label: "Toggle Anime4K",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["anime4k hotkey", "a key", "upscale toggle", "shader toggle"],
  },
  {
    label: "Anime4K on",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["anime4k enable key", "ctrl 1", "upscaling on", "force anime4k"],
  },
  {
    label: "Anime4K off",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["anime4k disable key", "ctrl 0", "upscaling off", "stop shaders"],
  },
  {
    label: "Toggle RTX Video HDR",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["rtx hdr hotkey", "ctrl h", "nvidia video hdr", "hdr enhancement toggle"],
  },
  {
    label: "Seek back",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["rewind", "arrow left", "jump back", "skip backward"],
  },
  {
    label: "Seek forward",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["fast forward", "arrow right", "jump ahead", "skip forward"],
  },
  {
    label: "Seek back 30s",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["back thirty seconds", "comma key", "big rewind", "30 second jump"],
  },
  {
    label: "Seek forward 30s",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["forward thirty seconds", "period key", "big skip", "30 second jump"],
  },
  {
    label: "Previous frame",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["frame step back", "frame by frame", "pause frame", "frame accurate"],
  },
  {
    label: "Next frame",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["frame advance", "frame accurate step", "single frame", "step forward"],
  },
  {
    label: "Jump to start",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["home key", "beginning", "restart video", "go to start"],
  },
  {
    label: "Jump to end",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["end key", "skip to end", "finish", "last seconds"],
  },
  {
    label: "Volume up",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["louder", "arrow up", "raise volume", "shift big steps"],
  },
  {
    label: "Volume down",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["quieter", "arrow down", "lower volume", "softer"],
  },
  {
    label: "Toggle mute",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["mute", "unmute", "m key", "silence audio"],
  },
  {
    label: "Cycle subtitles",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["subtitle track cycle", "s key", "switch subs", "next subtitle"],
  },
  {
    label: "Cycle subtitles (alt)",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["alternate subtitle key", "c key", "muscle memory", "second binding"],
  },
  {
    label: "Subtitle delay −0.1s",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["sub delay earlier", "subtitle sync", "z key", "timing fix", "out of sync"],
  },
  {
    label: "Subtitle delay +0.1s",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["sub delay later", "subtitle sync", "x key", "timing fix", "shift later"],
  },
  {
    label: "Next episode",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["n key", "skip to next episode", "forward episode", "binge key"],
  },
  {
    label: "Previous episode",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["b key", "go back episode", "last episode", "prior episode"],
  },
  {
    label: "Previous channel",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["last channel", "live tv back", "h key", "channel zap", "channel history"],
  },
  {
    label: "Speed down",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["slower playback", "speed decrease", "bracket key", "0.25x slower"],
  },
  {
    label: "Speed up",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["faster playback", "speed increase", "bracket key", "0.25x faster"],
  },
  {
    label: "Stream switcher",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["switch stream", "change source in player", "w key", "source switcher"],
  },
  {
    label: "Up next / episodes",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["episode panel", "up next", "e key", "episode list", "season browser"],
  },
  {
    label: "TV guide",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["live tv guide", "epg", "g key", "channels list", "program guide"],
  },
  {
    label: "DVR / record",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["record live tv", "dvr", "r key", "recorder", "live recording"],
  },
  {
    label: "Sleep at end of episode",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["sleep timer", "pause after episode", "l key", "bedtime", "auto pause"],
  },
  {
    label: "Theme",
    section: "theme",
    anchorTitle: "Theme",
    keywords: [
      "color theme",
      "theme presets",
      "palette",
      "appearance",
      "look",
      "dark theme",
      "skins",
    ],
  },
  {
    label: "Custom",
    section: "theme",
    anchorTitle: "Theme",
    keywords: [
      "custom palette",
      "build your own colors",
      "theme editor",
      "hand tuned colors",
      "diy theme",
    ],
  },
  {
    label: "Background image",
    section: "theme",
    anchorTitle: "Background image",
    keywords: [
      "wallpaper",
      "backdrop image",
      "custom background",
      "background photo",
      "app background",
    ],
  },
  {
    label: "Choose image",
    section: "theme",
    anchorTitle: "Background image",
    keywords: [
      "upload wallpaper",
      "pick image",
      "replace image",
      "jpeg png webp",
      "set background",
    ],
  },
  {
    label: "Remove",
    section: "theme",
    anchorTitle: "Background image",
    keywords: ["remove background", "clear wallpaper", "delete image", "no background"],
  },
  {
    label: "Dim overlay",
    section: "theme",
    anchorTitle: "Background image",
    keywords: [
      "dim slider",
      "darken background",
      "readability",
      "overlay strength",
      "background dim",
    ],
  },
  {
    label: "Typography",
    section: "theme",
    anchorTitle: "Typography",
    keywords: ["fonts", "font pairing", "display font", "body font", "typeface", "lettering"],
  },
  {
    label: "Upload a font",
    section: "theme",
    anchorTitle: "Typography",
    keywords: ["custom font", "ttf otf woff woff2", "install font", "own font", "add font"],
  },
  {
    label: "Your themes",
    section: "theme",
    anchorTitle: "Your themes",
    keywords: ["theme studio", "community themes", "custom themes", "import themes", "my themes"],
  },
  {
    label: "Theme Library",
    section: "theme",
    anchorTitle: "Your themes",
    keywords: [
      "browse themes",
      "theme gallery",
      "apply theme",
      "one click theme",
      "library",
      "featured themes",
    ],
  },
  {
    label: "Build a Theme",
    section: "theme",
    anchorTitle: "Your themes",
    keywords: [
      "theme studio",
      "create theme",
      "make your own theme",
      "no code theming",
      "open studio",
    ],
  },
  {
    label: "Import a Theme",
    section: "theme",
    anchorTitle: "Your themes",
    keywords: ["import theme file", "harborstyle", "shared theme", "drop theme", "choose file"],
  },
  {
    label: "Edit colors",
    section: "theme",
    anchorTitle: "Your themes",
    keywords: ["customize theme colors", "tweak palette", "color editor", "adjust theme"],
  },
  {
    label: "Copy theme",
    section: "theme",
    anchorTitle: "Your themes",
    keywords: ["export theme", "share theme", "copy theme text", "send theme"],
  },
  {
    label: "Poster card style",
    section: "theme",
    anchorTitle: "Poster card style",
    keywords: [
      "poster size",
      "card size",
      "corner radius",
      "poster scale",
      "width height",
      "live preview",
    ],
  },
  {
    label: "Poster card size",
    section: "theme",
    anchorTitle: "Poster card style",
    keywords: ["compact", "dense", "standard", "comfort", "large", "poster size preset"],
  },
  {
    label: "Corner radius",
    section: "theme",
    anchorTitle: "Poster card style",
    keywords: ["rounded corners", "sharp", "pill", "subtle", "radius", "square posters"],
  },
  {
    label: "Load effect",
    section: "theme",
    anchorTitle: "Poster card style",
    keywords: ["blur up", "fade in", "instant load", "poster loading animation", "low power"],
  },
  {
    label: "Title text",
    section: "theme",
    anchorTitle: "Title text",
    keywords: ["title size", "row titles", "player title", "text scale", "heading size"],
  },
  {
    label: "Row titles",
    section: "theme",
    anchorTitle: "Title text",
    keywords: ["row title size", "rail headings", "home titles bigger", "section titles"],
  },
  {
    label: "Player title",
    section: "theme",
    anchorTitle: "Title text",
    keywords: ["player title size", "title in player", "bigger player title", "scale title"],
  },
  {
    label: "Show series name first in the player",
    section: "theme",
    anchorTitle: "Title text",
    keywords: ["series name first", "show name before episode", "title order", "lead with show"],
  },
  {
    label: "Accessibility",
    section: "theme",
    anchorTitle: "Accessibility",
    keywords: [
      "bigger text",
      "ui scale",
      "readability",
      "4k scaling",
      "visual accessibility",
      "easier to read",
    ],
  },
  {
    label: "Interface scale",
    section: "theme",
    anchorTitle: "Accessibility",
    keywords: [
      "ui zoom",
      "interface size",
      "scale slider",
      "bigger interface",
      "small text fix",
      "ultrawide",
    ],
  },
  {
    label: "Show format chips on stream rows",
    section: "theme",
    anchorTitle: "Stream format chips",
    keywords: [
      "4k chip",
      "hdr chip",
      "codec badge",
      "audio badge",
      "hide chips",
      "resolution tags",
    ],
  },
  {
    label: "Home hero",
    section: "theme",
    anchorTitle: "Home hero",
    keywords: ["hero banner", "featured banner", "big hero", "home banner"],
  },
  {
    label: "Full hero banner",
    section: "theme",
    anchorTitle: "Home hero",
    keywords: ["edge to edge hero", "taller hero", "stretch banner", "bigger featured"],
  },
  {
    label: "Full quality hero image",
    section: "theme",
    anchorTitle: "Home hero",
    keywords: ["high res hero", "sharper artwork", "hero bandwidth", "full resolution banner"],
  },
  {
    label: "Shadow",
    section: "theme",
    anchorTitle: "Home hero shadow",
    keywords: ["shadow slider", "gradient darkness", "hero dim", "let artwork show"],
  },
  {
    label: "Autoplay trailer on detail pages",
    section: "theme",
    anchorTitle: "Trailer quality",
    keywords: [
      "auto trailer",
      "muted trailer",
      "backdrop trailer",
      "detail page video",
      "autoplay preview",
    ],
  },
  {
    label: "Start trailers with audio",
    section: "theme",
    anchorTitle: "Trailer quality",
    keywords: ["unmuted trailer", "trailer sound on", "audio autoplay", "start with sound"],
  },
  {
    label: "Show thumbnail preview on hover",
    section: "theme",
    anchorTitle: "Seek bar",
    keywords: [
      "trickplay",
      "scrub thumbnails",
      "hover preview",
      "seek preview",
      "filmstrip",
      "frame preview",
    ],
  },
  {
    label: "Bar style",
    section: "theme",
    anchorTitle: "Seek bar",
    keywords: ["flat", "glass", "pinstripe", "rainbow", "seek bar texture", "timeline look"],
  },
  {
    label: "Bar height",
    section: "theme",
    anchorTitle: "Seek bar",
    keywords: ["thicker bar", "thin bar", "timeline height", "bar size"],
  },
  {
    label: "Bar color",
    section: "theme",
    anchorTitle: "Seek bar",
    keywords: ["seek bar color", "accent color", "recolor progress", "custom color", "gold accent"],
  },
  {
    label: "Bar image",
    section: "theme",
    anchorTitle: "Seek bar",
    keywords: ["tiled pattern", "custom bar image", "gif bar", "texture upload", "pattern bar"],
  },
  {
    label: "Seek dot shape",
    section: "theme",
    anchorTitle: "Seek bar",
    keywords: ["circle", "square", "custom image dot", "hidden dot", "handle shape", "no dot"],
  },
  {
    label: "Dot size",
    section: "theme",
    anchorTitle: "Seek bar",
    keywords: ["handle size", "knob size", "image size", "bigger dot", "scrubber size"],
  },
  {
    label: "Dot image",
    section: "theme",
    anchorTitle: "Seek bar",
    keywords: ["nyan cat", "sticker dot", "custom knob", "gif dot", "png sticker", "animated dot"],
  },
  {
    label: "Use the native window title bar",
    section: "theme",
    anchorTitle: "Window title bar",
    keywords: [
      "os titlebar",
      "minimize maximize close",
      "native window controls",
      "system title bar",
      "window buttons reachable",
    ],
  },
  {
    label: "Where alerts go",
    section: "webhooks",
    anchorTitle: "Where alerts go",
    keywords: ["discord telegram", "notifications destination", "alerts channel", "webhook setup"],
  },
  {
    label: "Discord webhook URL",
    section: "webhooks",
    anchorTitle: "Where alerts go",
    keywords: [
      "discord webhook",
      "discord alerts",
      "channel ping",
      "webhook url",
      "send test",
      "discord notifications",
    ],
  },
  {
    label: "Telegram bot",
    section: "webhooks",
    anchorTitle: "Where alerts go",
    keywords: [
      "telegram alerts",
      "telegram webhook",
      "botfather",
      "send test",
      "telegram notifications",
    ],
  },
  {
    label: "Bot token",
    section: "webhooks",
    anchorTitle: "Where alerts go",
    keywords: ["telegram bot token", "botfather token", "api token", "bot key"],
  },
  {
    label: "Chat ID",
    section: "webhooks",
    anchorTitle: "Where alerts go",
    keywords: ["telegram chat id", "group id", "channel id", "chat number"],
  },
  {
    label: "What to send",
    section: "webhooks",
    anchorTitle: "What to send",
    keywords: ["alert sources", "calendars", "feeds", "which alerts", "dedupe sources"],
  },
  {
    label: "My library",
    section: "webhooks",
    anchorTitle: "What to send",
    keywords: [
      "library alerts",
      "saved shows notifications",
      "stremio library releases",
      "my shows",
    ],
  },
  {
    label: "All upcoming",
    section: "webhooks",
    anchorTitle: "What to send",
    keywords: ["everything releasing", "monthly releases", "tmdb upcoming", "all new"],
  },
  {
    label: "My Trakt",
    section: "webhooks",
    anchorTitle: "What to send",
    keywords: [
      "trakt watchlist alerts",
      "trakt upcoming",
      "trakt notifications",
      "watchlist pings",
    ],
  },
  {
    label: "Anticipated",
    section: "webhooks",
    anchorTitle: "What to send",
    keywords: ["trakt anticipated", "most hyped", "anticipated releases", "no login source"],
  },
  {
    label: "Custom calendar",
    section: "webhooks",
    anchorTitle: "What to send",
    keywords: [
      "tracked people",
      "genres providers countries",
      "custom calendar alerts",
      "my calendar",
    ],
  },
  {
    label: "Media types",
    section: "webhooks",
    anchorTitle: "Media types",
    keywords: ["filter type", "movies tv anime filter", "type filter", "media filter"],
  },
  {
    label: "Movies",
    section: "webhooks",
    anchorTitle: "Media types",
    keywords: ["movie alerts", "films only", "movie filter", "notify movies"],
  },
  {
    label: "TV",
    section: "webhooks",
    anchorTitle: "Media types",
    keywords: ["tv alerts", "series only", "shows", "notify tv"],
  },
  {
    label: "Anime",
    section: "webhooks",
    anchorTitle: "Media types",
    keywords: ["anime alerts", "anime only", "notify anime", "anime filter"],
  },
  {
    label: "AUTOMATIONS",
    section: "webhooks",
    keywords: ["rules", "automations", "custom alert rules", "triggers", "ping rules", "rule list"],
  },
  {
    label: "New rule",
    section: "webhooks",
    keywords: [
      "create rule",
      "new automation",
      "when then",
      "tracked person trigger",
      "genre trigger",
      "streamer trigger",
      "country trigger",
      "live tv reminder",
      "lead minutes",
    ],
  },
  {
    label: "What broke?",
    section: "bug",
    anchorTitle: "What broke?",
    keywords: ["report bug", "describe issue", "bug form", "broken feature"],
  },
  {
    label: "Summary",
    section: "bug",
    anchorTitle: "What broke?",
    keywords: ["bug summary", "issue title", "short description", "one liner"],
  },
  {
    label: "Severity",
    section: "bug",
    anchorTitle: "What broke?",
    keywords: ["low normal high critical", "priority", "how bad", "cosmetic broken unusable"],
  },
  {
    label: "Steps to reproduce",
    section: "bug",
    anchorTitle: "What broke?",
    keywords: ["repro steps", "how to trigger", "reproduce bug", "step by step"],
  },
  {
    label: "What you expected",
    section: "bug",
    anchorTitle: "What broke?",
    keywords: ["expected behavior", "should happen", "expected result"],
  },
  {
    label: "What actually happened",
    section: "bug",
    anchorTitle: "What broke?",
    keywords: ["actual behavior", "what went wrong", "actual result", "instead"],
  },
  {
    label: "Screenshots and recordings",
    section: "bug",
    anchorTitle: "Screenshots and recordings",
    keywords: [
      "attach screenshot",
      "screen recording",
      "upload clip",
      "drag and drop files",
      "evidence",
      "mp4 gif",
    ],
  },
  {
    label: "Player log",
    section: "bug",
    anchorTitle: "Player log",
    keywords: ["mpv log", "player log export", "playback log", "stream misbehaves"],
  },
  {
    label: "Export player log",
    section: "bug",
    anchorTitle: "Player log",
    keywords: [
      "export log",
      "save log to downloads",
      "harbor-mpv-log",
      "diagnostics file",
      "attach log",
    ],
  },
  {
    label: "Credit (optional)",
    section: "bug",
    anchorTitle: "Credit (optional)",
    keywords: ["reporter name", "github username", "contact", "anonymous report", "display name"],
  },
  {
    label: "Credit me in the release notes if this report leads to a fix.",
    section: "bug",
    anchorTitle: "Credit (optional)",
    keywords: ["release notes credit", "attribution consent", "credit reporter", "name in notes"],
  },
  {
    label: "Want to fix it yourself?",
    section: "bug",
    keywords: ["contribute fix", "pull request", "open repo", "github pr", "browse pull requests"],
  },
  {
    label: "What gets sent",
    section: "bug",
    keywords: ["diagnostics", "environment details", "privacy", "what data is sent", "no keys"],
  },
  {
    label: "Submit bug report",
    section: "bug",
    keywords: ["send bug report", "file bug", "submit issue", "report problem"],
  },
  {
    label: "Updates",
    section: "advanced",
    anchorTitle: "Updates",
    keywords: ["app updates", "new version", "update channel", "auto update"],
  },
  {
    label: "Check for updates",
    section: "advanced",
    anchorTitle: "Updates",
    keywords: [
      "update check",
      "latest version",
      "check now",
      "update now",
      "install update",
      "restart to update",
    ],
  },
  {
    label: "Get beta updates",
    section: "advanced",
    anchorTitle: "Updates",
    keywords: [
      "beta channel",
      "early builds",
      "prerelease",
      "beta opt in",
      "nightly",
      "back to stable",
    ],
  },
  {
    label: "Roll back to an earlier build",
    section: "advanced",
    anchorTitle: "Updates",
    keywords: [
      "rollback",
      "downgrade",
      "previous version",
      "earlier build",
      "old installer",
      "broken beta",
    ],
  },
  {
    label: "How is this build treating you?",
    section: "advanced",
    anchorTitle: "Updates",
    keywords: [
      "rate build",
      "build feedback",
      "better or worse",
      "feedback slider",
      "send rating",
      "beta rating",
    ],
  },
  {
    label: "Export everything",
    section: "advanced",
    anchorTitle: "Backup & restore",
    keywords: ["export backup", "save setup file", "harbx", "full backup", "backup file"],
  },
  {
    label: "Restore from a backup",
    section: "advanced",
    anchorTitle: "Backup & restore",
    keywords: ["import backup", "load backup", "new computer", "restore settings", "replace setup"],
  },
  {
    label: "Downloads",
    section: "advanced",
    anchorTitle: "Downloads",
    keywords: ["download folder", "save location", "downloads directory", "where videos save"],
  },
  {
    label: "Choose folder",
    section: "advanced",
    anchorTitle: "Downloads",
    keywords: [
      "pick folder",
      "change download location",
      "different drive",
      "reset to default",
      "open folder",
    ],
  },
  {
    label: "Privacy",
    section: "advanced",
    anchorTitle: "Privacy",
    keywords: ["telemetry", "trackers", "analytics", "privacy settings", "no tracking"],
  },
  {
    label: "Block ads & trackers",
    section: "advanced",
    anchorTitle: "Privacy",
    keywords: [
      "adblock",
      "block trackers",
      "analytics blocking",
      "tracker requests",
      "no telemetry",
      "ad blocking",
    ],
  },
  {
    label: "System tray",
    section: "advanced",
    anchorTitle: "System tray",
    keywords: ["tray", "background app", "tray menu", "minimize behavior"],
  },
  {
    label: "Close to the system tray",
    section: "advanced",
    anchorTitle: "System tray",
    keywords: ["minimize to tray", "close to tray", "keep running", "quit behavior", "tray icon"],
  },
  {
    label: "Always on top",
    section: "advanced",
    anchorTitle: "System tray",
    keywords: ["pin window", "on top", "above other windows", "floating window"],
  },
  {
    label: "Pause when minimized",
    section: "advanced",
    anchorTitle: "System tray",
    keywords: ["pause on minimize", "background pause", "stop when minimized", "auto pause"],
  },
  {
    label: "Pause when unfocused",
    section: "advanced",
    anchorTitle: "System tray",
    keywords: ["pause on focus loss", "alt tab pause", "unfocused pause", "another window"],
  },
  {
    label: "Catch stremio:// install links inside Harbor",
    section: "advanced",
    anchorTitle: "Stremio install links",
    keywords: [
      "protocol handler",
      "stremio link handler",
      "in app installer",
      "addon install",
      "default app",
      "configure and install",
    ],
  },
  {
    label: "Show on Discord",
    section: "advanced",
    anchorTitle: "Discord Rich Presence",
    keywords: ["discord presence", "watching status", "show activity", "profile status"],
  },
  {
    label: "Hide the title",
    section: "advanced",
    anchorTitle: "Discord Rich Presence",
    keywords: ["private watching", "hide show name", "watching something", "no poster"],
  },
  {
    label: "Show while paused",
    section: "advanced",
    anchorTitle: "Discord Rich Presence",
    keywords: ["presence when paused", "keep status paused", "paused visibility"],
  },
  {
    label: "Show while browsing",
    section: "advanced",
    anchorTitle: "Discord Rich Presence",
    keywords: ["browsing harbor status", "idle presence", "browsing activity"],
  },
  {
    label: "Show poster",
    section: "advanced",
    anchorTitle: "Discord Rich Presence",
    keywords: ["show artwork", "poster on discord", "hide poster", "movie art"],
  },
  {
    label: "Show elapsed time",
    section: "advanced",
    anchorTitle: "Discord Rich Presence",
    keywords: ["progress bar discord", "timestamp", "elapsed time", "how far in"],
  },
  {
    label: "Watch party join button",
    section: "advanced",
    anchorTitle: "Discord Rich Presence",
    keywords: ["join button", "watch party invite", "room link", "party join"],
  },
  {
    label: "API budget",
    section: "advanced",
    anchorTitle: "API budget",
    keywords: ["api quota", "daily budget", "rate limit", "call counter"],
  },
  {
    label: "OMDB daily budget",
    section: "advanced",
    anchorTitle: "API budget",
    keywords: ["omdb quota", "rating lookups", "reset counter", "api calls", "fresh scores"],
  },
  {
    label: "Onboarding",
    section: "advanced",
    anchorTitle: "Onboarding",
    keywords: ["walkthrough", "welcome tour", "tips", "first run"],
  },
  {
    label: "Replay walkthrough",
    section: "advanced",
    anchorTitle: "Onboarding",
    keywords: ["replay tour", "welcome flow", "redo onboarding", "tutorial again"],
  },
  {
    label: "Restore dismissed hints",
    section: "advanced",
    anchorTitle: "Onboarding",
    keywords: ["bring back tips", "hints", "nudges", "dismissed tips", "unhide tips"],
  },
  {
    label: "Repair library",
    section: "advanced",
    anchorTitle: "Stremio library repair",
    keywords: ["repair now", "rewrite items", "stremio crash fix", "library scan", "run again"],
  },
  {
    label: "Custom code",
    section: "advanced",
    anchorTitle: "Custom code",
    keywords: [
      "custom css",
      "custom js",
      "custom html",
      "modding",
      "inject code",
      "user styles",
      "power user",
    ],
  },
  {
    label: "Custom CSS",
    section: "advanced",
    anchorTitle: "Custom code",
    keywords: [
      "css override",
      "restyle",
      "user styles",
      "retheme buttons",
      "stylesheet",
      "live injected",
    ],
  },
  {
    label: "Custom JS",
    section: "advanced",
    anchorTitle: "Custom code",
    keywords: ["javascript injection", "userscript", "scripts", "mod client", "no sandbox"],
  },
  {
    label: "Custom HTML overlay",
    section: "advanced",
    anchorTitle: "Custom code",
    keywords: ["html overlay", "custom widget", "fixed overlay", "injected html", "pointer events"],
  },
  {
    label: "About",
    section: "advanced",
    anchorTitle: "About",
    keywords: ["version", "build info", "bug email", "app version", "desktop or web"],
  },
  {
    label: "Get Harbor for desktop",
    section: "advanced",
    keywords: ["download desktop app", "desktop version", "web limitations", "install harbor"],
  },
  {
    label: "Source code",
    section: "advanced",
    keywords: ["github repo", "open source", "source", "code repository"],
  },
];

export function SettingsNav({
  active,
  onChange,
}: {
  active: SectionId;
  onChange: (id: SectionId, anchor?: string) => void;
}) {
  const { settings } = useSettings();
  const { goBack, canGoBack, setView } = useView();
  const t = useT();
  const isNew = useSettingsNew();
  const navLayout = activeLayout(settings.theme);
  const showBack = navLayout === "custom" || navLayout === "minui";
  const [query, setQuery] = useState("");
  const trimmed = query.trim().toLowerCase();
  const sectionLabel = useMemo(() => {
    const m = new Map<SectionId, string>();
    for (const group of NAV_GROUPS) for (const item of group.items) m.set(item.id, item.label);
    return m;
  }, []);
  const matches = useMemo<NavItem[] | null>(() => {
    if (!trimmed) return null;
    const out: NavItem[] = [];
    for (const group of NAV_GROUPS) {
      const groupHit = group.heading ? matchesSettingsSearch(trimmed, [group.heading], t) : false;
      for (const item of group.items) {
        const hit =
          groupHit ||
          matchesSettingsSearch(trimmed, [item.label], t) ||
          (item.keywords ?? []).some((k) => k.toLowerCase().includes(trimmed));
        if (hit) out.push(item);
      }
    }
    return out;
  }, [t, trimmed]);
  const optionMatches = useMemo<SettingsOption[] | null>(() => {
    if (!trimmed) return null;
    return SETTINGS_OPTIONS.filter(
      (o) =>
        matchesSettingsSearch(trimmed, [o.label], t) ||
        (o.keywords ?? []).some((k) => k.toLowerCase().includes(trimmed)),
    );
  }, [t, trimmed]);

  const libraryKeys = [
    settings.tmdbKey,
    settings.omdbKey,
    settings.rpdbKey,
    settings.fanartKey,
    settings.tvdbKey,
  ].filter(Boolean).length;

  const debridKeys = [
    settings.rdKey,
    settings.tbKey,
    settings.adKey,
    settings.pmKey,
    settings.dlKey,
  ].filter(Boolean).length;

  const debridChip = libraryKeys > 0 ? `${libraryKeys}/5` : null;

  const relayLive = settings.togetherRelayUrl ? "live" : null;
  const webhookActive =
    (settings.webhooks.discordUrl || settings.webhooks.telegramUrl) &&
    Object.values(settings.webhooks.sources).some(Boolean);

  const status: Record<SectionId, string | null> = {
    basics: null,
    account: null,
    library: libraryKeys > 0 ? `${libraryKeys}/5` : null,
    trakt: null,
    anilist: null,
    mal: null,
    simkl: null,
    letterboxd: settings.letterboxd.enabled
      ? settings.letterboxd.mode === "full"
        ? "FULL"
        : "ON"
      : null,
    relay: relayLive,
    streaming: debridChip,
    streamFilters: settings.customStreamFilters?.length
      ? String(settings.customStreamFilters.length)
      : null,
    p2p: null,
    language: null,
    player: settings.playerEngine === "auto" ? null : settings.playerEngine,
    mpv:
      (settings.mpvQuality ?? "balanced") === "balanced"
        ? null
        : settings.mpvQuality === "performance"
          ? "lite"
          : "max",
    anime: settings.playerAnime4k ? "on" : null,
    playerLayout: null,
    theme:
      settings.theme.preset === "cool-grey" && settings.theme.fontPair === "sentient-switzer"
        ? null
        : "•",
    webhooks: webhookActive ? "live" : null,
    hotkeys: null,
    bug: null,
    advanced: null,
  };

  const renderItem = ({ id, label, Icon }: NavItem) => {
    const isActive = id === active;
    const chip = status[id];
    const debridChipLocal = id === "streaming" && debridKeys > 0 ? `${debridKeys}D` : null;
    return (
      <button
        key={id}
        onClick={() => {
          onChange(id);
          setQuery("");
        }}
        className={`group flex h-14 w-full items-center gap-3 rounded-xl px-2.5 text-start transition-colors ${
          isActive
            ? "bg-raised text-ink shadow-[inset_0_0_0_1px_var(--color-edge)]"
            : "text-ink-muted hover:bg-elevated/70 hover:text-ink"
        }`}
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
            isActive
              ? "bg-elevated text-ink shadow-[inset_0_0_0_1px_var(--color-edge-soft)]"
              : "bg-canvas/60 text-ink-subtle group-hover:text-ink-muted"
          }`}
        >
          <Icon size={20} strokeWidth={1.6} />
        </span>
        <span className="flex-1 truncate text-[14.5px] font-medium">{t(label)}</span>
        {(chip || debridChipLocal) && (
          <span className="flex shrink-0 gap-1">
            {debridChipLocal && (
              <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-accent">
                {debridChipLocal}
              </span>
            )}
            {chip && (
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wide ${
                  chip === "live" || chip === "via relay"
                    ? "bg-accent/15 text-accent"
                    : "bg-canvas/70 text-ink-subtle"
                }`}
              >
                {chip}
              </span>
            )}
          </span>
        )}
      </button>
    );
  };

  return (
    <nav
      data-harbor-sidebar
      data-tv-scroll-focus
      className="relative flex w-72 shrink-0 flex-col bg-surface pt-24 shadow-[1px_0_0_var(--color-edge)]"
    >
      <div data-tauri-drag-region className="h-3 shrink-0" />
      {showBack && (
        <div className="px-3 pb-1.5">
          <button
            type="button"
            onClick={() => (canGoBack ? goBack() : setView("home"))}
            className="flex h-10 w-full items-center gap-2 rounded-xl px-3 text-start text-[13.5px] font-semibold text-ink-muted transition-colors hover:bg-elevated/70 hover:text-ink"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="dir-icon"
            >
              <path d="M15 5l-7 7 7 7" />
            </svg>
            {t("Back")}
          </button>
        </div>
      )}
      <div className="px-3 pb-3">
        <div className="flex h-10 items-center gap-2 rounded-xl bg-elevated/70 px-3 shadow-[inset_0_0_0_1px_var(--color-edge-soft)]">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-ink-subtle"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Search settings")}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-subtle"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (matches && matches.length > 0) {
                  onChange(matches[0].id);
                  setQuery("");
                } else if (optionMatches && optionMatches.length > 0) {
                  const o = optionMatches[0];
                  onChange(o.section, o.anchorTitle ? settingsAnchor(o.anchorTitle) : undefined);
                  setQuery("");
                }
              } else if (e.key === "Escape") {
                setQuery("");
              }
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="shrink-0 text-ink-subtle transition-colors hover:text-ink"
              aria-label={t("Clear")}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 pb-8">
        {matches && (
          <div className="flex flex-col gap-1">
            {matches.length === 0 && (!optionMatches || optionMatches.length === 0) && (
              <div className="px-3.5 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-subtle/80">
                {t("No matches")}
              </div>
            )}
            {matches.length > 0 && (
              <>
                <div className="px-3.5 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-subtle/80">
                  {matches.length === 1
                    ? t("{n} tab", { n: matches.length })
                    : t("{n} tabs", { n: matches.length })}
                </div>
                {matches.map(renderItem)}
              </>
            )}
            {optionMatches && optionMatches.length > 0 && (
              <>
                <div className="px-3.5 pb-1.5 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-subtle/80">
                  {optionMatches.length === 1
                    ? t("{n} option", { n: optionMatches.length })
                    : t("{n} options", { n: optionMatches.length })}
                </div>
                {optionMatches.map((o) => (
                  <button
                    key={`${o.section}-${o.label}`}
                    onClick={() => {
                      onChange(
                        o.section,
                        o.anchorTitle ? settingsAnchor(o.anchorTitle) : undefined,
                      );
                      setQuery("");
                    }}
                    className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start text-ink-muted transition-colors hover:bg-elevated/70 hover:text-ink"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-canvas/60 text-ink-subtle group-hover:text-ink-muted">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-3.5-3.5" />
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">
                        {t(o.label)}
                      </span>
                      <span className="block truncate text-[11px] text-ink-subtle">
                        {t(sectionLabel.get(o.section) ?? o.section)}
                      </span>
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
        {!matches &&
          NAV_GROUPS.map((group, gi) => (
            <div key={gi} className="flex flex-col gap-1">
              {group.heading && (
                <div className="px-3.5 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-subtle/80">
                  {t(group.heading)}
                </div>
              )}
              {group.items.map(({ id, label, Icon }) => {
                const isActive = id === active;
                const chip = status[id];
                const debridChip = id === "streaming" && debridKeys > 0 ? `${debridKeys}D` : null;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      onChange(id);
                      markSectionSeen(id);
                    }}
                    className={`group flex h-14 w-full items-center gap-3 rounded-xl px-2.5 text-start transition-colors ${
                      isActive
                        ? "bg-raised text-ink shadow-[inset_0_0_0_1px_var(--color-edge)]"
                        : "text-ink-muted hover:bg-elevated/70 hover:text-ink"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                        isActive
                          ? "bg-elevated text-ink shadow-[inset_0_0_0_1px_var(--color-edge-soft)]"
                          : "bg-canvas/60 text-ink-subtle group-hover:text-ink-muted"
                      }`}
                    >
                      <Icon size={20} strokeWidth={1.6} />
                    </span>
                    <span className="flex-1 truncate text-[14.5px] font-medium">{t(label)}</span>
                    {isNew(id) && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent/15 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-accent ring-1 ring-accent/30">
                        <span className="h-1 w-1 rounded-full bg-accent" />
                        {t("New")}
                      </span>
                    )}
                    {(chip || debridChip) && (
                      <span className="flex shrink-0 gap-1">
                        {debridChip && (
                          <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-accent">
                            {debridChip}
                          </span>
                        )}
                        {chip && (
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wide ${
                              chip === "live" || chip === "via relay"
                                ? "bg-accent/15 text-accent"
                                : "bg-canvas/70 text-ink-subtle"
                            }`}
                          >
                            {chip}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
      </div>
    </nav>
  );
}
