import { useMemo, useState } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { activeLayout } from "@/lib/theme";
import { useView } from "@/lib/view";
import {
  matchesSettingsSearch,
  rankSettingsSearch,
  setSettingsSearchVocabulary,
} from "./search-match";
import { settingsAnchor, type SectionId } from "./shared";
import { TOP_GROUPS } from "./groups";
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

function IconChevronRight(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M9 5l7 7-7 7" />
    </IconBase>
  );
}

function IconRemotes(p: IconProps) {
  return (
    <IconBase {...p}>
      <rect x="7.5" y="3.5" width="9" height="17" rx="2.4" />
      <path d="M10.8 17.6h2.4" />
      <path d="M19.6 7.2a6.6 6.6 0 0 1 0 4.6" />
      <path d="M4.4 7.2a6.6 6.6 0 0 0 0 4.6" />
    </IconBase>
  );
}

function IconTvSettings(p: IconProps) {
  return (
    <IconBase {...p}>
      <rect x="2.5" y="4.5" width="19" height="12.5" rx="2.2" />
      <path d="M8.5 20.5h7" />
      <path d="M12 17v3.5" />
      <circle cx="12" cy="10.75" r="2.1" />
      <path d="M12 6.6v1.4" />
      <path d="M12 13.5v1.4" />
      <path d="M15.6 8.7l-1.2.7" />
      <path d="M9.6 12.1l-1.2.7" />
      <path d="M15.6 12.8l-1.2-.7" />
      <path d="M9.6 9.4l-1.2-.7" />
    </IconBase>
  );
}

function IconStorage(p: IconProps) {
  return (
    <IconBase {...p}>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" />
      <path d="M4.5 5.5v13c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8v-13" />
      <path d="M4.5 12c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8" />
    </IconBase>
  );
}

function IconBasics(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.8 8.2l-2.3 5.3-5.3 2.3 2.3-5.3z" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="var(--color-canvas)" stroke="none" />
    </IconBase>
  );
}

function IconStreamBadges(p: IconProps) {
  return (
    <IconBase {...p}>
      <rect x="3" y="10" width="18" height="9.5" rx="2.5" />
      <path d="M7 14.75h3.2" />
      <path d="M13.6 14.75h3.4" />
      <path d="M17.5 3.2v3.6" />
      <path d="M15.7 5h3.6" />
      <path
        d="M6.5 5.5l.6 1.3 1.3.6-1.3.6-.6 1.3-.6-1.3-1.3-.6 1.3-.6z"
        fill="currentColor"
        stroke="none"
      />
    </IconBase>
  );
}

