import { LANGUAGES } from "@/lib/i18n";
import { SERVICES } from "@/lib/providers/streaming";
import type { StreamingService } from "@/lib/settings";
import type { Settings } from "@/lib/settings/types";
import { ALL_LANGUAGE_NAMES } from "@/lib/subtitles/language";
import { mediaServerConnections } from "@/lib/media-server/connections";

export type BpCatId =
  | "picture"
  | "language"
  | "subtitles"
  | "playback"
  | "home"
  | "services"
  | "setup"
  | "interface";

export type BpPane = "connect" | "live";

export type BpT = (key: string, vars?: Record<string, string | number>) => string;

export type BpOption = { value: string; label: string };
export type BpMultiItem = { value: string; label: string; on: boolean; rank: number };

export type BpControl =
  | {
      kind: "options";
      id: string;
      label: string;
      value: string;
      options: BpOption[];
      /** Draw each cell as the glyph at its own value rather than as a word. */
      letter?: boolean;
      /** Split choices into real focus rows instead of one scrolling rail. */
      columns?: 2;
    }
  | { kind: "multi"; id: string; label: string; render: "logo" | "text"; items: BpMultiItem[] }
  | { kind: "push"; id: string; label: string; detail: string; pane: BpPane }
  | { kind: "action"; id: string; label: string };

export type BpCategory = { id: BpCatId; label: string; summary: string };

export const BP_CAT_IDS: readonly BpCatId[] = [
  "picture",
  "language",
  "subtitles",
  "playback",
  "home",
  "services",
  "setup",
  "interface",
];

// Whole percentages, because this is aimed at someone squinting at a crop from
// a sofa rather than at a pixel budget. 0 is correct for every HDMI set made in
// the last decade, so it leads.
export const BP_OVERSCAN_VALUES = ["0", "0.02", "0.035", "0.05"] as const;

const SUB_SIZES = ["24", "32", "44", "60"] as const;

// Proper-cased on purpose. The stored value is a lowercase enum member and
// running that through t() returned the enum itself in every language, which
// CSS then uppercased into "GLASS". These four already exist in the catalogs.
const SOUND_LABELS: Record<string, string> = {
  none: "Off",
  glass: "Glass",
  modern: "Modern",
  cinematic: "Cinematic",
  retro: "Retro",
};

const SOUND_VALUES = ["none", "glass", "modern", "cinematic", "retro"] as const;

export function bpSoundLabel(t: BpT, value: string): string {
  return t(SOUND_LABELS[value] ?? "Off");
}

const SUB_LANG_COMMON = 24;

function onOff(t: BpT): BpOption[] {
  return [
    { value: "on", label: t("On") },
    { value: "off", label: t("Off") },
  ];
}

function boolValue(on: boolean): string {
  return on ? "on" : "off";
}

export function bpOverscanLabel(t: BpT, value: number): string {
  return value === 0 ? t("Off") : `${Math.round(value * 1000) / 10}%`;
}

function nearestOverscan(value: number): string {
  let best: string = BP_OVERSCAN_VALUES[0];
  for (const v of BP_OVERSCAN_VALUES) {
    if (Math.abs(Number(v) - value) < Math.abs(Number(best) - value)) best = v;
  }
  return best;
}

function nearestSubSize(px: number): string {
  let best: string = SUB_SIZES[0];
  for (const v of SUB_SIZES) {
    if (Math.abs(Number(v) - px) < Math.abs(Number(best) - px)) best = v;
  }
  return best;
}

export function bpSubLangItems(s: Settings): BpMultiItem[] {
  const common = ALL_LANGUAGE_NAMES.slice(0, SUB_LANG_COMMON);
  // A language chosen elsewhere but outside the common set still needs a cell,
  // otherwise this screen can select it away but never give it back.
  const all = [...common, ...s.preferredSubLangs.filter((l) => !common.includes(l))];
  return all.map((lang) => {
    const at = s.preferredSubLangs.indexOf(lang);
    return { value: lang, label: lang, on: at >= 0, rank: at + 1 };
  });
}

