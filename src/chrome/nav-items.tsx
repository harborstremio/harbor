import type { ReactNode } from "react";
import { AddonsIcon } from "@/components/icons/addons-icon";
import { CatalogsIcon } from "@/components/icons/catalogs-icon";
import { AnimeIcon } from "@/components/icons/anime-icon";
import { CalendarIcon } from "@/components/icons/calendar-icon";
import { DiscoverIcon } from "@/components/icons/discover-icon";
import { HomeIcon } from "@/components/icons/home-icon";
import { LibraryIcon } from "@/components/icons/library-icon";
import { LiveTvIcon } from "@/components/icons/live-tv-icon";
import { MoviesIcon } from "@/components/icons/movies-icon";
import { PlaylistVodIcon } from "@/components/icons/playlist-vod-icon";
import { SettingsIcon } from "@/components/icons/settings-icon";
import { TvIcon } from "@/components/icons/tv-icon";
import { KidsIcon } from "@/components/icons/kids-icon";
import { DownloadsNavIcon } from "@/chrome/downloads-nav-icon";
import type { LockableTab } from "@/lib/parental";
import type { View } from "@/lib/view";

export type NavItemId =
  | "home"
  | "discover"
  | "catalogs"
  | "movies"
  | "shows"
  | "kids"
  | "anime"
  | "live"
  | "vod"
  | "calendar"
  | "library"
  | "downloads"
  | "addons"
  | "settings";

export type NavItem = {
  id: NavItemId;
  label: string;
  render: (active: boolean) => ReactNode;
  view: View;
  hideKey?: "anime" | "liveTv" | "sports";
  parentalKey?: LockableTab;
  pinGated?: boolean;
};

export type NavCustomization = {
  order: string[];
  hidden: string[];
  renamed: Record<string, string>;
};

export const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "nav.home", render: (active) => <HomeIcon active={active} />, view: "home" },
  {
    id: "discover",
    label: "nav.discover",
    render: (active) => <DiscoverIcon active={active} />,
    view: "discover",
    parentalKey: "discover",
  },
  {
    id: "catalogs",
    label: "nav.catalogs",
    render: (active) => <CatalogsIcon active={active} />,
    view: "catalogs",
    parentalKey: "discover",
  },
  {
    id: "movies",
    label: "nav.movies",
    render: (active) => <MoviesIcon active={active} />,
    view: "movies",
    parentalKey: "movies",
  },
  {
    id: "shows",
    label: "nav.shows",
    render: (active) => <TvIcon active={active} />,
    view: "shows",
    parentalKey: "shows",
  },
  { id: "kids", label: "nav.kids", render: (active) => <KidsIcon active={active} />, view: "kids" },
  {
    id: "anime",
    label: "nav.anime",
    render: (active) => <AnimeIcon active={active} />,
    view: "anime",
    hideKey: "anime",
    parentalKey: "anime",
  },
  {
    id: "live",
    label: "nav.live",
    render: (active) => <LiveTvIcon active={active} />,
    view: "live",
    hideKey: "liveTv",
    parentalKey: "liveTv",
  },
  {
    id: "vod",
    label: "nav.playlists",
    render: (active) => <PlaylistVodIcon active={active} />,
    view: "vod",
  },
  {
    id: "calendar",
    label: "nav.calendar",
    render: (active) => <CalendarIcon active={active} />,
    view: "calendar",
    parentalKey: "calendar",
  },
  {
    id: "library",
    label: "nav.library",
    render: (active) => <LibraryIcon active={active} />,
    view: "library",
    parentalKey: "library",
  },
  {
    id: "downloads",
    label: "nav.downloads",
    render: (active) => <DownloadsNavIcon active={active} />,
    view: "downloads",
  },
  {
    id: "addons",
    label: "nav.addons",
    render: (active) => <AddonsIcon active={active} />,
    view: "addons",
    parentalKey: "addons",
  },
  {
    id: "settings",
    label: "nav.settings",
    render: (active) => <SettingsIcon active={active} />,
    view: "settings",
    pinGated: true,
  },
];

export function applyNavCustomization(items: NavItem[], cfg: NavCustomization): NavItem[] {
  const shown = items
    .filter((it) => !cfg.hidden.includes(it.id))
    .map((it) => (cfg.renamed[it.id] ? { ...it, label: cfg.renamed[it.id] } : it));
  if (cfg.order.length === 0) return shown;
  const byId = new Map<string, NavItem>(shown.map((it) => [it.id, it]));
  const ordered: NavItem[] = [];
  for (const id of cfg.order) {
    const it = byId.get(id);
    if (it) ordered.push(it);
  }
  const inOrder = new Set(cfg.order);
  for (const it of shown) {
    if (!inOrder.has(it.id)) ordered.push(it);
  }
  return ordered;
}

export function effectiveNavOrder(cfg: NavCustomization): NavItemId[] {
  const all = NAV_ITEMS.map((it) => it.id);
  const known = new Set<string>(all);
  const out: NavItemId[] = [];
  for (const id of cfg.order) {
    if (known.has(id)) out.push(id as NavItemId);
  }
  const seen = new Set<string>(out);
  for (const id of all) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

export function moveNavItem(
  cfg: NavCustomization,
  fromId: string,
  toId: string,
  position: "before" | "after",
): NavCustomization {
  if (fromId === toId) return cfg;
  const next = effectiveNavOrder(cfg).filter((id) => id !== fromId);
  const anchor = next.indexOf(toId as NavItemId);
  if (anchor < 0) return cfg;
  next.splice(position === "after" ? anchor + 1 : anchor, 0, fromId as NavItemId);
  return { ...cfg, order: next };
}

export function toggleNavHidden(cfg: NavCustomization, id: string): NavCustomization {
  const hidden = cfg.hidden.includes(id) ? cfg.hidden.filter((x) => x !== id) : [...cfg.hidden, id];
  return { ...cfg, hidden };
}

export function renameNavItem(cfg: NavCustomization, id: string, label: string): NavCustomization {
  const trimmed = label.trim();
  const renamed = { ...cfg.renamed };
  if (trimmed) renamed[id] = trimmed;
  else delete renamed[id];
  return { ...cfg, renamed };
}

export function resetNavCustomization(): NavCustomization {
  return { order: [], hidden: [], renamed: {} };
}
