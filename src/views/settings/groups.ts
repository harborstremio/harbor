import type { SectionId } from "./shared";

export type TopGroup = {
  id: string;
  section: string;
  label: string;
  sub: string;
  children: SectionId[];
};

export const TOP_GROUPS: TopGroup[] = [
  {
    id: "start",
    section: "SETUP",
    label: "Get started",
    sub: "The handful of settings most people set once.",
    children: ["basics"],
  },
  {
    id: "account",
    section: "SETUP",
    label: "Account & sync",
    sub: "Your sign-in, the services that track what you watch, and your relay.",
    children: ["account", "trackers", "relay"],
  },
  {
    id: "watching",
    section: "WATCHING",
    label: "Playback",
    sub: "How video plays, how it looks, and what happens between episodes.",
    children: ["player", "mpv", "shaders", "anime"],
  },
  {
    id: "language",
    section: "LANGUAGE",
    label: "Languages & subtitles",
    sub: "What language Harbor speaks, and how subtitles behave.",
    children: ["language", "subtitles"],
  },
  {
    id: "content",
    section: "CONTENT",
    label: "Sources & library",
    sub: "Where streams come from, how they are filtered, and the metadata behind them.",
    children: ["streaming", "streamFilters", "p2p", "library"],
  },
  {
    id: "look",
    section: "LOOK & FEEL",
    label: "Appearance",
    sub: "Theme, the player's own layout, artwork, and what Harbor shows on a card.",
    children: ["theme", "playerLayout", "badges", "awardIcons"],
  },
  {
    id: "devices",
    section: "DEVICES",
    label: "Controls & devices",
    sub: "Keyboard, controller, remotes, and the big-screen build.",
    children: ["hotkeys", "controllers", "remotes", "tv"],
  },
  {
    id: "system",
    section: "SYSTEM",
    label: "System",
    sub: "Storage, automation, and the settings most people never need.",
    children: ["storage", "webhooks", "advanced"],
  },
  {
    id: "help",
    section: "HELP",
    label: "Help & support",
    sub: "Report something broken, or support the project.",
    children: ["bug", "support", "licenses", "icons"],
  },
  {
    id: "updates",
    section: "SYSTEM",
    label: "Updates & backup",
    sub: "Install updates, try beta builds, and keep a copy of your setup.",
    children: ["updates"],
  },
];

export function groupForSection(id: SectionId): TopGroup | undefined {
  return TOP_GROUPS.find((g) => g.children.includes(id));
}