export function bpServiceItems(s: Settings): BpMultiItem[] {
  return (Object.keys(SERVICES) as StreamingService[]).map((svc) => ({
    value: svc,
    label: SERVICES[svc].name,
    on: s.streaming[svc],
    rank: 0,
  }));
}

export function bpConnectedNames(facts: {
  tmdbKey: string;
  stremioName: string | null;
  harborName: string | null;
}): string[] {
  return [
    facts.tmdbKey.trim() ? "TMDB" : null,
    facts.stremioName ? "Stremio" : null,
    facts.harborName ? "Harbor" : null,
  ].filter((v): v is string => v !== null);
}

export function bpSettingsControls(
  id: BpCatId,
  s: Settings,
  t: BpT,
  overscan: number,
): BpControl[] {
  if (id === "picture") {
    return [
      {
        kind: "options",
        id: "overscan",
        label: t("Edge margin"),
        value: nearestOverscan(overscan),
        options: BP_OVERSCAN_VALUES.map((v) => ({
          value: v,
          label: bpOverscanLabel(t, Number(v)),
        })),
      },
      {
        kind: "options",
        id: "quality",
        label: t("Picture quality"),
        value: s.posterQuality,
        options: [
          { value: "balanced", label: t("Balanced") },
          { value: "high", label: t("High") },
          { value: "max", label: t("Max") },
        ],
      },
      {
        kind: "options",
        id: "backdrop",
        label: t("Animated backdrop"),
        value: boolValue(s.bigPictureMosaic),
        options: onOff(t),
      },
    ];
  }

  if (id === "language") {
    return [
      {
        kind: "options",
        id: "uiLanguage",
        label: t("Display language"),
        value: s.uiLanguage,
        options: LANGUAGES.map((l) => ({ value: l.code, label: l.nativeLabel })),
      },
    ];
  }

  if (id === "subtitles") {
    return [
      {
        kind: "multi",
        id: "subLang",
        label: t("Subtitle languages"),
        render: "text",
        items: bpSubLangItems(s),
      },
      {
        kind: "options",
        id: "subSize",
        label: t("Size"),
        value: nearestSubSize(s.subFontSize),
        letter: true,
        options: SUB_SIZES.map((v) => ({ value: v, label: `${v}px` })),
      },
    ];
  }

  if (id === "playback") {
    return [
      {
        kind: "options",
        id: "playbackSource",
        label: t("Play button behavior"),
        value: s.playbackSourcePreference,
        options: [
          { value: "ask", label: t("Ask every time") },
          { value: "online", label: t("Online streams") },
          { value: "local", label: t("Local Library") },
          { value: "home-server", label: t("Home server") },
        ],
        columns: 2 as const,
      },
      ...(s.playbackSourcePreference === "home-server"
        ? [
            {
              kind: "options" as const,
              id: "preferredMediaServer",
              label: t("Preferred home server"),
              value: s.preferredMediaServerId ?? "",
              options: [
                { value: "", label: t("Ask which server") },
                ...mediaServerConnections()
                  .filter((connection) => connection.enabled)
                  .map((connection) => ({ value: connection.id, label: connection.name })),
              ],
              columns: 2 as const,
            },
          ]
        : []),
      {
        kind: "options",
        id: "engine",
        label: t("Player engine"),
        value: s.playerEngine,
        options: [
          { value: "auto", label: t("Auto") },
          { value: "mpv", label: "mpv" },
          { value: "html5", label: "HTML5" },
        ],
      },
      {
        kind: "options",
        id: "hwdec",
        label: t("Hardware acceleration"),
        value: s.mpvHwdec,
        options: [
          { value: "auto", label: t("Auto") },
          { value: "on", label: t("On") },
          { value: "off", label: t("Off") },
        ],
      },
      {
        kind: "options",
        id: "skipIntro",
        label: t("Skip intros"),
        value: boolValue(s.autoSkipIntro),
        options: onOff(t),
      },
      {
        kind: "options",
        id: "autoNext",
        label: t("Auto-play next episode"),
        value: boolValue(s.autoPlayNextEpisode),
        options: onOff(t),
      },
      // bp-detail.tsx:192 reads instantPlay to decide whether Play picks a
      // source silently or shows the list. With it on and no control here, a
      // viewer on a television can never reach the source list at all.
      {
        kind: "options",
        id: "instantPlay",
        label: t("Instant play"),
        value: boolValue(s.instantPlay),
        options: onOff(t),
      },
    ];
  }

  if (id === "home") {
    return [
      {
        kind: "options",
        id: "homeMode",
        label: t("Home layout"),
        value: s.homeMode,
        options: [
          { value: "harbor", label: t("Harbor") },
          { value: "classic", label: t("Classic") },
        ],
      },
      {
        kind: "options",
        id: "hideWatched",
        label: t("Hide watched in catalogs"),
        value: boolValue(s.hideWatchedInCatalogs),
        options: onOff(t),
      },
    ];
  }

  if (id === "services") {
    return [
      {
        kind: "multi",
        id: "service",
        label: t("Turn off what you do not have"),
        render: "logo",
        items: bpServiceItems(s),
      },
    ];
  }

  if (id === "setup") {
    return [
      {
        kind: "push",
        id: "connect",
        label: t("Accounts and TMDB"),
        detail: t("Nothing connected yet. Scan a code with your phone."),
        pane: "connect",
      },
      {
        kind: "push",
        id: "live",
        label: t("Live TV playlists"),
        detail: t("Add an M3U link or Xtream Codes login"),
        pane: "live",
      },
    ];
  }

  return [
    {
      kind: "options",
      id: "sound",
      label: t("Interface sounds"),
      value: s.bigPictureSound,
      options: SOUND_VALUES.map((v) => ({ value: v, label: t(SOUND_LABELS[v]) })),
    },
    {
      kind: "options",
      id: "controller",
      label: t("Controller navigation"),
      value: boolValue(s.tvNavigation),
      options: onOff(t),
    },
    {
      kind: "options",
      id: "autoStart",
      label: t("Open in Big Picture"),
      value: boolValue(s.bigPictureAutoStart),
      options: onOff(t),
    },
    { kind: "action", id: "leave", label: t("Leave Big Picture") },
  ];
}

