import {
  TV_LANGS,
  TV_SERVICES,
  TV_SERVICES_DEFAULT,
  TV_UI_LANGUAGES,
  type TvChoice,
} from "./model-lists.ts";

export type TvWire = "settings" | "theme" | "playerlayout";

export type TvValue = boolean | string | string[];

export type TvDoc = Record<string, TvValue>;

type RowBase = {
  key: string;
  label: string;
  sub?: string;
  tvOnly?: boolean;
  newId?: string;
};

export type TvRow =
  | (RowBase & { kind: "toggle"; def: boolean })
  | (RowBase & { kind: "choice"; def: string; options: TvChoice[] })
  | (RowBase & { kind: "multi"; def: string[]; options: TvChoice[] })
  | (RowBase & {
      kind: "step";
      def: number;
      min: number;
      max: number;
      step: number;
      unit?: string;
    });

export type TvGroup = {
  id: string;
  title: string;
  subtitle: string;
  wire: TvWire;
  rows: TvRow[];
};

export type TvLockReason = "hide-spoilers-disabled";

export const TV_GROUPS: TvGroup[] = [
  {
    id: "picture",
    title: "Picture and feel",
    subtitle:
      "Adjust the screen edges and the artwork shown while browsing.",
    wire: "settings",
    rows: [
      {
        kind: "choice",
        key: "overscan",
        label: "Edge margin",
        sub: "If your TV cuts off the edges, add a margin to keep everything visible.",
        tvOnly: true,
        def: "0",
        options: [
          { value: "0", label: "Off" },
          { value: "0.02", label: "2%" },
          { value: "0.035", label: "3.5%" },
          { value: "0.05", label: "5%" },
        ],
      },
      {
        kind: "choice",
        key: "quality",
        label: "Backdrop detail",
        sub: "High loads sharper artwork. Choose Balanced if browsing feels slow. This does not affect video quality.",
        def: "high",
        options: [
          { value: "balanced", label: "Balanced" },
          { value: "high", label: "High" },
        ],
      },
      {
        kind: "toggle",
        key: "backdrop",
        label: "Fade between backdrops",
        sub: "Crossfade when the backdrop changes. Turn it off if the TV stutters while browsing.",
        def: true,
      },
    ],
  },
  {
    id: "around",
    title: "Getting around the TV",
    subtitle: "Choose your home layout, previews, and language for titles.",
    wire: "settings",
    rows: [
      {
        kind: "choice",
        key: "homeMode",
        label: "Home layout",
        def: "harbor",
        options: [
          { value: "harbor", label: "Harbor" },
          { value: "classic", label: "Classic" },
        ],
      },
      {
        kind: "toggle",
        key: "hideWatched",
        label: "Hide watched in catalogs",
        sub: "Remove titles you have finished from browse rows.",
        def: false,
      },
      {
        kind: "toggle",
        key: "heroPreview",
        label: "Hero trailer preview",
        sub: "Play a trailer in the featured area after a short pause.",
        def: true,
      },
      {
        kind: "choice",
        key: "uiLanguage",
        label: "Language for titles",
        sub: "Harbor asks your addons for titles and descriptions in this language. The TV menus stay in English.",
        def: "en",
        options: TV_UI_LANGUAGES,
      },
    ],
  },
  {
    id: "starting",
    title: "Starting a show",
    subtitle: "What happens between pressing Play and the picture appearing.",
    wire: "settings",
    rows: [
      {
        kind: "toggle",
        key: "instantPlay",
        label: "Instant play",
        sub: "Press Play and Harbor picks the source itself instead of opening the list.",
        def: true,
      },
      {
        kind: "toggle",
        key: "pickerMinimalRows",
        label: "Minimal source rows",
        sub: "Strips the source list back to name and size.",
        def: false,
      },
    ],
  },
  {
    id: "bingeing",
    title: "Between episodes",
    subtitle: "Choose when the next episode starts and when Harbor checks that you are still watching.",
    wire: "settings",
    rows: [
      { kind: "toggle", key: "autoNext", label: "Auto-play next episode", def: true },
      {
        kind: "toggle",
        key: "stillWatching",
        label: "Ask if you are still watching",
        sub: "Pause after several episodes and ask before continuing.",
        def: true,
      },
      {
        kind: "choice",
        key: "stillWatchingAfter",
        label: "Ask after",
        def: "3",
        options: [
          { value: "2", label: "2 episodes" },
          { value: "3", label: "3 episodes" },
          { value: "4", label: "4 episodes" },
          { value: "6", label: "6 episodes" },
        ],
      },
    ],
  },
  {
    id: "controls",
    title: "Player controls on the TV",
    subtitle: "Choose which controls appear during playback.",
    wire: "settings",
    rows: [
      { kind: "toggle", key: "showSkipButton", label: "Skip intros and credits", def: true },
      {
        kind: "choice",
        key: "skipButtonHideSec",
        label: "Hide skip button after",
        def: "0",
        options: [
          { value: "0", label: "Keep it up" },
          { value: "5", label: "5 seconds" },
          { value: "8", label: "8 seconds" },
          { value: "12", label: "12 seconds" },
        ],
      },
      { kind: "toggle", key: "playerClock", label: "Show the clock while playing", def: true },
    ],
  },
  {
    id: "episodes",
    title: "Episodes and spoilers",
    subtitle: "How much an episode card gives away before you have seen it.",
    wire: "settings",
    rows: [
      { kind: "toggle", key: "showEpisodeRating", label: "Show episode ratings", def: true },
      {
        kind: "toggle",
        key: "showEpisodeDescription",
        label: "Show episode descriptions",
        def: true,
      },
      {
        kind: "toggle",
        key: "hideSpoilers",
        label: "Hide spoilers",
        sub: "Keep unwatched episode details hidden. Choose what to hide below.",
        def: false,
      },
      { kind: "toggle", key: "spoilerHideThumbnails", label: "Hide thumbnails", def: true },
      { kind: "toggle", key: "spoilerHideTitles", label: "Hide titles", def: true },
      { kind: "toggle", key: "spoilerHideDescriptions", label: "Hide descriptions", def: true },
      {
        kind: "toggle",
        key: "spoilerSkipNext",
        label: "Never hide the next episode",
        sub: "The one you are about to watch stays readable.",
        def: true,
      },
    ],
  },
  {
    id: "languages",
    title: "Languages on the TV",
    subtitle: "Which audio and subtitle tracks the television reaches for first.",
    wire: "settings",
    rows: [
      {
        kind: "multi",
        key: "audioLang",
        label: "Audio languages",
        sub: "Put your preferred language first. The TV tries the others in order.",
        def: [],
        options: TV_LANGS,
      },
      {
        kind: "multi",
        key: "subLang",
        label: "Subtitle languages",
        def: ["en"],
        options: TV_LANGS,
      },
    ],
  },
  {
    id: "services",
    title: "Services on the TV",
    subtitle: "Choose the services you want to see while browsing on your TV.",
    wire: "settings",
    rows: [
      {
        kind: "multi",
        key: "service",
        label: "Services you have",
        def: TV_SERVICES_DEFAULT,
        options: TV_SERVICES,
      },
    ],
  },
];

function rowDefault(row: TvRow): TvValue {
  if (row.kind === "step") return String(row.def);
  return row.def;
}

export function readRow(doc: TvDoc, row: TvRow): TvValue {
  const raw = doc[row.key];
  if (raw === undefined) return rowDefault(row);
  if (row.kind === "toggle") return typeof raw === "boolean" ? raw : row.def;
  if (row.kind === "multi") return Array.isArray(raw) ? raw : row.def;
  return typeof raw === "string" ? raw : rowDefault(row);
}

export function readNumber(doc: TvDoc, row: TvRow & { kind: "step" }): number {
  const raw = doc[row.key];
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(n)) return row.def;
  return Math.min(row.max, Math.max(row.min, n));
}
