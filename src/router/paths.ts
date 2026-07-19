import type { View } from "@/lib/view";

/** URL path for each root tab. Nested frames stay in the View stack. */
export const VIEW_PATH: Record<View, string> = {
  home: "/",
  discover: "/discover",
  catalogs: "/catalogs",
  movies: "/movies",
  shows: "/shows",
  kids: "/kids",
  anime: "/anime",
  live: "/live",
  vod: "/vod",
  calendar: "/calendar",
  library: "/library",
  downloads: "/downloads",
  addons: "/addons",
  settings: "/settings",
  wrapped: "/wrapped",
};

const PATH_TO_VIEW = new Map<string, View>(
  Object.entries(VIEW_PATH).map(([view, path]) => [path, view as View]),
);

export function viewFromPath(pathname: string): View | null {
  const clean = pathname.replace(/\/+$/, "") || "/";
  return PATH_TO_VIEW.get(clean) ?? null;
}

export function pathFromView(view: View): string {
  return VIEW_PATH[view] ?? "/";
}

export function metaPath(type: string, id: string): string {
  return `/detail/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;
}