export function bpSettingsCategories(
  s: Settings,
  t: BpT,
  overscan: number,
  connected: string[],
): BpCategory[] {
  const subLang = s.preferredSubLangs[0];
  const services = bpServiceItems(s).filter((i) => i.on).length;
  const language = LANGUAGES.find((l) => l.code === s.uiLanguage);
  const label: Record<BpCatId, string> = {
    picture: t("Picture"),
    language: t("Language"),
    subtitles: t("Subtitles"),
    playback: t("Playback"),
    home: t("Home"),
    services: t("Your services"),
    setup: t("Setup"),
    interface: t("Interface"),
  };
  const summary: Record<BpCatId, string> = {
    picture: `${bpOverscanLabel(t, overscan)} / ${t(
      s.posterQuality === "balanced" ? "Balanced" : s.posterQuality === "high" ? "High" : "Max",
    )}`,
    language: language?.nativeLabel ?? s.uiLanguage,
    subtitles: subLang ? `${subLang} / ${s.subFontSize}px` : t("Off"),
    playback: `${s.playerEngine === "auto" ? t("Auto") : s.playerEngine === "mpv" ? "mpv" : "HTML5"}`,
    home: s.homeMode === "harbor" ? t("Harbor") : t("Classic"),
    services: t("{n} on", { n: services }),
    setup: connected.length > 0 ? connected.join(", ") : t("None"),
    interface: bpSoundLabel(t, s.bigPictureSound),
  };
  return BP_CAT_IDS.map((id) => ({ id, label: label[id], summary: summary[id] }));
}