function IconAward(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M8 4h8v3a4 4 0 0 1-8 0V4z" />
      <path d="M8 5H6a2 2 0 0 0 2 3" />
      <path d="M16 5h2a2 2 0 0 1-2 3" />
      <path d="M12 11v4" />
      <path d="M9.5 15h5" />
      <path d="M8 20h8" />
      <path d="M9.8 15 9 20" />
      <path d="M14.2 15 15 20" />
      <path
        d="M12 4.9l.62 1.3 1.43.19-1.04.98.25 1.42L12 8.29l-1.26.69.25-1.42-1.04-.98 1.43-.19z"
        fill="currentColor"
        stroke="none"
      />
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

function IconSubtitles(p: IconProps) {
  return (
    <IconBase {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M6.5 14h4" />
      <path d="M13 14h4.5" />
      <path d="M6.5 10.5h3" />
      <path d="M12 10.5h5.5" />
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

function IconShaders(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M11 3.5L5.5 17H16.5Z" />
      <path d="M2.5 10.5H8" />
      <path d="M14 11.5L21.5 9M14 11.5L21.5 12.5M14 11.5L21.5 16" />
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

function IconController(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M8.5 8h7a5 5 0 0 1 4.9 4l1 5a2.2 2.2 0 0 1-4 1.6L15.6 15a2 2 0 0 0-1.6-.8h-4a2 2 0 0 0-1.6.8l-1.8 3.4a2.2 2.2 0 0 1-4-1.6l1-5A5 5 0 0 1 8.5 8z" />
      <path d="M7.5 11.1v2.4M6.3 12.3h2.4" strokeLinecap="round" />
      <circle cx="15.4" cy="11.6" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="17.2" cy="13" r="0.9" fill="currentColor" stroke="none" />
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

function IconUpdates(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M12 3v10" />
      <path d="m8 9.5 4 4 4-4" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
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

function IconSupport(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M12 20.5s-7.5-4.3-7.5-9.4A4.1 4.1 0 0 1 12 8.4a4.1 4.1 0 0 1 7.5 2.7c0 5.1-7.5 9.4-7.5 9.4z" />
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
        id: "trackers",
        label: "Trackers",
        Icon: IconTrakt,
        keywords: [
          "trakt",
          "simkl",
          "anilist",
          "mal",
          "myanimelist",
          "letterboxd",
          "scrobble",
          "sync",
          "watch history",
          "connect service",
        ],
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
      {
        id: "remotes",
        label: "Remotes",
        Icon: IconRemotes,
        keywords: [
          "remote",
          "phone remote",
          "manga remote",
          "reader remote",
          "web ui",
          "harbor in browser",
          "web app",
          "11471",
          "wifi",
          "lan",
          "couch",
          "control from phone",
          "cast",
          "tv browser",
          "flipbook remote",
        ],
      },
      {
        id: "tv",
        label: "TV Settings",
        Icon: IconTvSettings,
        keywords: [
          "tv",
          "tv settings",
          "android tv",
          "big picture",
          "10 foot",
          "ten foot",
          "living room",
          "shield",
          "fire stick",
          "firestick",
          "chromecast",
          "google tv",
          "set up my tv",
          "configure tv",
          "tv theme",
          "tv subtitles",
          "tv player",
          "overscan",
          "edge margin",
          "couch",
          "sync to tv",
          "cloud",
          "from my computer",
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
          "smooth motion",
          "motion smoothing",
          "interpolation",
          "svp",
          "smoothvideo",
          "frame interpolation",
          "60fps",
          "48fps",
          "fluid",
          "judder",
        ],
      },
      {
        id: "shaders",
        label: "Shaders",
        Icon: IconShaders,
        keywords: [
          "shader",
          "shaders",
          "glsl",
          "user shader",
          "mpv shader",
          "anime4k",
          "anime 4k",
          "hdr-toys",
          "hdr toys",
          "hdr tone mapping",
          "tone map",
          "tonemap",
          "fsrcnnx",
          "cas",
          "contrast adaptive sharpening",
          "fsr",
          "fidelityfx",
          "nis",
          "nvidia image scaling",
          "nnedi3",
          "ravu",
          "prescaler",
          "upscale",
          "upscaling",
          "sharpen",
          "download shader",
          "neural upscale",
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
        id: "controllers",
        label: "Controllers",
        Icon: IconController,
        keywords: [
          "controller",
          "gamepad",
          "joystick",
          "joypad",
          "xbox",
          "playstation",
          "ps4",
          "ps5",
          "dualshock",
          "dualsense",
          "deadzone",
          "bluetooth controller",
          "usb controller",
        ],
      },
      {
        id: "language",
        label: "Languages",
        Icon: IconLanguages,
        keywords: ["subtitles", "audio", "preferred", "tracks", "opensubtitles"],
      },
      {
        id: "subtitles",
        label: "Subtitles",
        Icon: IconSubtitles,
        keywords: [
          "subtitles",
          "captions",
          "srt",
          "vtt",
          "sub sources",
          "subtitle sources",
          "subtitle providers",
          "opensubtitles",
          "open subtitles",
          "wyzie",
          "subtitle addon",
          "add subtitle source",
          "dedupe subtitles",
          "auto sync",
          "autosync",
          "auto-sync",
          "subtitle sync",
          "sync subtitles",
          "out of sync",
          "subtitles delayed",
          "subtitles early",
          "subtitles late",
          "resync",
          "timing",
          "offset",
          "consensus",
          "speech recognition",
          "asr",
          "community sync",
          "drift",
          "subtitle size",
          "subtitle font",
          "subtitle color",
        ],
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
          "tvos",
          "apple tv",
          "tv ui",
          "big screen",
        ],
      },
      {
        id: "badges",
        label: "Stream badges",
        Icon: IconStreamBadges,
        keywords: [
          "badges",
          "format badges",
          "quality badges",
          "chips",
          "4k badge",
          "hdr badge",
          "atmos badge",
          "remap",
          "custom badges",
          "nuvio",
          "badge pack",
          "import badges",
          "community badges",
        ],
      },
      {
        id: "awardIcons",
        label: "Award icons",
        Icon: IconAward,
        keywords: [
          "award",
          "awards",
          "oscar",
          "emmy",
          "trophy",
          "award icons",
          "award pack",
          "custom award",
          "upload award icon",
          "crunchyroll awards",
          "install pack",
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
      {
        id: "support",
        label: "Support Harbor",
        Icon: IconSupport,
        keywords: [
          "donate",
          "donation",
          "support",
          "elfhosted",
          "sponsor",
          "charity",
          "give",
          "contribute",
          "money",
          "pay",
        ],
      },
    ],
  },
  {
    heading: "System",
    items: [
      {
        id: "updates",
        label: "Updates & backup",
        Icon: IconUpdates,
        keywords: [
          "update",
          "new version",
          "beta",
          "rollback",
          "downgrade",
          "backup",
          "restore",
          "export settings",
          "import settings",
        ],
      },
      {
        id: "storage",
        label: "Storage",
        Icon: IconStorage,
        keywords: [
          "storage",
          "cache",
          "clear cache",
          "delete cache",
          "storage full",
          "quota",
          "space",
          "disk",
          "free up",
          "picker cache",
          "manga cache",
          "epg cache",
          "cleanup",
        ],
      },
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

const NAV_ITEM_BY_ID = new Map(NAV_GROUPS.flatMap((g) => g.items).map((i) => [i.id, i] as const));

const SETTINGS_OPTIONS: SettingsOption[] = [
  {
    label: "Set up my TV from this computer",
    section: "tv",
    anchorTitle: "The link to your TV",
    keywords: [
      "tv",
      "android tv",
      "big picture",
      "living room",
      "configure tv",
      "set up tv",
      "sync to tv",
      "cloud",
      "shield",
      "fire stick",
      "google tv",
      "remote setup",
      "edit tv settings",
      "tv not signed in",
    ],
  },
  {
    label: "Harbors on your network",
    section: "tv",
    anchorTitle: "Harbors on your network",
    keywords: [
      "devices",
      "instances",
      "lan",
      "local network",
      "discover",
      "harbors nearby",
      "play on",
      "other harbor",
      "which tv",
    ],
  },
  {
    label: "Theme on the TV",
    section: "tv",
    anchorTitle: "Theme on the TV",
    keywords: [
      "tv theme",
      "big picture theme",
      "tv colors",
      "tv colours",
      "tv palette",
      "nord",
      "dracula",
      "tokyo night",
      "noir",
      "match this computer",
      "same theme on tv",
      "copy my theme",
    ],
  },
  {
    label: "Home layout on the TV",
    section: "tv",
    anchorTitle: "Getting around the TV",
    keywords: [
      "tv home",
      "big picture home",
      "harbor layout",
      "classic layout",
      "tv rows",
      "tv hero",
      "hero trailer",
      "hide watched on tv",
    ],
  },
  {
    label: "Display language on the TV",
    section: "tv",
    anchorTitle: "Getting around the TV",
    keywords: [
      "tv language",
      "big picture language",
      "ui language tv",
      "arabic tv",
      "russian tv",
      "portuguese tv",
    ],
  },
  {
    label: "Controller navigation on the TV",
    section: "tv",
    anchorTitle: "Getting around the TV",
    keywords: [
      "controller",
      "gamepad",
      "xbox controller",
      "tv controller",
      "joystick",
      "dpad",
      "open in big picture",
      "auto start big picture",
      "boot into tv mode",
    ],
  },
  {
    label: "Edge margin (TV crops the picture)",
    section: "tv",
    anchorTitle: "Picture and feel",
    keywords: [
      "overscan",
      "edge margin",
      "cut off edges",
      "picture cropped",
      "cant see the edges",
      "safe area",
      "tv cuts off ui",
      "shrink ui",
    ],
  },
  {
    label: "Picture quality on the TV",
    section: "tv",
    anchorTitle: "Picture and feel",
    keywords: [
      "tv performance",
      "slow tv",
      "laggy tv",
      "cheap stick",
      "balanced",
      "max quality",
      "animated backdrop",
      "tv art quality",
      "fire stick slow",
    ],
  },
  {
    label: "Interface sounds on the TV",
    section: "tv",
    anchorTitle: "Picture and feel",
    keywords: [
      "tv sounds",
      "ui sounds",
      "click sound",
      "navigation sound",
      "cinematic",
      "retro",
      "glass",
      "mute ui sounds",
    ],
  },
  {
    label: "Instant play on the TV",
    section: "tv",
    anchorTitle: "Starting a show",
    keywords: [
      "instant play tv",
      "tv play button",
      "source picker tv",
      "minimal source rows",
      "tv stream list",
    ],
  },
  {
    label: "Player engine on the TV",
    section: "tv",
    anchorTitle: "Starting a show",
    keywords: [
      "tv engine",
      "mpv on tv",
      "html5 tv",
      "exoplayer",
      "media3",
      "hardware acceleration tv",
      "hwdec",
      "green screen tv",
      "tearing on tv",
    ],
  },
  {
    label: "Auto-play next episode on the TV",
    section: "tv",
    anchorTitle: "Bingeing",
    keywords: [
      "tv autoplay",
      "auto next tv",
      "binge tv",
      "still watching",
      "are you still watching",
      "ask after episodes",
      "tv plays all night",
    ],
  },
  {
    label: "Episode spoilers on the TV",
    section: "tv",
    anchorTitle: "Episodes and spoilers",
    keywords: [
      "tv spoilers",
      "hide spoilers tv",
      "hide thumbnails",
      "hide episode titles",
      "hide descriptions",
      "episode ratings tv",
      "next episode spoiler",
    ],
  },
  {
    label: "Audio and subtitle languages on the TV",
    section: "tv",
    anchorTitle: "Languages on the TV",
    keywords: [
      "tv languages",
      "tv audio language",
      "tv subtitle language",
      "dub on tv",
      "sub on tv",
      "english subs tv",
      "japanese audio tv",
    ],
  },
  {
    label: "Streaming services on the TV",
    section: "tv",
    anchorTitle: "Services on the TV",
    keywords: [
      "tv services",
      "netflix tv",
      "disney tv",
      "turn off services tv",
      "services i dont have",
      "tv providers",
      "where to watch tv",
    ],
  },
  {
    label: "Player controls on the TV",
    section: "tv",
    anchorTitle: "Player controls on the TV",
    keywords: [
      "tv player chrome",
      "skip button tv",
      "skip intro tv",
      "hide skip button",
      "clock while playing",
      "tv player layout",
      "tv overlay",
    ],
  },
  {
    label: "Subtitle look on the TV",
    section: "tv",
    anchorTitle: "Subtitle look on the TV",
    keywords: [
      "tv subtitle size",
      "tv subtitles too small",
      "bigger subtitles on tv",
      "subtitle color tv",
      "subtitle outline tv",
      "subtitle box tv",
      "subtitle position tv",
      "subtitle font tv",
      "bold subtitles tv",
      "line spacing",
      "sublook",
      "read from the couch",
    ],
  },
  {
    label: "Copy my settings to the TV",
    section: "tv",
    anchorTitle: "Start from this computer",
    keywords: [
      "copy to tv",
      "mirror settings",
      "same as my computer",
      "match my pc",
      "clone settings",
      "duplicate settings",
      "push settings to tv",
      "one click tv setup",
      "start from this computer",
    ],
  },
  {
    label: "Things you still do on the TV itself",
    section: "tv",
    anchorTitle: "Still done on the TV",
    keywords: [
      "pairing code",
      "scan code",
      "tv sign in",
      "log in on tv",
      "tv accounts",
      "mdblist on tv",
      "live tv playlist",
      "m3u",
      "xtream",
      "tv addons",
      "watch together on tv",
      "other devices",
      "cannot set from computer",
    ],
  },
  {
    label: "Bingeing on the TV",
    section: "tv",
    anchorTitle: "Bingeing",
    keywords: [
      "still watching",
      "are you still watching",
      "tv autoplay",
      "auto next tv",
      "binge tv",
      "ask after episodes",
      "tv plays all night",
      "stop after",
    ],
  },
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
    label: "Auto-skip stalled streams",
    section: "player",
    anchorTitle: "Auto-skip stalled streams",
    keywords: [
      "player",
      "buffering",
      "keeps buffering",
      "stuttering",
      "playback stalls",
      "auto skip",
      "dead stream",
      "dead addon",
      "addon down",
      "stream not loading",
      "stuck loading",
      "try next stream",
      "next source",
      "failover",
      "auto next",
      "10 seconds",
      "stalled",
      "load timeout",
    ],
  },
  {
    label: "How long to wait first",
    section: "player",
    anchorTitle: "Auto-skip stalled streams",
    keywords: [
      "stall timeout",
      "custom time",
      "wait longer",
      "20 seconds",
      "30 seconds",
      "1 minute",
      "skipping too fast",
      "refresh every time",
      "auto skip delay",
    ],
  },
  {
    label: "What fullscreen does",
    section: "hotkeys",
    anchorTitle: "Behavior",
    keywords: [
      "maximize",
      "maximized",
      "fullscreen mode",
      "hide taskbar",
      "keep taskbar",
      "windowed gaps",
      "fill screen",
      "multitasking",
      "borderless",
    ],
  },
  {
    label: "Only start the torrent engine when needed",
    section: "p2p",
    anchorTitle: "Local engine",
    keywords: [
      "metered connection",
      "limited data",
      "high internet usage",
      "background data",
      "idle traffic",
      "dht",
      "data cap",
      "bandwidth when idle",
      "network usage",
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
    section: "playerLayout",
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
    section: "subtitles",
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
    label: "Subtitle sync indicator",
    section: "subtitles",
    anchorTitle: "Sync indicator",
    keywords: [
      "subtitle offset",
      "subtitle delay",
      "sync feedback",
      "z key",
      "x key",
      "offset indicator",
      "timing indicator",
      "subtitle timing",
    ],
  },
  {
    label: "Subtitle sources (OpenSubtitles, Wyzie, addons)",
    section: "subtitles",
    anchorTitle: "Subtitle sources",
    keywords: [
      "sub sources",
      "subtitle sources",
      "subtitle providers",
      "opensubtitles",
      "open subtitles",
      "wyzie",
      "subtitle addon",
      "subtitle addons",
      "enable opensubtitles",
      "turn off opensubtitles",
      "add subtitle source",
      "dedupe subtitles",
      "duplicate subtitles",
      "captions",
      "srt",
    ],
  },
  {
    label: "OpenSubtitles API key",
    section: "subtitles",
    anchorTitle: "Subtitle sources",
    keywords: [
      "opensubtitles key",
      "opensubtitles api",
      "os key",
      "subtitle api key",
      "autosync key",
      "automatic subtitle sync",
      "sync subtitles automatically",
      "subtitles out of sync",
      "opensubtitles login",
      "opensubtitles account",
    ],
  },
  {
    label: "Run Anime4K on everything, not just anime",
    section: "shaders",
    anchorTitle: "Anime4K upscaling",
    keywords: [
      "anime4k live action",
      "anime only",
      "anime4k everything",
      "upscale movies",
      "anime4k not working on movies",
      "anime4k all content",
      "shader anime only",
    ],
  },
  {
    label: "Favour titles from your region on Home",
    section: "language",
    anchorTitle: "Home catalogs",
    keywords: [
      "locale bias",
      "local titles",
      "my country",
      "regional picks",
      "home rows region",
      "same movies every day",
      "feed bias",
      "local releases",
    ],
  },
  {
    label: "Subtitle auto-sync (fix out-of-sync subtitles)",
    section: "subtitles",
    anchorTitle: "Subtitle auto-sync",
    keywords: [
      "auto sync",
      "autosync",
      "subtitle sync",
      "sync subtitles",
      "out of sync",
      "subtitles delayed",
      "subtitles early",
      "subtitles late",
      "resync",
      "fix timing",
      "subtitle offset",
      "consensus",
      "speech recognition asr",
      "community sync",
      "drift monitor",
      "try harder",
    ],
  },
  {
    label: "Stream format chips",
    section: "badges",
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
    label: "Remap stream badges",
    section: "badges",
    anchorTitle: "Badge art",
    keywords: [
      "remap badge",
      "change badge image",
      "custom badge",
      "badge art",
      "replace 4k badge",
      "hide badge",
    ],
  },
  {
    label: "Import badge packs (Nuvio)",
    section: "badges",
    anchorTitle: "Packs & import",
    keywords: [
      "nuvio badges",
      "badges.json",
      "import badges",
      "community pack",
      "badge studio",
      "download badges",
    ],
  },
  {
    label: "Custom regex badge rules",
    section: "badges",
    anchorTitle: "Custom rules",
    keywords: ["regex badge", "pattern badge", "custom rule", "badge rule", "match stream name"],
  },
  {
    label: "Poster size",
    section: "theme",
    anchorTitle: "Poster card style",
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
    section: "player",
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
    label: "Maximum volume boost",
    section: "player",
    anchorTitle: "Audio",
    keywords: [
      "volume boost",
      "max volume",
      "maximum volume",
      "louder",
      "amplify",
      "amplification",
      "gain",
      "boost past 100",
      "200%",
      "very loud",
      "volume bar",
    ],
  },
  {
    label: "Skip intros",
    section: "player",
    anchorTitle: "Skip intros & credits",
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
    label: "Episode card size",
    section: "library",
    anchorTitle: "Episode cards",
    keywords: [
      "episode size",
      "bigger episodes",
      "card size",
      "episode cards",
      "larger stills",
      "netflix size",
      "episode grid size",
    ],
  },
  {
    label: "Cycle the backdrop on show pages",
    section: "library",
    anchorTitle: "Show pages",
    keywords: [
      "backdrop carousel",
      "cycle backdrop",
      "rotate backdrop",
      "changing background",
      "moving background",
      "hero backdrop",
      "detail page background",
      "slideshow backdrop",
      "animated backdrop",
    ],
  },
  {
    label: "Downloads folder",
    section: "advanced",
    anchorTitle: "Downloads",
    keywords: [
      "download failed",
      "downloads failing",
      "download error",
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
      "11470",
      "use exclusively",
      "strict",
    ],
  },
  {
    label: "Harbor on other devices (web app)",
    section: "remotes",
    anchorTitle: "Harbor on other devices",
    keywords: [
      "harbor in browser",
      "web ui",
      "web app",
      "web version",
      "11471",
      "serve",
      "network",
      "tv browser",
      "laptop",
      "open on phone",
    ],
  },
  {
    label: "Phone remote",
    section: "remotes",
    anchorTitle: "Phone remote",
    keywords: [
      "control from phone",
      "use my phone",
      "phone as remote",
      "control harbor from my phone",
      "phone remote",
      "remote control",
      "couch",
      "control playback",
      "cast from phone",
      "pause from phone",
      "volume remote",
    ],
  },
  {
    label: "Manga reader remote",
    section: "remotes",
    anchorTitle: "Manga reader remote",
    keywords: [
      "manga remote",
      "reader remote",
      "flipbook remote",
      "turn pages",
      "page turner",
      "manga phone",
    ],
  },
  {
    label: "Temporary files",
    section: "storage",
    anchorTitle: "Temporary files",
    keywords: [
      "temp",
      "temp files",
      "old updates",
      "installers",
      "appdata temp",
      "disk space",
      "ssd filling up",
      "trailers cache",
      "clear temp",
    ],
  },
  {
    label: "Storage overview",
    section: "storage",
    anchorTitle: "Storage overview",
    keywords: ["storage", "usage", "quota", "space used", "disk", "how much space", "storage full"],
  },
  {
    label: "Clear caches",
    section: "storage",
    anchorTitle: "Clear caches",
    keywords: [
      "clear cache",
      "delete cache",
      "free up space",
      "picker cache",
      "manga cache",
      "live tv cache",
      "epg",
      "dead streams",
      "cleanup",
      "purge",
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
    section: "shaders",
    anchorTitle: "Anime4K upscaling",
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
    section: "player",
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
    section: "shaders",
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
    label: "FSRCNNX neural upscaler",
    section: "shaders",
    anchorTitle: "More picture shaders",
    keywords: [
      "fsrcnnx",
      "neural upscale",
      "luma upscaler",
      "sharpest upscale",
      "16-0-4-1",
      "line art",
      "download shader",
    ],
  },
  {
    label: "AMD FSR upscaler",
    section: "shaders",
    anchorTitle: "More picture shaders",
    keywords: [
      "fsr",
      "fidelityfx",
      "super resolution",
      "amd upscale",
      "spatial upscale",
      "live action upscale",
    ],
  },
  {
    label: "NVIDIA NIS upscaler",
    section: "shaders",
    anchorTitle: "More picture shaders",
    keywords: ["nis", "nvidia image scaling", "spatial upscale", "sharpen upscale"],
  },
  {
    label: "Contrast Adaptive Sharpening (CAS)",
    section: "shaders",
    anchorTitle: "More picture shaders",
    keywords: [
      "cas",
      "contrast adaptive sharpening",
      "sharpen",
      "amd sharpen",
      "soft picture",
      "detail",
    ],
  },
  {
    label: "HDR tone-mapping (hdr-toys)",
    section: "shaders",
    anchorTitle: "More picture shaders",
    keywords: [
      "hdr-toys",
      "hdr toys",
      "hdr to sdr",
      "tone map",
      "tonemap",
      "washed out hdr",
      "hdr on sdr display",
      "shader tonemap",
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
      "continue watching per profile",
      "private continue watching",
      "hide continue watching from profiles",
      "cw per profile",
      "profile only cw",
    ],
  },
  {
    label: "Show pages (resume scroll)",
    section: "library",
    anchorTitle: "Show pages",
    keywords: [
      "show pages",
      "detail page",
      "resume scroll",
      "scroll position",
      "jump to episode",
      "jump back",
      "where you left off",
      "scroll flash",
      "stutter",
      "remember scroll",
      "episode list scroll",
      "auto scroll to episode",
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
    section: "language",
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
    label: "Content filters (hide anime / manga / live tv / sports / adult)",
    section: "library",
    anchorTitle: "Content filters",
    keywords: [
      "content filters",
      "hide anime",
      "hide manga",
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
    section: "subtitles",
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
    anchorTitle: "Titles and descriptions",
    keywords: ["metadata language", "tmdb titles", "overviews", "taglines", "translation"],
  },
  {
    label: "Audio languages",
    section: "language",
    anchorTitle: "Audio languages",
    keywords: [
      "movies",
      "films",
      "shows",
      "wrong language",
      "wrong audio",
      "dubbed in the wrong language",
      "audio languages",
      "dub",
      "audio tracks",
      "preferred audio",
    ],
  },
  {
    label: "Preferred languages",
    section: "subtitles",
    anchorTitle: "Preferred languages",
    keywords: [
      "wrong language",
      "wrong subtitles",
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
    label: "Source mode (Both / Direct/debrid / P2P)",
    section: "streaming",
    anchorTitle: "Source mode",
    keywords: [
      "source mode",
      "both",
      "direct",
      "debrid",
      "addons",
      "p2p",
      "peer to peer",
      "torrent sources",
      "missing torrents",
      "hidden torrents",
      "stream mode",
    ],
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
      "add debrid",
      "add a service",
      "connect debrid",
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
    keywords: [
      "friends",
      "with friends",
      "watch party",
      "watch together",
      "relay",
      "party",
      "p2p",
      "host",
      "cloudflare",
      "deploy",
      "share",
    ],
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
      "tvos",
      "apple tv",
      "tv ui",
      "big screen",
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
      "different font",
      "change font",
      "typeface",
      "use a different font",
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
    label: "Moving the window",
    section: "theme",
    anchorTitle: "Moving the window",
    keywords: [
      "move window",
      "drag window",
      "window drag",
      "drag from anywhere",
      "grab window",
      "reposition window",
      "click and drag",
    ],
  },
  {
    label: "Fullscreen clock",
    section: "playerLayout",
    anchorTitle: "Fullscreen clock",
    keywords: ["fullscreen clock", "local time", "player clock", "clock format", "clock style"],
  },
  {
    label: "Home hero shadow",
    section: "library",
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
    section: "updates",
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
    section: "updates",
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
    section: "account",
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
    section: "library",
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
    label: "Profile songs",
    section: "account",
    anchorTitle: "Profile songs",
    keywords: [
      "profile song",
      "profile music",
      "autoplay music",
      "mute profile",
      "soundcloud",
      "spotify",
      "youtube music",
      "stop music",
      "audio",
    ],
  },
  {
    label: "Synced addons",
    section: "account",
    anchorTitle: "Synced addons",
    keywords: ["synced addons", "addons", "stremio addons", "installed addons"],
  },

  {
    label: "Trakt connection",
    section: "trackers",
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
    section: "trackers",
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
    section: "trackers",
    keywords: ["simkl", "sync", "watched", "watchlist", "connect", "disconnect", "avatar", "anime"],
  },
  {
    label: "Letterboxd connection",
    section: "trackers",
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
    label: "Controllers / gamepad",
    section: "controllers",
    keywords: [
      "controller",
      "gamepad",
      "joystick",
      "joypad",
      "xbox",
      "playstation",
      "ps4",
      "ps5",
      "dualshock",
      "dualsense",
      "deadzone",
      "repeat speed",
      "bluetooth controller",
      "usb controller",
    ],
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
    anchorTitle: "When you press Play",
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
      "pin",
      "set a pin",
      "lock a profile",
      "parental controls",
      "kids",
      "child",
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
    label: "New Episodes row",
    section: "library",
    anchorTitle: "Home layout",
    keywords: ["new episodes", "recent episodes", "aired", "episode row", "dismiss"],
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
    anchorTitle: "Home catalogs",
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
      "episode thumbnails",
      "hq stills",
      "sharp episode images",
      "episode image quality",
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
    anchorTitle: "Episode order",
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
    anchorTitle: "Song identification",
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
    anchorTitle: "Titles and descriptions",
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
      "marquee",
      "trailer card",
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
    label: "Hide manga",
    section: "library",
    anchorTitle: "Content filters",
    keywords: ["hide manga", "no manga", "remove manga tab", "manga sidebar"],
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
    section: "trackers",
    keywords: ["trakt", "connect", "tracking", "scrobble", "watchlist", "recommendations"],
  },
  {
    label: "Connect Trakt",
    section: "trackers",
    keywords: ["trakt login", "device code", "authorize", "link trakt"],
  },
  {
    label: "About Trakt",
    section: "trackers",
    keywords: ["trakt.tv", "what is trakt", "info", "website"],
  },
  {
    label: "Open Trakt profile",
    section: "trackers",
    keywords: ["open profile", "trakt profile", "view profile", "my trakt", "profile page"],
  },
  {
    label: "Use my Trakt avatar as my Harbor avatar",
    section: "trackers",
    keywords: ["trakt avatar", "profile picture", "avatar sync", "wear avatar"],
  },
  {
    label: "Disconnect from Trakt",
    section: "trackers",
    keywords: ["disconnect", "unlink", "remove trakt", "stop scrobbling", "sign out"],
  },
  {
    label: "Export to Trakt",
    section: "trackers",
    keywords: ["export watchlist", "copy watchlist", "send to trakt", "upload", "move watchlist"],
  },
  {
    label: "Import from Trakt",
    section: "trackers",
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
    section: "trackers",
    keywords: ["trakt comments", "community comments", "reviews", "discussion", "episodes"],
  },
  {
    label: "Blur Trakt comments by default",
    section: "trackers",
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
    section: "trackers",
    keywords: ["anilist", "connect", "anime lists", "link account", "anime tracking", "rails"],
  },
  {
    label: "Connect AniList",
    section: "trackers",
    keywords: ["anilist login", "authorize", "oauth", "link"],
  },
  {
    label: "About AniList",
    section: "trackers",
    keywords: ["anilist.co", "info", "website", "what is anilist"],
  },
  {
    label: "Open AniList profile",
    section: "trackers",
    keywords: ["open profile", "anilist profile", "view profile", "profile page", "my anilist"],
  },
  {
    label: "Sync watch progress",
    section: "trackers",
    keywords: ["anilist sync", "episode progress", "auto update", "forward only", "tracking"],
  },
  {
    label: "Use my AniList avatar as my Harbor avatar",
    section: "trackers",
    keywords: ["anilist avatar", "profile picture", "avatar", "wear avatar"],
  },
  {
    label: "Show AniList comments",
    section: "trackers",
    keywords: ["anilist comments", "forum threads", "anime discussion", "detail pages"],
  },
  {
    label: "Blur AniList comments by default",
    section: "trackers",
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
    section: "trackers",
    keywords: ["disconnect", "unlink", "remove anilist", "stop sync"],
  },
  {
    label: "Connect your MyAnimeList account",
    section: "trackers",
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
    section: "trackers",
    keywords: ["mal client id", "api key", "myanimelist api", "client id", "register app"],
  },
  {
    label: "Connect MyAnimeList",
    section: "trackers",
    keywords: ["mal login", "authorize", "oauth", "pin code", "link"],
  },
  {
    label: "About MyAnimeList",
    section: "trackers",
    keywords: ["myanimelist.net", "info", "website", "what is mal"],
  },
  {
    label: "Open MAL profile",
    section: "trackers",
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
    section: "trackers",
    keywords: ["disconnect", "unlink", "remove mal", "stop sync"],
  },
  {
    label: "Connect your Simkl account",
    section: "trackers",
    keywords: ["simkl", "connect", "tracking", "plan to watch", "mark watched", "sync"],
  },
  {
    label: "Connect Simkl",
    section: "trackers",
    keywords: ["simkl login", "device code", "authorize", "link"],
  },
  {
    label: "About Simkl",
    section: "trackers",
    keywords: ["simkl.com", "info", "website", "what is simkl"],
  },
  {
    label: "Open Simkl profile",
    section: "trackers",
    keywords: ["open profile", "simkl profile", "view profile", "profile page", "my simkl"],
  },
  {
    label: "Use my Simkl avatar as my Harbor avatar",
    section: "trackers",
    keywords: ["simkl avatar", "profile picture", "avatar", "wear avatar"],
  },
  {
    label: "Disconnect from Simkl",
    section: "trackers",
    keywords: ["disconnect", "unlink", "remove simkl", "stop sync"],
  },
  {
    label: "Enable Letterboxd integration",
    section: "trackers",
    keywords: ["letterboxd", "letterbox", "stremboxd", "enable", "films", "diary", "watchlist"],
  },
  {
    label: "Mode",
    section: "trackers",
    keywords: ["public mode", "full mode", "username only", "password mode", "segmented"],
  },
  {
    label: "Letterboxd username",
    section: "trackers",
    keywords: ["username", "handle", "account name", "letterbox user"],
  },
  {
    label: "Letterboxd password",
    section: "trackers",
    keywords: ["password", "sign in", "2fa", "totp", "two-factor", "full mode"],
  },
  {
    label: "Connect / Verify",
    section: "trackers",
    keywords: ["verify", "connect", "validate", "check catalogs", "public"],
  },
  {
    label: "Connect",
    section: "trackers",
    keywords: ["login", "sign in", "verify & connect", "full login"],
  },
  {
    label: "About Stremboxd",
    section: "trackers",
    keywords: ["stremboxd", "bridge", "configure", "info", "website"],
  },
  {
    label: "Catalogs to show",
    section: "trackers",
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
    section: "trackers",
    keywords: ["add list", "list url", "remove list", "letterboxd list", "import list", "slug"],
  },
  {
    label: "Show my rating on movie posters",
    section: "trackers",
    keywords: ["my rating", "poster overlay", "stars", "personal rating"],
  },
  {
    label: "Blur reviews by default",
    section: "trackers",
    keywords: ["blur reviews", "spoilers", "film pages", "reveal"],
  },
  {
    label: "Hidden catalogs",
    section: "trackers",
    keywords: ["unhide", "show hidden", "restore catalog", "hidden rows"],
  },
  {
    label: "Disconnect",
    section: "trackers",
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
    label: "Addon wait time",
    section: "streaming",
    anchorTitle: "Addon wait time",
    keywords: [
      "addon timeout",
      "wait time",
      "streams not loading",
      "slow addon",
      "penguplay",
      "no streams",
      "refresh streams",
      "stream timeout",
    ],
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
    label: "Stream priority",
    section: "streaming",
    anchorTitle: "Result order",
    keywords: [
      "stream priority",
      "prefer addon",
      "addon first",
      "aiostreams first",
      "which addon first",
      "addon priority",
      "torrentio last",
      "reorder addons for streams",
      "preferred addon",
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
      "releases",
      "prefer releases",
      "prefer 4k",
      "prefer 1080p",
      "block cam",
      "block cam rips",
      "no cam",
      "quality rules",
      "resolution rules",
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
    section: "subtitles",
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
    section: "subtitles",
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
    section: "subtitles",
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
    section: "subtitles",
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
    section: "subtitles",
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
    section: "subtitles",
    anchorTitle: "Subtitle languages",
    keywords: [
      "hearing impaired",
      "hard of hearing",
      "deaf",
      "hi track",
      "captions",
      "closed captions",
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
    label: "Second subtitle language",
    section: "subtitles",
    anchorTitle: "Dual subtitles",
    keywords: [
      "dual subtitles",
      "double subtitles",
      "two subtitles at once",
      "bilingual subtitles",
      "learning a language",
      "learn english",
      "second subtitle",
      "both languages",
    ],
  },
  {
    label: "Where it shows",
    section: "subtitles",
    anchorTitle: "Dual subtitles",
    keywords: [
      "second subtitle position",
      "dual subtitle top",
      "dual subtitle bottom",
      "stacked subtitles",
    ],
  },
  {
    label: "Second line size",
    section: "subtitles",
    anchorTitle: "Dual subtitles",
    keywords: ["second subtitle size", "dual subtitle size", "smaller second line"],
  },
  {
    label: "Background",
    section: "subtitles",
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
    section: "subtitles",
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
    section: "subtitles",
    anchorTitle: "Subtitle style",
    keywords: ["box opacity", "subtitle background transparency", "dim box", "see through box"],
  },
  {
    label: "Outline thickness",
    section: "subtitles",
    anchorTitle: "Subtitle style",
    keywords: ["outline width", "stroke size", "border thickness", "letter outline"],
  },
  {
    label: "Font",
    section: "subtitles",
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
    section: "subtitles",
    anchorTitle: "Subtitle style",
    keywords: ["custom subtitle font", "ttf", "otf", "woff", "add font", "install font"],
  },
  {
    label: "Bold text",
    section: "subtitles",
    anchorTitle: "Subtitle style",
    keywords: ["bold subtitles", "heavier weight", "thick text", "font weight"],
  },
  {
    label: "Show subtitles in Picture-in-Picture",
    section: "subtitles",
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
    section: "subtitles",
    anchorTitle: "Subtitle style",
    keywords: ["size", "font size", "bigger subtitles", "text size", "small subtitles"],
  },
  {
    label: "Opacity",
    section: "subtitles",
    anchorTitle: "Subtitle style",
    keywords: ["subtitle transparency", "faded subtitles", "see through text", "subtitle opacity"],
  },
  {
    label: "Distance from bottom",
    section: "subtitles",
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
    section: "subtitles",
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
    section: "subtitles",
    anchorTitle: "Subtitle style",
    keywords: ["subtitle color", "font color", "white subtitles", "yellow subtitles", "colour"],
  },
  {
    label: "Outline color",
    section: "subtitles",
    anchorTitle: "Subtitle style",
    keywords: ["border color", "stroke color", "outline colour", "edge color"],
  },
  {
    label: "Box color",
    section: "subtitles",
    anchorTitle: "Subtitle style",
    keywords: ["background color", "black bar color", "box colour", "panel color"],
  },
  {
    label: "Reset subtitle style to defaults",
    section: "subtitles",
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
    anchorTitle: "Titles and descriptions",
    keywords: ["translated titles", "original title", "localized titles", "keep english title"],
  },
  {
    label: "Translate overviews",
    section: "language",
    anchorTitle: "Titles and descriptions",
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
    section: "subtitles",
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
    section: "subtitles",
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
      "volume osd",
      "volume indicator",
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
    keywords: [
      "hdr sdr",
      "tonemapping toggle",
      "bt2446a",
      "sdr displays",
      "washed out fix",
      "hdr",
      "tonemap",
      "washed out",
      "hdr looks grey",
      "sdr conversion",
    ],
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
    label: "X-Ray (cast on screen)",
    section: "player",
    anchorTitle: "X-Ray (experimental)",
    keywords: [
      "xray",
      "x-ray",
      "cast",
      "whos on screen",
      "who is on screen",
      "actors in scene",
      "amazon xray",
      "face recognition",
      "whos here",
      "who's here",
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
    anchorTitle: "Skip intros & credits",
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
    anchorTitle: "Skip intros & credits",
    keywords: [
      "auto skip",
      "skip openings automatically",
      "jump past intro",
      "autoskip",
      "skip intro",
      "auto skip intro",
      "skip opening",
      "op skip",
      "anime intro",
      "theme song",
      "skip automatically",
    ],
  },
  {
    label: "Auto-hide the Skip button after",
    section: "player",
    anchorTitle: "Skip intros & credits",
    keywords: [
      "hide skip button",
      "skip button timeout",
      "auto dismiss",
      "5s 10s 15s 30s",
      "disappear",
      "skip button",
      "hide skip",
      "how long skip shows",
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
      "autoplay",
      "auto play next",
      "binge",
      "next episode",
      "play next automatically",
      "continue playing",
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
    section: "player",
    anchorTitle: "Audio",
    keywords: ["downmix", "stereo", "surround", "laptop speakers", "headphones", "fold down"],
  },
  {
    label: "Mix surround sound down to stereo",
    section: "player",
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
    section: "shaders",
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
    section: "shaders",
    anchorTitle: "Anime4K upscaling",
    keywords: ["anime4k badge", "fps indicator", "overlay badge", "status chip", "live fps"],
  },
  {
    label: "Anime4K presets",
    section: "shaders",
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
    section: "shaders",
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
    section: "shaders",
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
      "volume boost",
      "louder",
      "vertical volume",
      "boost past 100",
      "amplify",
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
    label: "Open settings",
    section: "hotkeys",
    anchorTitle: "Global",
    keywords: ["settings shortcut", "settings hotkey", "ctrl s", "preferences"],
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
    label: "Toggle RTX Super Resolution",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: ["rtx vsr hotkey", "ctrl u", "nvidia super resolution", "video upscaling toggle"],
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
    keywords: [
      "accent colour",
      "accent color",
      "change accent",
      "highlight colour",
      "customize theme colors",
      "tweak palette",
      "color editor",
      "adjust theme",
    ],
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
    section: "badges",
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
    section: "library",
    anchorTitle: "Home hero",
    keywords: ["hero banner", "featured banner", "big hero", "home banner"],
  },
  {
    label: "Full hero banner",
    section: "library",
    anchorTitle: "Home hero",
    keywords: ["edge to edge hero", "taller hero", "stretch banner", "bigger featured"],
  },
  {
    label: "Full quality hero image",
    section: "library",
    anchorTitle: "Home hero",
    keywords: ["high res hero", "sharper artwork", "hero bandwidth", "full resolution banner"],
  },
  {
    label: "Shadow",
    section: "library",
    anchorTitle: "Home hero shadow",
    keywords: ["shadow slider", "gradient darkness", "hero dim", "let artwork show"],
  },
  {
    label: "Auto-play trailer on detail pages",
    section: "player",
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
    section: "player",
    anchorTitle: "Trailer quality",
    keywords: ["unmuted trailer", "trailer sound on", "audio autoplay", "start with sound"],
  },
  {
    label: "Show thumbnail preview on hover",
    section: "playerLayout",
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
    section: "playerLayout",
    anchorTitle: "Seek bar",
    keywords: ["flat", "glass", "pinstripe", "rainbow", "seek bar texture", "timeline look"],
  },
  {
    label: "Bar height",
    section: "playerLayout",
    anchorTitle: "Seek bar",
    keywords: ["thicker bar", "thin bar", "timeline height", "bar size"],
  },
  {
    label: "Bar color",
    section: "playerLayout",
    anchorTitle: "Seek bar",
    keywords: ["seek bar color", "accent color", "recolor progress", "custom color", "gold accent"],
  },
  {
    label: "Bar image",
    section: "playerLayout",
    anchorTitle: "Seek bar",
    keywords: ["tiled pattern", "custom bar image", "gif bar", "texture upload", "pattern bar"],
  },
  {
    label: "Seek dot shape",
    section: "playerLayout",
    anchorTitle: "Seek bar",
    keywords: ["circle", "square", "custom image dot", "hidden dot", "handle shape", "no dot"],
  },
  {
    label: "Dot size",
    section: "playerLayout",
    anchorTitle: "Seek bar",
    keywords: ["handle size", "knob size", "image size", "bigger dot", "scrubber size"],
  },
  {
    label: "Dot image",
    section: "playerLayout",
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
    label: "Drag the window from anywhere",
    section: "theme",
    anchorTitle: "Moving the window",
    keywords: [
      "drag anywhere",
      "move window",
      "grab empty space",
      "full app drag",
      "window dragging",
      "move from content",
      "drag body",
    ],
  },
  {
    label: "Show fullscreen clock",
    section: "playerLayout",
    anchorTitle: "Fullscreen clock",
    keywords: ["local time", "player clock", "fullscreen time", "show clock", "hide clock"],
  },
  {
    label: "Clock format",
    section: "playerLayout",
    anchorTitle: "Fullscreen clock",
    keywords: ["12 hour", "24 hour", "am pm", "system time", "seconds"],
  },
  {
    label: "Clock size",
    section: "playerLayout",
    anchorTitle: "Fullscreen clock",
    keywords: ["clock pixels", "larger clock", "smaller clock", "resize time", "font size"],
  },
  {
    label: "Show estimated finish time",
    section: "playerLayout",
    anchorTitle: "Fullscreen clock",
    keywords: ["ends at", "finish time", "movie end", "episode end", "estimated end"],
  },
  {
    label: "Clock style",
    section: "playerLayout",
    anchorTitle: "Fullscreen clock",
    keywords: ["glass", "minimal", "solid", "accent", "clock design"],
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
    label: "Automations",
    section: "webhooks",
    anchorTitle: "Automations",
    keywords: ["rules", "automations", "custom alert rules", "triggers", "ping rules", "rule list"],
  },
  {
    label: "New rule",
    section: "webhooks",
    anchorTitle: "Automations",
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
    label: "Donating to Harbor",
    section: "support",
    anchorTitle: "Donating to Harbor",
    keywords: [
      "donate",
      "donation",
      "support harbor",
      "give money",
      "patreon",
      "paypal",
      "fund harbor",
      "contribute",
      "tip",
      "pay for harbor",
      "subscription",
    ],
  },
  {
    label: "Badges for giving",
    section: "support",
    anchorTitle: "Badges for giving",
    keywords: [
      "charity badge",
      "donation badge",
      "supporter badge",
      "profile badge",
      "elfhosted badge",
      "giving badge",
      "how do i get a badge",
    ],
  },
  {
    label: "Who pays for the servers",
    section: "support",
    anchorTitle: "Who keeps this running",
    keywords: [
      "elfhosted",
      "hosting",
      "servers",
      "backend",
      "who pays",
      "infrastructure",
      "sponsor",
      "running costs",
    ],
  },
  {
    label: "Built on Stremio",
    section: "support",
    anchorTitle: "Built on Stremio",
    keywords: ["stremio", "credit", "foundation", "upstream", "thanks", "support stremio"],
  },
  {
    label: "Charities to give to instead",
    section: "support",
    anchorTitle: "If you would rather give it away",
    keywords: [
      "charity",
      "give away",
      "donate to charity",
      "good causes",
      "nonprofit",
      "where to give",
    ],
  },
  {
    label: "Updates",
    section: "updates",
    anchorTitle: "Updates",
    keywords: ["app updates", "new version", "update channel", "auto update"],
  },
  {
    label: "Check for updates",
    section: "updates",
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
    section: "updates",
    anchorTitle: "Updates",
    keywords: [
      "join beta",
      "join the beta",
      "beta program",
      "early access",
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
    section: "updates",
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
    section: "updates",
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
    section: "updates",
    anchorTitle: "Backup & restore",
    keywords: ["export backup", "save setup file", "harbx", "full backup", "backup file"],
  },
  {
    label: "Restore from a backup",
    section: "updates",
    anchorTitle: "Backup & restore",
    keywords: ["import backup", "load backup", "new computer", "restore settings", "replace setup"],
  },
  {
    label: "Downloads",
    section: "advanced",
    anchorTitle: "Downloads",
    keywords: [
      "offline",
      "watch offline",
      "where do downloads go",
      "download location",
      "how much space",
      "download limit",
      "download folder",
      "save location",
      "downloads directory",
      "where videos save",
    ],
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
    section: "account",
    anchorTitle: "Stremio install links",
    keywords: [
      "protocol handler",
      "stremio link handler",
      "in app installer",
      "addon install",
      "default app",
      "configure and install",
      "stremio links",
      "install links",
      "deeplink",
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
    section: "library",
    anchorTitle: "API budget",
    keywords: ["api quota", "daily budget", "rate limit", "call counter"],
  },
  {
    label: "OMDB daily budget",
    section: "library",
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
  {
    label: "Lock to season server",
    section: "basics",
    anchorTitle: "When you press Play",
    keywords: [
      "season lock",
      "season server",
      "season pack",
      "same source",
      "lock source",
      "no re-picking",
      "play mode",
      "sticky season",
      "debrid season pack",
      "lock series",
    ],
  },
  {
    label: "Restore window position after fullscreen",
    section: "basics",
    anchorTitle: "When you press Play",
    keywords: [
      "restore window",
      "window position",
      "exit fullscreen",
      "return window",
      "window placement",
      "center window",
      "remember window position",
      "player window",
    ],
  },
  {
    label: "Sign in to Harbor",
    section: "account",
    anchorTitle: "Harbor account",
    keywords: [
      "sign in",
      "log in",
      "harbor account",
      "welcome back",
      "authenticate",
      "existing account",
    ],
  },
  {
    label: "Create Harbor account",
    section: "account",
    anchorTitle: "Harbor account",
    keywords: [
      "create account",
      "register",
      "sign up",
      "join harbor",
      "new account",
      "free account",
    ],
  },
  {
    label: "Claim your handle",
    section: "account",
    anchorTitle: "Harbor account",
    keywords: [
      "handle",
      "@handle",
      "claim handle",
      "change handle",
      "username",
      "public handle",
      "find me",
    ],
  },
  {
    label: "Reset password (recovery key)",
    section: "account",
    anchorTitle: "Harbor account",
    keywords: [
      "forgot password",
      "reset password",
      "recovery key",
      "backup code",
      "recover account",
      "lost password",
    ],
  },
  {
    label: "Sign out of Harbor account",
    section: "account",
    anchorTitle: "Harbor account",
    keywords: ["sign out", "logout", "log off", "harbor account", "disconnect"],
  },
  {
    label: "Verified status",
    section: "account",
    anchorTitle: "Harbor account",
    keywords: ["verified", "verification", "verified badge", "checkmark", "ownership"],
  },
  {
    label: "Settings for this profile (shared or independent)",
    section: "account",
    anchorTitle: "Profiles",
    keywords: [
      "profile settings",
      "shared settings",
      "independent settings",
      "per profile",
      "separate preferences",
      "settings scope",
      "linked settings",
    ],
  },
  {
    label: "PIN-locked profiles",
    section: "account",
    anchorTitle: "Profiles",
    keywords: [
      "pin",
      "lock profile",
      "locked profile",
      "unlock",
      "password protect",
      "profile privacy",
      "kids lock",
    ],
  },
  {
    label: "Home style (Harbor curated / Classic Stremio)",
    section: "library",
    anchorTitle: "Home layout",
    keywords: [
      "home style",
      "harbor curated",
      "classic stremio",
      "home mode",
      "hero carousel",
      "curated home",
      "traditional layout",
      "layout style",
    ],
  },
  {
    label: "When the latest episode ends (Hide / Timer)",
    section: "library",
    anchorTitle: "Home layout",
    keywords: [
      "latest episode ends",
      "anime countdown",
      "next episode timer",
      "hide continue watching",
      "episode aired",
      "cw end",
      "timer",
      "countdown",
    ],
  },
  {
    label: "Remove shows once you're caught up",
    section: "library",
    anchorTitle: "Home layout",
    keywords: [
      "caught up",
      "remove caught up",
      "watched all episodes",
      "continue watching cleanup",
      "finished show",
      "hide caught up",
      "up to date",
      "remove from continue watching",
      "clear finished",
      "hide watched shows",
    ],
  },
  {
    label: "Hide and skip episodes",
    section: "library",
    anchorTitle: "Episode cards",
    keywords: [
      "hide episode",
      "skip episode",
      "hidden episodes",
      "right click hide",
      "up next skip",
      "show hidden",
      "episode hiding",
    ],
  },
  {
    label: "Poster shine on hover",
    section: "library",
    anchorTitle: "Hover preview",
    keywords: [
      "poster shine",
      "hover shine",
      "light sweep",
      "tvos shine",
      "card shine",
      "gloss",
      "hover glow",
    ],
  },
  {
    label: "Full quality frames",
    section: "library",
    anchorTitle: "Continue Watching screenshots",
    keywords: [
      "full quality",
      "sharp frames",
      "hd snapshots",
      "crisp screenshots",
      "snapshot quality",
      "continue watching frames",
    ],
  },
  {
    label: "AI search provider (OpenRouter / Groq)",
    section: "library",
    anchorTitle: "AI search",
    keywords: [
      "ai provider",
      "openrouter",
      "groq",
      "search provider",
      "llm provider",
      "lpu",
      "ai search backend",
    ],
  },
  {
    label: "Custom model id",
    section: "library",
    anchorTitle: "AI search",
    keywords: [
      "custom model",
      "model id",
      "custom ai model",
      "paste model",
      "free variant",
      "vendor model",
    ],
  },
  {
    label: "Use live web context (Jina Reader)",
    section: "library",
    anchorTitle: "Live web",
    keywords: [
      "live web",
      "jina",
      "jina reader",
      "web context",
      "duckduckgo",
      "web search ai",
      "current results",
    ],
  },
  {
    label: "Jina API key",
    section: "library",
    anchorTitle: "Live web",
    keywords: ["jina key", "jina api", "reader key", "web quota", "jina token"],
  },
  {
    label: "Use free IMDb data without a TMDB key",
    section: "library",
    anchorTitle: "Titles and descriptions",
    keywords: [
      "imdb fallback",
      "free imdb",
      "no tmdb key",
      "imdb data",
      "cast crew",
      "about panel",
      "imdb source",
    ],
  },
  {
    label: "Song ID provider (AudD / Gemini)",
    section: "library",
    anchorTitle: "Song identification",
    keywords: [
      "song id provider",
      "audd",
      "gemini",
      "music recognition provider",
      "identify song source",
      "shazam alternative",
    ],
  },
  {
    label: "Gemini · in-player song ID",
    section: "library",
    anchorTitle: "Song identification",
    keywords: [
      "gemini",
      "google gemini",
      "song id key",
      "music id",
      "gemini api key",
      "aistudio",
      "identify song",
    ],
  },
  {
    label: "Award tab on cards",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: [
      "award tab",
      "laurel",
      "netflix award",
      "award banner",
      "winner tab",
      "awards bottom",
    ],
  },
  {
    label: "Award tab position",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: [
      "award tab position",
      "above ratings",
      "below ratings",
      "top of card",
      "award on top",
      "award placement",
      "laurel position",
    ],
  },
  {
    label: "Top 10 ribbon",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: ["top 10 ribbon", "top ten", "corner ribbon", "top10", "ribbon badge", "rank ribbon"],
  },
  {
    label: "Ribbon corner",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: ["ribbon corner", "top left", "top right", "ribbon side", "ribbon placement"],
  },
  {
    label: "Show DUB badge on anime cards",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: [
      "dub badge",
      "anime dub",
      "english dub",
      "sub dub",
      "dual audio",
      "dubbed anime",
      "dub sub tag",
    ],
  },
  {
    label: "Show SIMKL score on cards",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: ["simkl", "simkl score", "simkl rating", "card badge", "community rating"],
  },
  {
    label: "Watched badge",
    section: "library",
    anchorTitle: "Metadata providers",
    keywords: [
      "watched badge",
      "seen badge",
      "watched marker",
      "card watched",
      "watched overlay",
      "already watched",
    ],
  },
  {
    label: "Local library",
    section: "library",
    anchorTitle: "Local library",
    keywords: [
      "local library",
      "local files",
      "on disk",
      "offline files",
      "my drive",
      "folders",
      "kodi nfo",
      "local media",
    ],
  },
  {
    label: "Show an on-disk badge on cards",
    section: "library",
    anchorTitle: "Local library",
    keywords: [
      "on disk badge",
      "local badge",
      "downloaded badge",
      "have it",
      "file exists",
      "disk marker",
    ],
  },
  {
    label: "Minimum file size (local scan)",
    section: "library",
    anchorTitle: "Local library",
    keywords: [
      "minimum file size",
      "min size",
      "skip small files",
      "sample filter",
      "scan size",
      "mb threshold",
    ],
  },
  {
    label: "Local playback preference (Ask / Play local / Stream)",
    section: "library",
    anchorTitle: "Local library",
    keywords: [
      "local playback",
      "play local",
      "stream instead",
      "ask local",
      "local vs stream",
      "playback preference",
      "autoplay local",
    ],
  },
  {
    label: "Export artwork sizes (Poster / Backdrop / Logo)",
    section: "library",
    anchorTitle: "Local library",
    keywords: [
      "export artwork",
      "nfo artwork",
      "poster size",
      "backdrop size",
      "logo size",
      "kodi export",
      "image resolution",
      "metadata export",
    ],
  },
  {
    label: "Show sync indicator",
    section: "trackers",
    anchorTitle: "Sync indicator",
    keywords: [
      "sync indicator",
      "sync badge",
      "tracker badge",
      "episode synced",
      "playback overlay",
      "hide badge",
      "show indicator",
      "sync toast",
    ],
  },
  {
    label: "Sync indicator position",
    section: "trackers",
    anchorTitle: "Sync indicator",
    keywords: [
      "position",
      "corner",
      "top left",
      "top right",
      "bottom center",
      "placement",
      "badge location",
      "where",
    ],
  },
  {
    label: "Use MyAnimeList avatar",
    section: "trackers",
    anchorTitle: "Connected",
    keywords: [
      "mal avatar",
      "myanimelist avatar",
      "profile picture",
      "avatar",
      "harbor avatar",
      "profile photo",
      "use avatar",
    ],
  },
  {
    label: "Show Simkl rails on Home",
    section: "trackers",
    anchorTitle: "Connected",
    keywords: [
      "simkl rails",
      "home rows",
      "home screen",
      "watching",
      "plan to watch",
      "up next",
      "trending",
      "rails on home",
    ],
  },
  {
    label: "Show Up Next on Simkl rail",
    section: "trackers",
    anchorTitle: "Connected",
    keywords: [
      "up next",
      "upcoming episodes",
      "next episode",
      "simkl rail",
      "watching",
      "plan to watch",
      "home rail",
    ],
  },
  {
    label: "Show Simkl Trending Today rail",
    section: "trackers",
    anchorTitle: "Connected",
    keywords: [
      "trending",
      "trending today",
      "popular",
      "simkl trending",
      "hot",
      "movies",
      "tv",
      "anime",
    ],
  },
  {
    label: "Scrobble to Simkl",
    section: "trackers",
    anchorTitle: "Connected",
    keywords: [
      "scrobble",
      "auto track",
      "watch progress",
      "real-time",
      "now playing",
      "track playback",
      "resume",
      "sync",
    ],
  },
  {
    label: "Display Simkl Community Ratings",
    section: "trackers",
    anchorTitle: "Connected",
    keywords: [
      "community ratings",
      "simkl score",
      "rating badge",
      "details page",
      "community score",
      "ratings",
    ],
  },
  {
    label: "Enable User Ratings",
    section: "trackers",
    anchorTitle: "Connected",
    keywords: [
      "user ratings",
      "star rating",
      "rate",
      "star picker",
      "my rating",
      "score",
      "rate anime",
    ],
  },
  {
    label: "Anime Title Language",
    section: "trackers",
    anchorTitle: "Connected",
    keywords: [
      "anime title",
      "title language",
      "english",
      "romaji",
      "native",
      "japanese",
      "poster title",
      "language",
    ],
  },
  {
    label: "Home rail categories (Movies, TV, Anime)",
    section: "trackers",
    anchorTitle: "Home Rail Settings",
    keywords: [
      "home rail settings",
      "categories",
      "plan to watch",
      "watching",
      "movies",
      "tv shows",
      "anime",
      "rail filters",
      "which rails",
    ],
  },
  {
    label: "Relay version status",
    section: "relay",
    anchorTitle: "Harbor Relay",
    keywords: [
      "relay version",
      "outdated",
      "up to date",
      "current version",
      "update available",
      "protocol",
    ],
  },
  {
    label: "Download relay documentation",
    section: "relay",
    anchorTitle: "Harbor Relay",
    keywords: ["download docs", "export documentation", "pdf", "txt", "json", "save docs", "print"],
  },
  {
    label: "Move Refresh next to Back",
    section: "streaming",
    anchorTitle: "Refresh button",
    keywords: [
      "refresh button",
      "refresh position",
      "picker refresh",
      "next to back",
      "move refresh",
      "refresh placement",
      "reload button",
      "stream picker header",
    ],
  },
  {
    label: "Set active filter",
    section: "streamFilters",
    anchorTitle: "Saved stream filters",
    keywords: [
      "set active",
      "active filter",
      "apply filter",
      "enable filter",
      "use filter",
      "current filter",
      "default filter",
    ],
  },
  {
    label: "Resolution filter",
    section: "streamFilters",
    anchorTitle: "Saved stream filters",
    keywords: ["resolution", "4k", "2160p", "1080p", "720p", "480p", "sd", "quality"],
  },
  {
    label: "Source filter",
    section: "streamFilters",
    anchorTitle: "Saved stream filters",
    keywords: [
      "source",
      "bluray",
      "remux",
      "web-dl",
      "webrip",
      "bdrip",
      "hdrip",
      "dvdrip",
      "hdtv",
      "cam",
    ],
  },
  {
    label: "Codec filter",
    section: "streamFilters",
    anchorTitle: "Saved stream filters",
    keywords: ["codec", "hevc", "h265", "x265", "avc", "h264", "x264", "av1", "vp9", "mpeg2"],
  },
  {
    label: "Audio filter",
    section: "streamFilters",
    anchorTitle: "Saved stream filters",
    keywords: ["audio", "atmos", "truehd", "dts", "dts-hd ma", "dd+", "ac3", "aac", "opus", "flac"],
  },
  {
    label: "HDR only",
    section: "streamFilters",
    anchorTitle: "Saved stream filters",
    keywords: ["hdr", "dolby vision", "hdr10", "hlg", "high dynamic range", "drop sdr", "hdr only"],
  },
  {
    label: "Cached only",
    section: "streamFilters",
    anchorTitle: "Saved stream filters",
    keywords: [
      "cached",
      "debrid",
      "real-debrid",
      "instant",
      "already cached",
      "library",
      "cache only",
    ],
  },
  {
    label: "Min seeders",
    section: "streamFilters",
    anchorTitle: "Saved stream filters",
    keywords: [
      "seeders",
      "seeds",
      "minimum seeders",
      "min seeds",
      "peers",
      "torrent health",
      "leechers",
    ],
  },
  {
    label: "Max size (GB)",
    section: "streamFilters",
    anchorTitle: "Saved stream filters",
    keywords: [
      "max size",
      "file size",
      "size limit",
      "gigabytes",
      "gb",
      "cap size",
      "maximum size",
    ],
  },
  {
    label: "RTX Video HDR",
    section: "player",
    anchorTitle: "Player engine",
    keywords: [
      "rtx hdr",
      "rtx video hdr",
      "nvidia hdr",
      "sdr to hdr",
      "ai hdr",
      "auto hdr",
      "upconvert hdr",
      "gpu hdr",
    ],
  },
  {
    label: "RTX Video Super Resolution",
    section: "player",
    anchorTitle: "Player engine",
    keywords: [
      "rtx vsr",
      "video super resolution",
      "nvidia upscale",
      "ai upscaling",
      "sdr upscale",
      "rtx upscaling",
      "super resolution",
      "gpu upscale",
    ],
  },
  {
    label: "Scan who is on screen while playing",
    section: "player",
    anchorTitle: "X-Ray (experimental)",
    keywords: [
      "face scan",
      "on-device face matching",
      "who is on screen now",
      "live scan",
      "face recognition",
      "actors in scene",
      "real-time cast",
      "xray live scan",
    ],
  },
  {
    label: "Auto-skip recaps",
    section: "player",
    anchorTitle: "Skip intros & credits",
    keywords: [
      "skip recap",
      "auto skip recap",
      "previously on",
      "recap segment",
      "jump recap",
      "skip previously on",
      "skip catch up",
    ],
  },
  {
    label: "Auto-skip credit outros",
    section: "player",
    anchorTitle: "Skip intros & credits",
    keywords: [
      "skip credits",
      "skip outro",
      "auto skip credits",
      "end credits",
      "ending",
      "skip ending",
      "credits countdown",
      "ed skip",
      "skip end credits",
    ],
  },
  {
    label: "Ask if you're still watching",
    section: "player",
    anchorTitle: "Next episode prompt",
    keywords: [
      "still watching",
      "are you still watching",
      "still there",
      "binge pause",
      "idle check",
      "keep watching prompt",
      "after 3 episodes",
      "auto pause binge",
      "are you still there",
      "binge guard",
      "stop after episodes",
      "idle prompt",
    ],
  },
  {
    label: "Queue drives Next/Previous",
    section: "player",
    anchorTitle: "Next episode prompt",
    keywords: [
      "queue next",
      "queue navigation",
      "next previous queue",
      "up next queue",
      "play queue",
      "queue controls next",
      "queue drives nav",
      "queue",
      "next previous",
      "playlist order",
    ],
  },
  {
    label: "Show controls when pausing with keyboard",
    section: "player",
    anchorTitle: "Next episode prompt",
    keywords: [
      "pause controls",
      "keyboard pause",
      "show controls on pause",
      "space bar controls",
      "hide controls subtitles",
      "pause overlay",
    ],
  },
  {
    label: "Sleep timer in the top bar",
    section: "player",
    anchorTitle: "Next episode prompt",
    keywords: [
      "sleep timer",
      "top bar timer",
      "auto pause timer",
      "bedtime timer",
      "stop after time",
      "episode limit timer",
      "timer button",
    ],
  },
  {
    label: "Snapdragon SGSR upscaler",
    section: "shaders",
    anchorTitle: "More picture shaders",
    keywords: [
      "sgsr",
      "snapdragon",
      "qualcomm",
      "game super resolution",
      "spatial upscale",
      "upscaler",
      "low power",
      "single pass",
    ],
  },
  {
    label: "RAVU Lite prescaler",
    section: "shaders",
    anchorTitle: "More picture shaders",
    keywords: [
      "ravu",
      "ravu lite",
      "luma prescaler",
      "prescaler",
      "luma doubler",
      "anime upscale",
      "radius",
      "cheap shader",
    ],
  },
  {
    label: "NNEDI3 neural upscaler",
    section: "shaders",
    anchorTitle: "More picture shaders",
    keywords: [
      "nnedi3",
      "neural upscaler",
      "edge directed",
      "luma doubler",
      "neurons",
      "high quality upscale",
      "heavy shader",
      "32 64 128 neurons",
    ],
  },
  {
    label: "SSimSuperRes detail refinement",
    section: "shaders",
    anchorTitle: "More picture shaders",
    keywords: [
      "ssimsuperres",
      "ssim superres",
      "detail refine",
      "recover detail",
      "post upscale",
      "restore sharpness",
      "detail restore",
    ],
  },
  {
    label: "KrigBilateral chroma upscaler",
    section: "shaders",
    anchorTitle: "More picture shaders",
    keywords: [
      "krigbilateral",
      "krig",
      "chroma upscaler",
      "chroma scaling",
      "color blur",
      "color bleed",
      "saturated edges",
      "chroma",
    ],
  },
  {
    label: "Adaptive Sharpen",
    section: "shaders",
    anchorTitle: "More picture shaders",
    keywords: [
      "adaptive sharpen",
      "sharpener",
      "edge aware sharpen",
      "sharpening",
      "soft detail",
      "no halos",
      "alternative to cas",
    ],
  },
  {
    label: "Content advisory on start",
    section: "playerLayout",
    anchorTitle: "While you watch",
    keywords: [
      "content advisory",
      "parental guide",
      "content warning",
      "imdb",
      "violence",
      "profanity",
      "maturity",
      "severity",
      "start toast",
    ],
  },
  {
    label: "Buffer fill",
    section: "playerLayout",
    anchorTitle: "Seek bar",
    keywords: [
      "buffer fill",
      "buffered",
      "download ahead",
      "cache indicator",
      "seek bar buffer",
      "loaded portion",
      "buffer bar",
    ],
  },
  {
    label: "Buffer fill brightness",
    section: "playerLayout",
    anchorTitle: "Seek bar",
    keywords: [
      "buffer brightness",
      "buffer opacity",
      "fill opacity",
      "dim buffer",
      "buffer transparency",
      "buffer fill brightness",
      "seek buffer brightness",
    ],
  },
  {
    label: "Navigation",
    section: "hotkeys",
    anchorTitle: "Navigation",
    keywords: [
      "navigation",
      "tv remote",
      "arrow keys",
      "focus navigation",
      "remote control",
      "keyboard nav",
      "d-pad",
    ],
  },
  {
    label: "TV navigation",
    section: "hotkeys",
    anchorTitle: "Navigation",
    keywords: [
      "tv navigation",
      "arrow keys",
      "focus",
      "remote",
      "spatial navigation",
      "d-pad",
      "enter select",
    ],
  },
  {
    label: "TV navigation in player",
    section: "hotkeys",
    anchorTitle: "Navigation",
    keywords: [
      "player navigation",
      "arrows in player",
      "control focus",
      "remote in player",
      "spatial nav player",
      "select space",
    ],
  },
  {
    label: "Short seek (Shift + arrows)",
    section: "hotkeys",
    anchorTitle: "Behavior",
    keywords: [
      "short seek",
      "shift arrows",
      "small jump",
      "nudge seconds",
      "fine seek",
      "shorter jump",
      "seek step",
    ],
  },
  {
    label: "Short seek back",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: [
      "short rewind",
      "shift left",
      "small jump back",
      "nudge back",
      "fine rewind",
      "shift arrow left",
    ],
  },
  {
    label: "Short seek forward",
    section: "hotkeys",
    anchorTitle: "Player",
    keywords: [
      "short skip forward",
      "shift right",
      "small jump ahead",
      "nudge forward",
      "fine forward",
      "shift arrow right",
    ],
  },
  {
    label: "Enable controller",
    section: "controllers",
    anchorTitle: "Controller support",
    keywords: [
      "enable controller",
      "turn on gamepad",
      "disable controller",
      "controller on off",
      "toggle gamepad",
      "activate controller",
      "controller support",
    ],
  },
  {
    label: "Live controller preview",
    section: "controllers",
    anchorTitle: "Controller support",
    keywords: [
      "live preview",
      "test controller",
      "input test",
      "button test",
      "controller diagram",
      "xbox layout",
      "playstation layout",
      "mirror inputs",
    ],
  },
  {
    label: "Connected controllers",
    section: "controllers",
    anchorTitle: "Connected controllers",
    keywords: [
      "connected controllers",
      "detected controllers",
      "paired controller",
      "recognized gamepad",
      "controller list",
      "usb bluetooth controller",
    ],
  },
  {
    label: "Button map",
    section: "controllers",
    anchorTitle: "Button map",
    keywords: [
      "button map",
      "button mapping",
      "controls reference",
      "what buttons do",
      "browsing controls",
      "player controls",
      "d-pad",
      "bumpers triggers",
    ],
  },
  {
    label: "Test controller",
    section: "controllers",
    anchorTitle: "Controller support",
    keywords: [
      "test controller",
      "test mode",
      "controller test",
      "try controller",
      "check buttons",
      "controller selecting things",
      "stop controller navigating",
      "capture controller",
    ],
  },
  {
    label: "Controller cursor",
    section: "controllers",
    anchorTitle: "Controller cursor",
    keywords: [
      "cursor",
      "pointer",
      "dot",
      "controller cursor",
      "cursor image",
      "custom cursor",
      "harbor logo cursor",
      "boat cursor",
      "cursor size",
    ],
  },
  {
    label: "Your own image",
    section: "controllers",
    anchorTitle: "Controller cursor",
    keywords: ["custom cursor", "upload cursor", "cursor image", "replace cursor"],
  },
  {
    label: "Cursor size",
    section: "controllers",
    anchorTitle: "Controller cursor",
    keywords: ["cursor size", "bigger cursor", "smaller pointer", "cursor px"],
  },
  {
    label: "Deadzone",
    section: "controllers",
    anchorTitle: "Stick and timing",
    keywords: [
      "deadzone",
      "stick drift",
      "stick sensitivity",
      "analog threshold",
      "thumbstick",
      "focus drift",
    ],
  },
  {
    label: "Repeat speed",
    section: "controllers",
    anchorTitle: "Stick and timing",
    keywords: [
      "repeat speed",
      "navigation speed",
      "focus move speed",
      "held direction",
      "repeat rate",
      "scroll speed",
    ],
  },
  {
    label: "Initial delay",
    section: "controllers",
    anchorTitle: "Stick and timing",
    keywords: [
      "initial delay",
      "repeat delay",
      "hold delay",
      "before repeating",
      "key repeat delay",
      "held direction delay",
    ],
  },
  {
    label: "Choose subtitles before playback",
    section: "subtitles",
    anchorTitle: "Subtitle languages",
    keywords: [
      "subtitle picker",
      "preselect subtitles",
      "before playback",
      "pick track",
      "manual subtitle",
      "choose track",
      "subtitle prompt",
      "select subtitle",
    ],
  },
  {
    label: "Image languages",
    section: "language",
    anchorTitle: "Artwork",
    keywords: [
      "image languages",
      "poster language",
      "logo language",
      "title art",
      "artwork language",
      "tmdb images",
      "original",
      "poster art",
    ],
  },
  {
    label: "Normalize embedded subtitle size",
    section: "subtitles",
    anchorTitle: "Subtitle style",
    keywords: [
      "normalize subtitle size",
      "ass subtitle size",
      "consistent size",
      "embedded subs size",
      "dialogue size",
      "styled subs",
      "auto adjust size",
    ],
  },
  {
    label: "SUBDL subtitle source",
    section: "subtitles",
    anchorTitle: "Subtitle sources",
    keywords: [
      "subdl",
      "subtitle source",
      "subtitle provider",
      "subdl api key",
      "subtitle database",
      "captions",
      "srt",
      "add subtitle source",
    ],
  },
  {
    label: "Subsource subtitle source",
    section: "subtitles",
    anchorTitle: "Subtitle sources",
    keywords: [
      "subsource",
      "subtitle source",
      "subtitle provider",
      "subsource api key",
      "community subtitles",
      "captions",
      "srt",
      "add subtitle source",
    ],
  },
  {
    label: "Auto-apply audio-derived sync fixes",
    section: "subtitles",
    anchorTitle: "Subtitle auto-sync",
    keywords: [
      "auto apply",
      "auto-apply",
      "apply automatically",
      "structural tiers",
      "audio derived",
      "content hashing",
      "identity match",
      "earn trust",
      "apply fix without asking",
      "no prompt",
    ],
  },
  {
    label: "Use community corrections",
    section: "subtitles",
    anchorTitle: "Community sync",
    keywords: [
      "community corrections",
      "shared database",
      "community sync",
      "crowd sync",
      "crowdsourced",
      "verified fixes",
      "instant sync",
      "shared fixes",
      "lookup",
      "already synced",
    ],
  },
  {
    label: "Community sync server URL",
    section: "subtitles",
    anchorTitle: "Community sync",
    keywords: [
      "sync server",
      "server url",
      "community server",
      "custom server",
      "self host",
      "self-hosted",
      "own server",
      "sync endpoint",
      "point to server",
      "sync.harbor.site",
    ],
  },
  {
    label: "Private mode (no community sync contact)",
    section: "subtitles",
    anchorTitle: "Community sync",
    keywords: [
      "private mode",
      "opt out",
      "opt-out",
      "do not upload",
      "do not contribute",
      "no lookup",
      "disable community",
      "privacy",
      "stop sharing",
      "offline",
    ],
  },
  {
    label: "Poster image quality",
    section: "theme",
    anchorTitle: "Poster card style",
    keywords: [
      "poster quality",
      "image quality",
      "resolution",
      "decode resolution",
      "balanced",
      "high",
      "maximum",
      "memory usage",
      "sharpness",
    ],
  },
  {
    label: "Use liquid glass",
    section: "theme",
    anchorTitle: "Liquid Glass",
    keywords: [
      "liquid glass",
      "search pill",
      "row arrows",
      "scroll arrows",
      "glass button",
      "refraction",
      "webgl",
      "glassy arrows",
      "watch together",
    ],
  },
  {
    label: "Enhanced liquid glass",
    section: "theme",
    anchorTitle: "Liquid Glass",
    keywords: [
      "enhanced glass",
      "glass opacity",
      "glass blur",
      "glass tint",
      "richer glass",
      "glass appearance",
      "liquid glass",
    ],
  },
  {
    label: "Poster dock magnification",
    section: "theme",
    anchorTitle: "Poster card style",
    keywords: [
      "dock magnification",
      "magnify posters",
      "poster zoom",
      "hover magnify",
      "mac dock",
      "animation speed",
      "poster row zoom",
    ],
  },
  {
    label: "Sound effects",
    section: "theme",
    anchorTitle: "Sound effects",
    keywords: [
      "sound effects",
      "audio feedback",
      "ui sounds",
      "click sounds",
      "glass",
      "modern",
      "retro",
      "cinematic",
      "sound theme",
    ],
  },
  {
    label: "Sound effects volume",
    section: "theme",
    anchorTitle: "Sound effects",
    keywords: [
      "sound volume",
      "sfx volume",
      "effects volume",
      "loudness",
      "ui sound level",
      "audio level",
    ],
  },
  {
    label: "Player volume sounds",
    section: "theme",
    anchorTitle: "Sound effects",
    keywords: [
      "player volume sound",
      "volume beep",
      "volume change sound",
      "player sfx",
      "volume click",
    ],
  },
  {
    label: "Home hero featured source",
    section: "library",
    anchorTitle: "Home hero",
    keywords: [
      "featured source",
      "hero feed",
      "trending",
      "trakt",
      "simkl",
      "classic",
      "banner content",
      "what fills the hero",
    ],
  },
  {
    label: "Play trailers in the hero",
    section: "library",
    anchorTitle: "Home hero",
    keywords: [
      "hero trailer",
      "play trailer",
      "background trailer",
      "muted trailer",
      "home banner video",
      "autoplay hero",
    ],
  },
  {
    label: "Home hero audio",
    section: "library",
    anchorTitle: "Home hero",
    keywords: [
      "hero audio",
      "hero sound",
      "trailer sound",
      "unmuted hero",
      "home hero volume",
      "mute button",
    ],
  },
  {
    label: "Ambient screensaver",
    section: "theme",
    anchorTitle: "Screensaver",
    keywords: [
      "screensaver",
      "ambient",
      "idle",
      "screen saver",
      "backdrops",
      "clock",
      "start after",
      "idle timeout",
    ],
  },
  {
    label: "Native-style hybrid bar",
    section: "theme",
    anchorTitle: "Window title bar",
    keywords: [
      "hybrid title bar",
      "window buttons",
      "traffic lights",
      "native style",
      "corner buttons",
      "macos dots",
    ],
  },
  {
    label: "Frost the top bar on scroll",
    section: "theme",
    anchorTitle: "Window title bar",
    keywords: [
      "menu on top",
      "top bar",
      "move the menu",
      "frost top bar",
      "blur top bar",
      "scroll blur",
      "frosted header",
      "top bar blur",
      "glass header",
    ],
  },
  {
    label: "Top-right controls",
    section: "theme",
    anchorTitle: "Window title bar",
    keywords: [
      "top right controls",
      "liquid glass",
      "clean transparent",
      "filled",
      "window controls",
      "watch together",
      "minimize",
      "maximize",
      "close",
    ],
  },
  {
    label: "App logo",
    section: "theme",
    anchorTitle: "Logo & app icon",
    keywords: [
      "app logo",
      "sidebar logo",
      "custom logo",
      "brand mark",
      "replace logo",
      "logo mark",
      "upload logo",
    ],
  },
  {
    label: "Wordmark",
    section: "theme",
    anchorTitle: "Logo & app icon",
    keywords: [
      "wordmark",
      "wide logo",
      "text logo",
      "sidebar wordmark",
      "brand name",
      "custom wordmark",
    ],
  },
  {
    label: "App icon",
    section: "theme",
    anchorTitle: "Logo & app icon",
    keywords: [
      "change the app icon",
      "custom icon",
      "dock icon",
      "taskbar icon",
      "app icon",
      "window icon",
      "taskbar icon",
      "custom icon",
      "harbor icons",
      "icon presets",
      "dock icon",
    ],
  },
  {
    label: "Export badge setup",
    section: "badges",
    anchorTitle: "Packs & import",
    keywords: [
      "export badges",
      "badges.json",
      "backup badges",
      "save badge setup",
      "copy json",
      "share badges",
    ],
  },
  {
    label: "Reset badges to default",
    section: "badges",
    anchorTitle: "Badge art",
    keywords: [
      "reset badges",
      "default badges",
      "restore badges",
      "reset badge art",
      "clear customizations",
      "revert badges",
    ],
  },
  {
    label: "Downloaded community badge packs",
    section: "badges",
    anchorTitle: "Downloaded from community",
    keywords: [
      "installed badge packs",
      "remove badge pack",
      "community badge packs",
      "uninstall pack",
      "downloaded packs",
      "manage badge packs",
    ],
  },
  {
    label: "Test badge rules (Try it)",
    section: "badges",
    anchorTitle: "Custom rules",
    keywords: [
      "test badge",
      "preview badge",
      "try badge rule",
      "sample stream name",
      "badge preview",
      "test rule",
    ],
  },
  {
    label: "Tracked person release rule",
    section: "webhooks",
    anchorTitle: "Automations",
    keywords: [
      "tracked person alert",
      "person trigger",
      "someone i track",
      "follow actor release",
      "director new release",
      "cast release ping",
      "watched people automation",
    ],
  },
  {
    label: "Genre release rule",
    section: "webhooks",
    anchorTitle: "Automations",
    keywords: [
      "genre alert",
      "genre trigger",
      "specific genre releases",
      "genre automation",
      "movies series genre",
      "genre ping",
    ],
  },
  {
    label: "Streamer release rule",
    section: "webhooks",
    anchorTitle: "Automations",
    keywords: [
      "streamer alert",
      "provider trigger",
      "netflix disney max release",
      "crunchyroll release",
      "streaming service automation",
      "streamer ping",
    ],
  },
  {
    label: "Country release rule",
    section: "webhooks",
    anchorTitle: "Automations",
    keywords: [
      "country alert",
      "country trigger",
      "region release",
      "japan korea us release",
      "country automation",
      "country ping",
    ],
  },
  {
    label: "Live TV reminder",
    section: "webhooks",
    anchorTitle: "Automations",
    keywords: [
      "live tv alert",
      "iptv reminder",
      "program about to start",
      "epg reminder",
      "lead time minutes",
      "favorited channels",
      "heads up notification",
      "live tv rule",
    ],
  },
  {
    label: "Enable or disable rule",
    section: "webhooks",
    anchorTitle: "Automations",
    keywords: [
      "turn off rule",
      "pause automation",
      "disable rule",
      "enable rule",
      "rule toggle",
      "mute automation",
    ],
  },
  {
    label: "Rule notify channels",
    section: "webhooks",
    anchorTitle: "Automations",
    keywords: [
      "notify on discord",
      "notify on telegram",
      "rule channel",
      "route rule",
      "then notify",
      "per rule destination",
    ],
  },
  {
    label: "Contact email or Discord",
    section: "bug",
    anchorTitle: "Credit (optional)",
    keywords: [
      "email",
      "discord",
      "contact",
      "reach you",
      "follow up",
      "get in touch",
      "reporter contact",
      "handle",
    ],
  },
  {
    label: "Continue Watching suggestions cache",
    section: "storage",
    anchorTitle: "Clear caches",
    keywords: [
      "continue watching",
      "resurface",
      "suggestions cache",
      "cw cache",
      "home rail",
      "rewatch picks",
      "clear resurface",
      "recommendations cache",
    ],
  },
  {
    label: "Settings storage breakdown",
    section: "storage",
    anchorTitle: "Storage overview",
    keywords: [
      "settings storage",
      "localstorage",
      "biggest keys",
      "largest settings",
      "what's using space",
      "config size",
      "space breakdown",
      "storage usage",
    ],
  },
  {
    label: "Fix corrupted anime",
    section: "advanced",
    anchorTitle: "Stremio library repair",
    keywords: [
      "corrupted anime",
      "anime repair",
      "continue watching broken",
      "trakt marking",
      "wrong id",
      "scan for corruption",
      "fix anime library",
      "heal anime",
    ],
  },
  {
    label: "Create folders for movies and shows",
    section: "advanced",
    anchorTitle: "Downloads",
    keywords: [
      "download folders",
      "organize downloads",
      "subfolders",
      "folder per movie",
      "folder per series",
      "sort downloads by title",
      "create folders",
    ],
  },
  {
    label: "Restore previous settings",
    section: "updates",
    anchorTitle: "Backup & restore",
    keywords: [
      "recover settings",
      "settings reset",
      "lost theme",
      "restore theme",
      "recover keys",
      "profile migration",
      "bring back old setup",
      "previous settings",
    ],
  },
  {
    label: "Auto-sync subtitles",
    section: "subtitles",
    anchorTitle: "Subtitle auto-sync",
    keywords: [
      "auto sync",
      "autosync",
      "fix subtitle timing",
      "subtitles out of sync",
      "resync automatically",
    ],
  },
  {
    label: "Let structural tiers auto-apply",
    section: "subtitles",
    anchorTitle: "Subtitle auto-sync",
    keywords: ["auto apply", "structural", "apply fix without asking", "no prompt sync"],
  },
  {
    label: "Smart resync with speech recognition",
    section: "subtitles",
    anchorTitle: "Subtitle auto-sync",
    keywords: ["speech recognition", "asr", "smart resync", "audio derived sync", "whisper"],
  },
  {
    label: "Match subtitles across languages (experimental)",
    section: "subtitles",
    anchorTitle: "Subtitle auto-sync",
    keywords: [
      "cross language",
      "different language",
      "pivot subtitle",
      "audio language",
      "experimental sync",
    ],
  },
  {
    label: "Stay on one source for a season",
    section: "player",
    anchorTitle: "Play button behavior",
    keywords: [
      "season lock",
      "same source",
      "keep release",
      "one release per season",
      "stick to source",
    ],
  },
  {
    label: "Auto-skip stalled streams",
    section: "player",
    anchorTitle: "Play button behavior",
    keywords: [
      "stalled",
      "dead stream",
      "stream wont start",
      "try next stream",
      "skip broken source",
    ],
  },
  {
    label: "Disable torrents entirely",
    section: "p2p",
    anchorTitle: "Power tools & diagnostics",
    keywords: ["no torrents", "disable p2p", "turn off torrents", "debrid only"],
  },
  {
    label: "Auto-confirm peer-to-peer streaming",
    section: "p2p",
    anchorTitle: "Power tools & diagnostics",
    keywords: ["p2p confirm", "skip torrent warning", "auto confirm", "dont ask torrent"],
  },
  {
    label: "Keep downloading after you leave",
    section: "p2p",
    anchorTitle: "Local engine",
    keywords: ["keep downloading", "background download", "continue after close", "seed"],
  },
  {
    label: "Row card style",
    section: "theme",
    anchorTitle: "Poster card style",
    keywords: ["tv cards", "poster cards", "wide cards", "card layout", "landscape cards"],
  },
  {
    label: "Focused Card",
    section: "theme",
    anchorTitle: "Card behaviour",
    keywords: ["focused card", "dim other cards", "highlight selected", "blur others"],
  },
  {
    label: "Expanding Cards",
    section: "theme",
    anchorTitle: "Card behaviour",
    keywords: ["expanding cards", "card expands", "wide art on focus", "backdrop expansion"],
  },
  {
    label: "Watchlist bookmark",
    section: "library",
    anchorTitle: "On the poster",
    keywords: ["bookmark", "watchlist marker", "saved marker", "corner bookmark"],
  },
  {
    label: "Max scores per card",
    section: "library",
    anchorTitle: "Scores",
    keywords: ["badge limit", "how many ratings", "score count", "too many badges"],
  },
  {
    label: "Keep Continue Watching private to each profile",
    section: "library",
    anchorTitle: "Home layout",
    keywords: [
      "private continue watching",
      "per profile history",
      "separate history",
      "profile privacy",
    ],
  },
  {
    label: "Smooth scrolling",
    section: "library",
    anchorTitle: "Home layout",
    keywords: ["smooth scroll", "scrolling", "scroll animation", "jerky scrolling"],
  },
  {
    label: "Always re-encode when casting",
    section: "player",
    anchorTitle: "Player engine",
    keywords: ["cast", "chromecast", "re-encode", "transcode", "casting wont play"],
  },
  {
    label: "Enable X-Ray",
    section: "player",
    anchorTitle: "X-Ray (experimental)",
    keywords: ["xray", "x-ray", "cast list", "who is this actor", "amazon xray", "actor bios"],
  },
  {
    label: "Quality badge style",
    section: "player",
    anchorTitle: "Stream quality in player",
    keywords: ["quality badge", "4k badge", "resolution badge", "what am i watching"],
  },
  {
    label: "Show the Big Picture button",
    section: "hotkeys",
    anchorTitle: "Big Picture",
    keywords: ["big picture button", "tv mode button", "hide big picture", "ten foot"],
  },
  {
    label: "Keep controlling Harbor in the background",
    section: "controllers",
    anchorTitle: "Controller support",
    keywords: ["background controller", "controller when unfocused", "gamepad background"],
  },
  {
    label: "Start as",
    section: "account",
    anchorTitle: "Profiles",
    keywords: ["default profile", "start as", "skip whos watching", "auto select profile"],
  },
  {
    label: "Subtitle indicator dot",
    section: "subtitles",
    anchorTitle: "Turning them on",
    keywords: ["subtitle dot", "green dot", "subtitle indicator", "cc indicator"],
  },
  {
    label: "Never auto-select tracks containing",
    section: "language",
    anchorTitle: "Skip these tracks",
    keywords: [
      "block words",
      "skip commentary",
      "descriptive audio",
      "avoid tracks",
      "track blocklist",
    ],
  },
  {
    label: "Show an on disk badge on cards",
    section: "library",
    anchorTitle: "On the poster",
    keywords: ["on disk", "local file badge", "downloaded badge", "have it locally"],
  },
  {
    label: "Use Cinemeta for title metadata",
    section: "library",
    anchorTitle: "Titles and descriptions",
    keywords: ["cinemeta", "stremio metadata", "title source", "metadata addon"],
  },
  {
    label: "When a title is in your local library",
    section: "library",
    anchorTitle: "Local library",
    keywords: ["local file", "play local", "prefer local copy", "on disk playback"],
  },
  {
    label: "SVP engine",
    section: "anime",
    anchorTitle: "SVP frame interpolation",
    keywords: [
      "svp",
      "smoothvideo",
      "frame interpolation",
      "60fps",
      "motion smoothing",
      "vapoursynth",
    ],
  },
  {
    label: "Rich season and order panel",
    section: "library",
    anchorTitle: "Episode cards",
    keywords: ["season panel", "episode order", "absolute order", "season picker"],
  },
  {
    label: "Player style",
    section: "playerLayout",
    keywords: ["player skin", "player layout", "player look", "controls style"],
  },
  {
    label: "Sound profile",
    section: "player",
    anchorTitle: "Audio",
    keywords: [
      "sound profile",
      "eq",
      "equalizer",
      "audio profile",
      "night mode audio",
      "boost dialogue",
    ],
  },
  {
    label: "Playback quality",
    section: "mpv",
    anchorTitle: "Picture quality",
    keywords: [
      "playback quality",
      "picture quality",
      "performance",
      "quality preset",
      "how hard my pc works",
    ],
  },
  {
    label: "Scroll up for the trailer",
    section: "library",
    anchorTitle: "Show pages",
    keywords: ["scroll trailer", "trailer on scroll", "autoplay trailer", "hero trailer"],
  },
  {
    label: "Serve Harbor on your network",
    section: "remotes",
    anchorTitle: "Harbor on other devices",
    keywords: [
      "lan",
      "network",
      "web app",
      "open on phone",
      "serve harbor",
      "local server",
      "wifi access",
    ],
  },
  {
    label: "Deploy a relay",
    section: "relay",
    keywords: [
      "deploy relay",
      "cloudflare worker",
      "watch together server",
      "own relay",
      "host relay",
    ],
  },
  {
    label: "Use an existing relay",
    section: "relay",
    keywords: ["relay url", "existing relay", "friends relay", "paste relay", "wss"],
  },
  {
    label: "Subtitle language order",
    section: "subtitles",
    anchorTitle: "Subtitle languages",
    keywords: ["language order", "priority", "which subtitle first", "preferred subtitle language"],
  },
  {
    label: "Show subtitle sync indicator",
    section: "subtitles",
    anchorTitle: "Sync indicator",
    keywords: ["sync indicator", "subtitle offset display", "timing feedback", "offset readout"],
  },
  {
    label: "When you open a profile",
    section: "account",
    anchorTitle: "Profiles",
    keywords: ["profile open", "on profile switch", "profile startup", "what happens on switch"],
  },
  {
    label: "Cache folder",
    section: "storage",
    anchorTitle: "Stream cache",
    keywords: [
      "cache folder",
      "cache location",
      "change folder",
      "where files live",
      "move cache",
      "different drive",
    ],
  },
  {
    label: "Bookmark corner",
    section: "library",
    anchorTitle: "On the poster",
    keywords: ["bookmark corner", "marker position", "watchlist corner", "which corner"],
  },
  {
    label: "Import a badge pack",
    section: "badges",
    anchorTitle: "Packs & import",
    keywords: ["import pack", "install pack", "badge pack", "badges json", "community pack"],
  },
  {
    label: "Make an award pack",
    section: "awardIcons",
    anchorTitle: "Award Icons",
    keywords: ["award pack", "make pack", "custom awards", "award icons", "laurel"],
  },
];

setSettingsSearchVocabulary([
  ...SETTINGS_OPTIONS.flatMap((o) => [o.label, ...(o.keywords ?? [])]),
  ...NAV_GROUPS.flatMap((g) => [
    g.heading ?? "",
    ...g.items.flatMap((it) => [it.label, ...(it.keywords ?? [])]),
  ]),
]);

export function SettingsNav({
  active,
  onChange,
}: {
  active: SectionId;
  onChange: (id: SectionId, anchor?: string) => void;
}) {
  const { settings } = useSettings();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
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
          groupHit || matchesSettingsSearch(trimmed, [item.label], t, item.keywords ?? []);
        if (hit) out.push(item);
      }
    }
    return out.sort(
      (a, b) =>
        rankSettingsSearch(trimmed, a.label, a.keywords ?? []) -
        rankSettingsSearch(trimmed, b.label, b.keywords ?? []),
    );
  }, [t, trimmed]);
  const optionMatches = useMemo<SettingsOption[] | null>(() => {
    if (!trimmed) return null;
    return SETTINGS_OPTIONS.filter((o) =>
      matchesSettingsSearch(trimmed, [o.label], t, o.keywords ?? []),
    ).sort(
      (a, b) =>
        rankSettingsSearch(trimmed, a.label, a.keywords ?? []) -
        rankSettingsSearch(trimmed, b.label, b.keywords ?? []),
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
    trackers: null,
    updates: null,
    relay: relayLive,
    streaming: debridChip,
    streamFilters: settings.customStreamFilters?.length
      ? String(settings.customStreamFilters.length)
      : null,
    p2p: null,
    language: null,
    subtitles: settings.subtitleAutoSync ? "sync" : null,
    player: settings.playerEngine === "auto" ? null : settings.playerEngine,
    mpv:
      (settings.mpvQuality ?? "balanced") === "balanced"
        ? null
        : settings.mpvQuality === "performance"
          ? "lite"
          : "max",
    anime: settings.playerMotionInterp || settings.playerSvp ? "on" : null,
    shaders:
      settings.playerAnime4k || Object.values(settings.playerShaders ?? {}).some((s) => s?.enabled)
        ? "on"
        : null,
    playerLayout: null,
    controllers: settings.controllerSupportEnabled ? "on" : null,
    theme:
      settings.theme.preset === "cool-grey" && settings.theme.fontPair === "sentient-switzer"
        ? null
        : "•",
    badges: null,
    awardIcons: null,
    webhooks: webhookActive ? "live" : null,
    hotkeys: null,
    bug: null,
    support: null,
    remotes: settings.serveWebUi || settings.remoteControlEnabled ? "live" : null,
    tv: null,
    storage: null,
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
        className={`group flex h-14 w-full items-center gap-3 rounded-md px-2.5 text-start transition-colors ${
          isActive ? "bg-raised text-ink" : "text-ink-muted hover:bg-elevated hover:text-ink"
        }`}
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors ${
            isActive ? "text-canvas" : "bg-canvas text-ink-subtle group-hover:text-ink-muted"
          }`}
        >
          <Icon size={20} strokeWidth={1.6} />
        </span>
        <span className="flex-1 truncate text-[14.5px] font-medium">{t(label)}</span>
        {(chip || debridChipLocal) && (
          <span className="flex shrink-0 gap-1">
            {debridChipLocal && (
              <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wide text-accent">
                {debridChipLocal}
              </span>
            )}
            {chip && (
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-medium tracking-wide ${
                  chip === "live" || chip === "via relay"
                    ? "bg-accent-soft text-accent"
                    : "bg-canvas text-ink-subtle"
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
      className="relative flex w-72 shrink-0 flex-col bg-canvas pt-24"
    >
      <div data-tauri-drag-region className="h-3 shrink-0" />
      {showBack && (
        <div className="px-3 pb-1.5">
          <button
            type="button"
            onClick={() => (canGoBack ? goBack() : setView("home"))}
            className="flex h-10 w-full items-center gap-2 rounded-md px-3 text-start text-[13.5px] font-semibold text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
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
        <div className="group/find flex h-[46px] items-center gap-[11px] rounded-md bg-elevated px-[15px] transition-colors focus-within:bg-raised">
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-ink-subtle transition-colors group-focus-within/find:text-ink"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Search settings")}
            className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-subtle"
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
              className="animate-badge-pop harbor-press-pop shrink-0 text-ink-subtle transition-colors hover:text-ink"
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
                    className="group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-start text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-canvas text-ink-subtle group-hover:text-ink-muted">
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
                      <span className="block truncate text-[11.5px] text-ink-subtle">
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
          TOP_GROUPS.map((group, gi) => {
            const prevSection = gi > 0 ? TOP_GROUPS[gi - 1].section : null;
            const showSection = group.section !== prevSection;
            const firstId = group.children[0];
            const meta = NAV_ITEM_BY_ID.get(firstId);
            const Icon = meta?.Icon;
            const isActive = group.children.includes(active);
            const multi = group.children.length > 1;
            const isOpen = multi ? openGroups.has(group.id) || isActive : false;
            const groupChip = group.children.map((c) => status[c]).find(Boolean);
            const debridChip =
              group.children.includes("streaming") && debridKeys > 0 ? `${debridKeys}D` : null;
            const anyNew = group.children.some((c) => isNew(c));
            return (
              <div key={group.id} className="flex flex-col">
                {showSection && (
                  <div className="px-3.5 pb-1.5 pt-1 text-[10.5px] font-bold uppercase tracking-[0.2em] text-ink-subtle">
                    {t(group.section)}
                  </div>
                )}
                <button
                  aria-expanded={multi ? isOpen : undefined}
                  onClick={() => {
                    if (multi) {
                      setOpenGroups((prev) => {
                        const next = new Set(prev);
                        if (next.has(group.id)) next.delete(group.id);
                        else next.add(group.id);
                        return next;
                      });
                      return;
                    }
                    onChange(firstId);
                    markSectionSeen(firstId);
                  }}
                  className={`group flex h-11 w-full items-center gap-2.5 rounded-md px-2.5 text-start transition-colors ${
                    isActive
                      ? "bg-elevated text-ink"
                      : "text-ink-muted hover:bg-elevated hover:text-ink"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center transition-colors ${
                      isActive ? "text-ink" : "text-ink-subtle group-hover:text-ink-muted"
                    }`}
                  >
                    {Icon && <Icon size={18} strokeWidth={1.9} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
                    {t(group.label)}
                  </span>
                  {anyNew && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                  <span
                    className={`shrink-0 text-ink-subtle transition-transform ${
                      isActive ? "rotate-90" : ""
                    }`}
                  >
                    <IconChevronRight size={14} strokeWidth={2} />
                  </span>
                  {(groupChip || debridChip) && (
                    <span className="flex shrink-0 gap-1">
                      {debridChip && (
                        <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wide text-accent">
                          {debridChip}
                        </span>
                      )}
                      {groupChip && (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-medium tracking-wide ${
                            groupChip === "live" || groupChip === "via relay"
                              ? "bg-accent-soft text-accent"
                              : "bg-elevated text-ink-subtle"
                          }`}
                        >
                          {groupChip}
                        </span>
                      )}
                    </span>
                  )}
                </button>
                {isOpen && (
                  <div className="relative mb-1 ms-[19px] flex flex-col ps-3">
                    <span
                      aria-hidden
                      className="absolute inset-y-1 start-0 w-[2px] rounded-full bg-edge"
                    />
                    {group.children.map((childId) => {
                      const child = NAV_ITEM_BY_ID.get(childId);
                      if (!child) return null;
                      const on = childId === active;
                      return (
                        <button
                          key={childId}
                          onClick={() => {
                            onChange(childId);
                            markSectionSeen(childId);
                          }}
                          className={`relative flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-start text-[13px] transition-colors ${
                            on ? "text-ink" : "text-ink-subtle hover:text-ink-muted"
                          }`}
                        >
                          {on && (
                            <span
                              aria-hidden
                              className="harbor-rail-mark absolute inset-y-1 -start-3 w-[2px] rounded-full bg-ink"
                            />
                          )}
                          <span
                            className={`min-w-0 flex-1 truncate ${on ? "font-semibold" : "font-medium"}`}
                          >
                            {t(child.label)}
                          </span>
                          {isNew(childId) && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                          )}
                          {status[childId] && (
                            <span className="shrink-0 text-[10.5px] text-ink-subtle">
                              {status[childId]}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </nav>
  );
}
