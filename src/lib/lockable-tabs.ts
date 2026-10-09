export type LockableTab =
  | "discover"
  | "movies"
  | "shows"
  | "sports"
  | "anime"
  | "liveTv"
  | "calendar"
  | "library"
  | "addons";

export type LockableTabMeta = {
  key: LockableTab;
  label: string;
  iconKey:
    | "discover"
    | "movies"
    | "shows"
    | "sports"
    | "anime"
    | "liveTv"
    | "calendar"
    | "library"
    | "addons";
};

export const LOCKABLE_TABS: LockableTabMeta[] = [
  { key: "discover", label: "Discover", iconKey: "discover" },
  { key: "movies", label: "Movies", iconKey: "movies" },
  { key: "shows", label: "Shows", iconKey: "shows" },
  { key: "sports", label: "Sports", iconKey: "sports" },
  { key: "anime", label: "Anime", iconKey: "anime" },
  { key: "liveTv", label: "Live TV", iconKey: "liveTv" },
  { key: "calendar", label: "Calendar", iconKey: "calendar" },
  { key: "library", label: "My Library", iconKey: "library" },
  { key: "addons", label: "Addons", iconKey: "addons" },
];

export type HiddenTabs = Record<LockableTab, boolean>;

export const DEFAULT_HIDDEN: HiddenTabs = {
  discover: false,
  movies: false,
  shows: false,
  sports: false,
  anime: false,
  liveTv: false,
  calendar: false,
  library: false,
  addons: false,
};

export function anyTabLocked(tabs: HiddenTabs | null | undefined): boolean {
  if (!tabs) return false;
  return LOCKABLE_TABS.some(({ key }) => Boolean(tabs[key]));
}
